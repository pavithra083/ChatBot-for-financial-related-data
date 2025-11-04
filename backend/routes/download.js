const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { generateExcelFromDocument } = require('../services/excelService');
const fs = require('fs').promises;
const path = require('path');
const auth = require('../middleware/auth');

// UPLOAD TO GOOGLE DRIVE
const { uploadFile } = require('../uploadToDrive');


router.use(auth);


router.get('/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user._id;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DOWNLOAD EXCEL REQUEST FROM USER: ${userId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Document ID: ${documentId}`);

    // Verify document belongs to user
    const document = await Document.findOne({ _id: documentId, userId });
    if (!document) {
      console.log('❌ Document not found or access denied');
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

    console.log(`Generating Excel for: ${document.originalName}`);
    const excelBuffer = await generateExcelFromDocument(document);

    const filename = `${document.originalName.replace('.pdf', '')}_extracted.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);

    console.log(`Excel sent: ${filename} (${(excelBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('DOWNLOAD ERROR:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});


router.post('/drive/:documentId', auth, async (req, res) => {
  const tempPath = path.join(__dirname, '../temp', `excel_${Date.now()}.xlsx`);
  
  try {
    const { documentId } = req.params;
    const userId = req.user._id;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`UPLOAD TO GOOGLE DRIVE FROM USER: ${userId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Document ID: ${documentId}`);

    // Verify document belongs to user
    const document = await Document.findOne({ _id: documentId, userId });
    if (!document) {
      console.log('❌ Document not found or access denied');
      return res.status(404).json({ 
        success: false,
        error: 'Document not found' 
      });
    }

    console.log(`Generating Excel...`);
    const excelBuffer = await generateExcelFromDocument(document);
    
    console.log(`Saving temp file...`);
    await fs.writeFile(tempPath, excelBuffer);

    const filename = `${document.originalName.replace('.pdf', '')}_${Date.now()}.xlsx`;
    
    console.log(`Uploading to Google Drive: ${filename}`);
    const driveLink = await uploadFile(tempPath, filename);

    console.log(`Cleaning up temp file...`);
    await fs.unlink(tempPath);

    console.log(`SUCCESS: File uploaded!`);
    console.log(`Link: ${driveLink}`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({ 
      success: true, 
      driveLink,
      message: 'Uploaded to Google Drive!'
    });

  } catch (error) {
    console.error(`\nUPLOAD FAILED: ${error.message}`);
    try { await fs.unlink(tempPath); } catch {}
    console.error(`${'='.repeat(60)}\n`);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;