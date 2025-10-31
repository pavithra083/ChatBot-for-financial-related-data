const fs = require('fs').promises;
const pdf = require('pdf-parse');
const DocumentPage = require('../models/DocumentPage');
const Document = require('../models/Document');
const { extractStructuredData } = require('./geminiservice');

const PAGES_PER_CHUNK = 10;

async function splitPDFIntoChunks(filePath, totalPages) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdf(dataBuffer);
    const chunks = [];
    const numChunks = Math.ceil(totalPages / PAGES_PER_CHUNK);
    const fullText = pdfData.text;
    const avgCharsPerPage = Math.ceil(fullText.length / totalPages);

    for (let i = 0; i < numChunks; i++) {
      const startPage = (i * PAGES_PER_CHUNK) + 1;
      const endPage = Math.min(((i + 1) * PAGES_PER_CHUNK), totalPages);
      const pageCount = endPage - startPage + 1;
      const startChar = i * PAGES_PER_CHUNK * avgCharsPerPage;
      const endChar = Math.min(startChar + (pageCount * avgCharsPerPage), fullText.length);
      const chunkText = fullText.substring(startChar, endChar);

      chunks.push({
        chunkNumber: i + 1,
        startPage: startPage,
        endPage: endPage,
        pageCount: pageCount,
        extractedText: chunkText
      });
    }
    return chunks;
  } catch (error) {
    throw error;
  }
}

async function saveChunksToDatabase(documentId, chunks) {
  try {
    const savedChunks = [];
    for (const chunk of chunks) {
      const documentPage = new DocumentPage({
        documentId: documentId,
        chunkNumber: chunk.chunkNumber,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        pageCount: chunk.pageCount,
        extractedText: chunk.extractedText,
        structuredData: null,
        analysisStatus: 'pending'
      });
      const saved = await documentPage.save();
      savedChunks.push(saved);
    }
    return savedChunks;
  } catch (error) {
    throw error;
  }
}

async function analyzeChunksInBackground(chunks, documentId) {
  try {
    await Document.findByIdAndUpdate(documentId, { chunkingStatus: 'analyzing' });
    for (const chunk of chunks) {
      processChunkAnalysis(chunk._id, chunk.extractedText, chunk.chunkNumber, documentId)
        .catch(() => {});
    }
  } catch (error) {}
}

async function processChunkAnalysis(chunkId, text, chunkNumber, documentId) {
  try {
    await DocumentPage.findByIdAndUpdate(chunkId, { analysisStatus: 'processing' });
    const structuredData = await extractStructuredData(text);
    const normalizedData = normalizeChunkData(structuredData);
    await DocumentPage.findByIdAndUpdate(chunkId, {
      structuredData: normalizedData,
      analysisStatus: 'completed',
      analyzedAt: new Date()
    });
    await checkAndMergeIfComplete(documentId);
  } catch (error) {
    await DocumentPage.findByIdAndUpdate(chunkId, { analysisStatus: 'failed' });
  }
}

function normalizeChunkData(data) {
  const normalized = {
    headers: ["Date", "Description", "Amount", "Category", "Type"],
    items: [],
    summary: {}
  };
  if (!data) return normalized;
  if (Array.isArray(data.headers)) normalized.headers = data.headers;
  if (Array.isArray(data.items)) {
    normalized.items = data.items.map(item => {
      if (!item || typeof item !== 'object') return null;
      return {
        Date: item.Date || item.date || 'N/A',
        Description: item.Description || item.description || 'N/A',
        Amount: parseFloat(String(item.Amount || item.amount || 0).replace(/[^0-9.-]/g, '')) || 0,
        Category: item.Category || item.category || 'Other',
        Type: item.Type || item.type || 'Expense'
      };
    }).filter(item => item !== null);
  }
  if (data.summary && typeof data.summary === 'object') normalized.summary = data.summary;
  return normalized;
}

async function checkAndMergeIfComplete(documentId) {
  try {
    const chunks = await DocumentPage.find({ documentId });
    if (chunks.length === 0) return;
    const allCompleted = chunks.every(c => c.analysisStatus === 'completed' || c.analysisStatus === 'failed');
    if (allCompleted) {
      const mergedData = await mergeChunkData(documentId);
      await Document.findByIdAndUpdate(documentId, {
        structuredData: mergedData,
        chunkingStatus: 'completed'
      });
    }
  } catch (error) {}
}

async function getDocumentChunks(documentId) {
  try {
    const chunks = await DocumentPage.find({ documentId: documentId })
      .sort({ chunkNumber: 1 })
      .lean();
    return chunks;
  } catch (error) {
    throw error;
  }
}

async function getAnalysisStatus(documentId) {
  try {
    const chunks = await DocumentPage.find({ documentId: documentId });
    const total = chunks.length;
    const completed = chunks.filter(c => c.analysisStatus === 'completed').length;
    const processing = chunks.filter(c => c.analysisStatus === 'processing').length;
    const pending = chunks.filter(c => c.analysisStatus === 'pending').length;
    const failed = chunks.filter(c => c.analysisStatus === 'failed').length;
    return {
      total,
      completed,
      processing,
      pending,
      failed,
      percentComplete: Math.round((completed / total) * 100),
      isComplete: completed === total
    };
  } catch (error) {
    throw error;
  }
}

async function mergeChunkData(documentId) {
  try {
    const chunks = await DocumentPage.find({ documentId: documentId }).sort({ chunkNumber: 1 });
    const completedChunks = chunks.filter(c => c.analysisStatus === 'completed' && c.structuredData);
    if (completedChunks.length === 0) {
      return {
        headers: ["Date", "Description", "Amount", "Category", "Type"],
        items: [],
        summary: {
          "Document Type": "Financial Report",
          "Total Transactions": 0,
          "Total Chunks": chunks.length,
          "Completed Chunks": 0,
          "Status": "No data extracted yet"
        }
      };
    }
    const allItems = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let allHeaders = new Set(["Date", "Description", "Amount", "Category", "Type"]);
    completedChunks.forEach(chunk => {
      if (chunk.structuredData) {
        if (Array.isArray(chunk.structuredData.headers)) {
          chunk.structuredData.headers.forEach(h => allHeaders.add(h));
        }
        if (Array.isArray(chunk.structuredData.items)) {
          allItems.push(...chunk.structuredData.items);
        }
        if (chunk.structuredData.summary) {
          const income = parseFloat(chunk.structuredData.summary['Total Income']) || 0;
          const expenses = parseFloat(chunk.structuredData.summary['Total Expenses']) || 0;
          totalIncome += income;
          totalExpenses += expenses;
        }
      }
    });
    return {
      headers: Array.from(allHeaders),
      items: allItems,
      summary: {
        "Document Type": "Financial Report",
        "Total Transactions": allItems.length,
        "Total Chunks": chunks.length,
        "Completed Chunks": completedChunks.length,
        "Total Income": totalIncome,
        "Total Expenses": totalExpenses,
        "Net Amount": totalIncome - totalExpenses,
        "Currency": "INR",
        "Status": completedChunks.length === chunks.length
          ? "All chunks analyzed"
          : `${completedChunks.length}/${chunks.length} chunks completed`
      }
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  splitPDFIntoChunks,
  saveChunksToDatabase,
  analyzeChunksInBackground,
  getDocumentChunks,
  getAnalysisStatus,
  mergeChunkData,
  PAGES_PER_CHUNK
};
