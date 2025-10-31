const mongoose = require('mongoose');

const DocumentPageSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  chunkNumber: {
    type: Number,
    required: true
  },
  startPage: {
    type: Number,
    required: true
  },
  endPage: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
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
  analysisStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  analyzedAt: {
    type: Date
  }
});


DocumentPageSchema.index({ documentId: 1, chunkNumber: 1 });


module.exports = mongoose.models.DocumentPage || mongoose.model('DocumentPage', DocumentPageSchema);