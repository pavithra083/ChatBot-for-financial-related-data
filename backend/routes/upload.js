const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const { extractTextFromPDF, validatePDF } = require('../services/pdfService');
const { extractStructuredData } = require('../services/geminiservice');
const { 
  splitPDFIntoChunks, 
  saveChunksToDatabase, 
  analyzeChunksInBackground,
  getAnalysisStatus,
  mergeChunkData,
  getDocumentChunks,
  PAGES_PER_CHUNK
} = require('../services/pdfChunkingService');
const { generateExcelFromDocument } = require('../services/excelService');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    try {
      validatePDF(file);
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Apply auth middleware to all upload routes
router.use(auth);

router.post('/', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const userId = req.user._id;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 FILE UPLOAD FROM USER: ${userId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 File Name: ${req.file.originalname}`);
    console.log(`📊 File Size: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`📂 File Path: ${req.file.path}`);

    console.log(`\n[Step 1/5] Extracting text from PDF...`);
    const pdfData = await extractTextFromPDF(req.file.path);
    console.log(`✅ Extracted ${pdfData.numPages} pages`);
    console.log(`✅ Text length: ${pdfData.text.length} characters`);

    const shouldChunk = pdfData.numPages > PAGES_PER_CHUNK;
    console.log(`\n📊 PDF Size: ${pdfData.numPages} pages`);
    console.log(`📋 Chunking: ${shouldChunk ? 'YES' : 'NO'} (threshold: ${PAGES_PER_CHUNK} pages)`);

    console.log(`\n[Step 2/5] Saving to MongoDB...`);
    const document = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      extractedText: pdfData.text,
      structuredData: null,
      fileSize: req.file.size,
      pageCount: pdfData.numPages,
      isChunked: shouldChunk,
      totalChunks: shouldChunk ? Math.ceil(pdfData.numPages / PAGES_PER_CHUNK) : 0,
      chunkingStatus: shouldChunk ? 'chunked' : 'none',
      userId: userId // ADD USER ID
    });

    await document.save();
    console.log(`✅ Document saved with ID: ${document._id}`);

    console.log(`\n[Step 3/5] Creating chat session...`);
    const chat = new Chat({
      documentId: document._id,
      messages: [],
      userId: userId // ADD USER ID
    });

    await chat.save();
    console.log(`✅ Chat session created with ID: ${chat._id}`);

    if (shouldChunk) {
      console.log(`\n[Step 4/5] Processing LARGE document with chunking...`);
      
      try {
        const chunks = await splitPDFIntoChunks(req.file.path, pdfData.numPages);
        console.log(`✅ PDF split into ${chunks.length} chunks`);
        
        const savedChunks = await saveChunksToDatabase(document._id, chunks);
        console.log(`✅ ${savedChunks.length} chunks saved to MongoDB`);
        
        console.log(`\n[Step 5/5] Starting background analysis...`);
        analyzeChunksInBackground(savedChunks, document._id);
        
        console.log(`✅ Chunks queued for background analysis`);
      } catch (chunkError) {
        console.error('❌ Chunking error:', chunkError.message);
        
        await Document.findByIdAndUpdate(document._id, {
          chunkingStatus: 'failed'
        });
        throw chunkError;
      }
      
    } else {
      console.log(`\n[Step 4/5] Processing SMALL document (no chunking)...`);
      
      extractStructuredData(pdfData.text)
        .then(async (structuredData) => {
          try {
            const updated = await Document.findByIdAndUpdate(
              document._id,
              {
                structuredData: structuredData,
                chunkingStatus: 'completed'
              },
              { new: true }
            );
            console.log(`✅ Small document analysis completed`);
            console.log(`   - Items extracted: ${structuredData.items?.length || 0}`);
          } catch (saveError) {
            console.error(`❌ Error saving structured data for ${document._id}:`, saveError.message);
          }
        })
        .catch(error => {
          console.error(`❌ Small document analysis failed for ${document._id}:`, error.message);
          
          Document.findByIdAndUpdate(document._id, {
            chunkingStatus: 'failed'
          }).catch(err => console.error('Error updating failed status:', err));
        });
      
      console.log(`[Step 5/5] Background analysis started...`);
    }

    const totalTime = Date.now() - startTime;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ UPLOAD COMPLETED SUCCESSFULLY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📄 Document ID: ${document._id}`);
    console.log(`💬 Chat ID: ${chat._id}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`⏱️  Total Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`📊 Document Size: ${pdfData.numPages} pages`);
    console.log(`🔄 Processing Mode: ${shouldChunk ? 'CHUNKED' : 'DIRECT'}`);
    if (shouldChunk) {
      console.log(`📦 Total Chunks: ${Math.ceil(pdfData.numPages / PAGES_PER_CHUNK)}`);
      console.log(`🤖 Analysis: Running in background for each chunk...`);
    } else {
      console.log(`🤖 Analysis: Running in background...`);
    }
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      success: true,
      message: shouldChunk 
        ? `File uploaded successfully. Split into ${Math.ceil(pdfData.numPages / PAGES_PER_CHUNK)} chunks for analysis...` 
        : 'File uploaded successfully. AI analysis in progress...',
      documentId: document._id,
      chatId: chat._id,
      filename: req.file.originalname,
      pageCount: pdfData.numPages,
      processingTime: totalTime,
      isChunked: shouldChunk,
      totalChunks: shouldChunk ? Math.ceil(pdfData.numPages / PAGES_PER_CHUNK) : 0,
      aiAnalysisStatus: 'processing'
    });

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ UPLOAD ERROR');
    console.error(`${'='.repeat(60)}`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error(`${'='.repeat(60)}\n`);
    
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
        console.log('🗑️  Cleaned up uploaded file after error');
      } catch (unlinkError) {
        console.error('❌ Error deleting file:', unlinkError.message);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/documents', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const documents = await Document.find({ userId })
      .sort({ uploadedAt: -1 })
      .select('originalName uploadedAt pageCount fileSize _id chunkingStatus');
    
    res.json({
      success: true,
      count: documents.length,
      documents: documents
    });
  } catch (error) {
    console.error('❌ Error fetching documents:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/document/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const document = await Document.findOne({ _id: req.params.id, userId });
    
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }
    
    const analysisStatus = document.isChunked 
      ? await getAnalysisStatus(document._id)
      : {
          total: 1,
          completed: document.structuredData ? 1 : 0,
          processing: 0,
          pending: document.structuredData ? 0 : 1,
          failed: 0,
          percentComplete: document.structuredData ? 100 : 0,
          isComplete: !!document.structuredData
        };
    
    res.json({
      success: true,
      document: document,
      analysisStatus: analysisStatus
    });
  } catch (error) {
    console.error('❌ Error fetching document:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/download/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 EXCEL DOWNLOAD REQUEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📄 Document ID: ${documentId}`);

    const document = await Document.findById(documentId);
    
    if (!document) {
      console.log('❌ Document not found');
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

    console.log(`📊 Generating Excel for: ${document.originalName}`);
    console.log(`📋 Chunked: ${document.isChunked ? 'YES' : 'NO'}`);

    
    if (document.isChunked && document.chunkingStatus === 'completed') {
      console.log(`🔄 Merging data from chunks...`);
      const mergedData = await mergeChunkData(documentId);
      document.structuredData = mergedData;
      console.log(`✅ Merged ${mergedData.items?.length || 0} total items from all chunks`);
    } else if (document.isChunked && !document.structuredData) {
      console.log(`⚠️  Chunks still being analyzed or no data available`);
      
      const mergedData = await mergeChunkData(documentId);
      document.structuredData = mergedData;
      console.log(`✅ Partial merge: ${mergedData.items?.length || 0} items available so far`);
    }

    
    if (!document.structuredData) {
      console.log('❌ No structured data available for this document');
      return res.status(400).json({ 
        success: false,
        error: 'Document analysis not yet complete. Please wait and try again.',
        status: document.chunkingStatus
      });
    }

    
    console.log(`📝 Generating Excel workbook...`);
    const excelBuffer = await generateExcelFromDocument(document);

   
    const filename = `${document.originalName.replace('.pdf', '')}_extracted_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

   
    res.send(excelBuffer);
    
    console.log(`✅ Excel file sent: ${filename}`);
    console.log(`📦 Size: ${(excelBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ DOWNLOAD ERROR');
    console.error(`${'='.repeat(60)}`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error(`${'='.repeat(60)}\n`);
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.get('/chunks/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    console.log(`\n📦 Fetching chunks for document: ${documentId}`);
    
    const chunks = await getDocumentChunks(documentId);
    
    if (!chunks || chunks.length === 0) {
      return res.json({
        success: true,
        documentId: documentId,
        totalChunks: 0,
        chunks: []
      });
    }
    
    console.log(`✅ Found ${chunks.length} chunks`);
    
    res.json({
      success: true,
      documentId: documentId,
      totalChunks: chunks.length,
      chunks: chunks.map(c => ({
        chunkId: c._id,
        chunkNumber: c.chunkNumber,
        startPage: c.startPage,
        endPage: c.endPage,
        pageCount: c.pageCount,
        analysisStatus: c.analysisStatus,
        itemsExtracted: c.structuredData?.items?.length || 0,
        analyzedAt: c.analyzedAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Get Chunks Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }
    
    if (!document.isChunked) {
      
      const isComplete = !!document.structuredData;
      return res.json({
        success: true,
        isChunked: false,
        status: isComplete ? 'completed' : 'processing',
        total: 1,
        completed: isComplete ? 1 : 0,
        percentComplete: isComplete ? 100 : 0,
        itemsExtracted: document.structuredData?.items?.length || 0
      });
    }
    
    
    const status = await getAnalysisStatus(documentId);
    
    console.log(`📊 Status for ${documentId}: ${status.completed}/${status.total} chunks completed`);
    
    res.json({
      success: true,
      isChunked: true,
      documentStatus: document.chunkingStatus,
      ...status
    });
    
  } catch (error) {
    console.error('❌ Get Status Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;