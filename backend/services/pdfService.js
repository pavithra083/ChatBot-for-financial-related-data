const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version
    };
    
  } catch (error) {
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

function validatePDF(file) {
  if (!file) {
    throw new Error('No file provided');
  }
  
  if (file.mimetype !== 'application/pdf') {
    throw new Error('File must be a PDF');
  }
  
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File size must be less than 10MB');
  }
  
  return true;
}

async function getPDFMetadata(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    
    return {
      pages: data.numpages,
      info: data.info || {},
      metadata: data.metadata || {},
      version: data.version
    };
    
  } catch (error) {
    return null;
  }
}

async function cleanupPDF(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
  }
}

module.exports = {
  extractTextFromPDF,
  validatePDF,
  getPDFMetadata,
  cleanupPDF
};