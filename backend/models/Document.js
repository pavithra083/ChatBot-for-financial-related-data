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
  path: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Document', documentSchema);