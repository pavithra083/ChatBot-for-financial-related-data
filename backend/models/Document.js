const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  structuredData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  fileSize: {
    type: Number
  },
  pageCount: {
    type: Number
  },
  isChunked: {
    type: Boolean,
    default: false
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  chunkingStatus: {
    type: String,
    enum: ['none', 'chunked', 'analyzing', 'completed'],
    default: 'none'
  }
});


module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);