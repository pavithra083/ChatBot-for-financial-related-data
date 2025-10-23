import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import { extractTextFromPDF, analyzeFinancialData } from '../services/pdfService.js';
import { generateChatResponse } from '../services/openrouterService.js';
import { convertPDFDataToExcel } from '../services/excelService.js';

const router = express.Router();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/pdfs';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    
    const pdfData = await extractTextFromPDF(req.file.path);
    
    
    const analysis = analyzeFinancialData(pdfData.text);

    
    const document = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      extractedText: pdfData.text,
      metadata: {
        pages: pdfData.pages,
        analysis: analysis
      }
    });

    await document.save();

    
    const chat = new Chat({
      documentId: document._id,
      messages: []
    });
    await chat.save();

    res.json({
      success: true,
      documentId: document._id,
      chatId: chat._id,
      filename: document.originalName,
      pages: pdfData.pages,
      analysis: analysis
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});


router.post('/chat', async (req, res) => {
  try {
    const { documentId, message } = req.body;

    if (!documentId || !message) {
      return res.status(400).json({ error: 'Document ID and message are required' });
    }

    
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    
    let chat = await Chat.findOne({ documentId });
    if (!chat) {
      chat = new Chat({ documentId, messages: [] });
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
      chatHistory: chat.messages
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/download/:documentId', async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const excelDir = 'uploads/excel';
    if (!fs.existsSync(excelDir)) {
      fs.mkdirSync(excelDir, { recursive: true });
    }

    const excelPath = path.join(excelDir, `${document.filename}.xlsx`);
    
    convertPDFDataToExcel(
      document.extractedText,
      document.metadata.analysis,
      excelPath
    );

    res.download(excelPath, `${document.originalName}.xlsx`, (err) => {
      if (err) {
        console.error('Download Error:', err);
      }
      
      fs.unlinkSync(excelPath);
    });
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/chat/:documentId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ documentId: req.params.documentId });
    if (!chat) {
      return res.json({ messages: [] });
    }
    res.json({ messages: chat.messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;