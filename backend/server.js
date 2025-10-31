const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');


require('dotenv').config();

const connectDB = require('./config/db');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));






// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB();



// Import Routes
const uploadRoutes = require('./routes/upload');
const chatRoutes = require('./routes/chat');
const downloadRoutes = require('./routes/download'); 


// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/download', downloadRoutes); 


// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Financial Chatbot API is running',
    timestamp: new Date().toISOString()
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Financial Document Chatbot API',
    version: '1.0.0',
    endpoints: {
      upload: '/api/upload',
      chat: '/api/chat',
      download: '/api/download/:documentId',
      uploadToDrive: '/api/download/drive/:documentId', // UPDATED THIS
      documents: '/api/upload/documents',
      health: '/api/health'
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found' 
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:', err);
  res.status(500).json({ 
    success: false,
    error: err.message || 'Internal Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(60)}\n`);
});