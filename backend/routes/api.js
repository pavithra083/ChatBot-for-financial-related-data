import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import { processAndAnalyzePDF } from '../services/pdfService.js';
import { generateChatResponse } from '../services/openrouterService.js';
import { convertPDFDataToExcel } from '../services/excelService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();


const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});


router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    console.log('=== PDF UPLOAD PROCESS STARTED ===');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    console.log('File details:', {
      originalName: req.file.originalname,
      bufferSize: req.file.buffer.length,
      mimetype: req.file.mimetype
    });

   
    const result = await processAndAnalyzePDF(req.file.buffer, req.file.originalname);

    
    const chat = new Chat({
      documentId: result.documentId,
      messages: []
    });
    await chat.save();
    
    console.log('Chat created for document:', result.documentId);

    res.json({
      success: true,
      documentId: result.documentId,
      chatId: chat._id,
      filename: req.file.originalname,
      pages: result.extractedData.pages,
      analysis: result.financialAnalysis,
      message: 'PDF processed and stored in MongoDB successfully'
    });
    
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.post('/chat', async (req, res) => {
  try {
    const { documentId, message } = req.body;

    if (!documentId || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Document ID and message are required' 
      });
    }

    
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

   
    let chat = await Chat.findOne({ documentId });
    if (!chat) {
      chat = new Chat({ 
        documentId, 
        messages: [] 
      });
    }

    
    chat.messages.push({
      role: 'user',
      content: message
    });

    const aiResponse = await generateChatResponse(
      message,
      document.extractedText,
      chat.messages.slice(-10) 
    );

    
    chat.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    await chat.save();

    res.json({
      success: true,
      response: aiResponse,
      chatId: chat._id,
      documentId: documentId,
      chatHistory: chat.messages
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.get('/chat/:documentId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ 
      documentId: req.params.documentId 
    });
    
    if (!chat) {
      return res.json({ 
        success: true,
        messages: [] 
      });
    }
    
    res.json({ 
      success: true,
      chatId: chat._id,
      documentId: chat.documentId,
      messages: chat.messages 
    });
  } catch (error) {
    console.error('Get Chat Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/download/:documentId', async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }
    const excelPath = join(__dirname, `temp_${document._id}_${Date.now()}.xlsx`);
    
    
    await convertPDFDataToExcel(
      document.extractedText,
      document.metadata.financialData || document.metadata.analysis,
      excelPath
    );
       
    const originalName = document.originalName.replace('.pdf', '');
    const excelFilename = `${originalName}_financial_report.xlsx`;

   
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFilename}"`);

    
    res.download(excelPath, excelFilename, (err) => {
      if (err) {
        console.error('Download Error:', err);
      }
    
      if (fs.existsSync(excelPath)) {
        fs.unlinkSync(excelPath);
      }
    });
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});



router.get('/documents', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const documents = await Document.find()
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('filename originalName uploadedAt metadata extractedText');

    const total = await Document.countDocuments();

    res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.originalName,
        uploadedAt: doc.uploadedAt,
        pages: doc.metadata?.pages || 0,
        fileSize: doc.metadata?.fileSize || 0,
        textPreview: doc.extractedText ? 
          doc.extractedText.substring(0, 200) + '...' : 'No text',
        hasAnalysis: !!(doc.metadata?.financialData || doc.metadata?.analysis)
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Documents Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/documents/:documentId', async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

    res.json({
      success: true,
      document: {
        id: document._id,
        filename: document.originalName,
        uploadedAt: document.uploadedAt,
        fileSize: document.metadata?.fileSize || 0,
        pages: document.metadata?.pages || 0,
        mimetype: document.metadata?.mimetype || 'application/pdf',
        transactions: document.metadata?.transactions || [],
        analysis: document.metadata?.financialData || document.metadata?.analysis,
        textLength: document.extractedText.length
      }
    });
  } catch (error) {
    console.error('Get Document Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.delete('/documents/:documentId', async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

    await Promise.all([
      Document.findByIdAndDelete(req.params.documentId),
      Chat.deleteOne({ documentId: req.params.documentId })
    ]);

    res.json({
      success: true,
      message: 'Document and associated chat deleted successfully',
      deletedDocumentId: req.params.documentId
    });
  } catch (error) {
    console.error('Delete Document Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.get('/debug/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 });
    
    res.json({
      success: true,
      totalCount: documents.length,
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.originalName,
        uploadedAt: doc.uploadedAt,
        fileSize: doc.metadata?.fileSize || 0,
        pages: doc.metadata?.pages || 0,
        textPreview: doc.extractedText ? 
          doc.extractedText.substring(0, 100) + '...' : 'No text',
        hasAnalysis: !!(doc.metadata?.financialData || doc.metadata?.analysis),
        transactionCount: doc.metadata?.transactions?.length || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/debug/chats', async (req, res) => {
  try {
    const chats = await Chat.find()
      .sort({ createdAt: -1 })
      .populate('documentId', 'originalName uploadedAt');
    
    res.json({
      success: true,
      totalCount: chats.length,
      chats: chats.map(chat => ({
        id: chat._id,
        documentId: chat.documentId?._id,
        documentName: chat.documentId?.originalName,
        messageCount: chat.messages.length,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessage: chat.messages.length > 0 ? 
          `${chat.messages[chat.messages.length - 1].role}: ${chat.messages[chat.messages.length - 1].content.substring(0, 50)}...` 
          : 'No messages'
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
router.get('/debug-excel/:documentId', async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const tempPath = join(__dirname, `debug_excel_${Date.now()}.xlsx`);
    
    const result = await convertPDFDataToExcel(
      document.extractedText,
      document.metadata.financialData || document.metadata.analysis,
      tempPath
    );

    const stats = fs.statSync(tempPath);
    
    res.json({
      success: true,
      fileInfo: {
        path: tempPath,
        size: stats.size,
        created: stats.birthtime,
        excelResult: result
      },
      documentInfo: {
        originalName: document.originalName,
        transactionCount: document.metadata?.transactions?.length || 0
      }
    });

    setTimeout(() => {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }, 5000);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const docCount = await Document.countDocuments();
    const chatCount = await Chat.countDocuments();
    
    res.json({
      success: true,
      status: 'OK',
      database: 'Connected',
      statistics: {
        documents: docCount,
        chats: chatCount,
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'Error',
      error: error.message
    });
  }
});

export default router;