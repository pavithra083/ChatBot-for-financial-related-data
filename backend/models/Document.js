import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  metadata: {
    pages: Number,
    fileSize: Number,
    mimetype: String,
    financialData: Object,
    transactions: Array,
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

documentSchema.index({ uploadedAt: -1 });
documentSchema.index({ originalName: 1 });

export default mongoose.model('Document', documentSchema);