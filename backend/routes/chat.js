const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const { generateChatResponse } = require('../services/geminiservice');
const auth = require('../middleware/auth');

// Apply auth middleware to all chat routes
router.use(auth);

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user._id;
  
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Chat ID and message are required' 
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`💬 CHAT REQUEST FROM USER: ${userId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`💬 Chat ID: ${chatId}`);
    console.log(`👤 User Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    console.log(`📝 Message Length: ${message.length} characters`);

    // Find chat and verify user ownership
    const chat = await Chat.findOne({ _id: chatId, userId }).populate('documentId');
    
    if (!chat) {
      console.log('❌ Chat not found or access denied');
      return res.status(404).json({ 
        success: false,
        error: 'Chat not found' 
      });
    }

    const document = chat.documentId;
    console.log(`📄 Document ID: ${document._id}`);
    console.log(`📄 Document Name: ${document.originalName}`);
    
    const hasStructuredData = document.structuredData && document.structuredData.items;
    if (!hasStructuredData) {
      console.log(`⚠️  Note: Structured data still processing in background`);
    } else {
      console.log(`✅ Structured data available: ${document.structuredData.items.length} items`);
    }

    chat.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    console.log(`\n🤖 Generating AI Response...`);
    const aiStartTime = Date.now();
    
    const structuredDataToUse = document.structuredData || null;
    
    const aiResponse = await generateChatResponse(
      message, 
      document.extractedText,
      structuredDataToUse,
      chat.messages.slice(-6)
    );

    const responseTime = Date.now() - startTime;
    const aiProcessTime = Date.now() - aiStartTime;

    chat.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
      responseTime: responseTime
    });

    await chat.save();

    const performanceStatus = responseTime < 1900 ? '✅ FAST' : '⚠️  SLOW';
    const performanceIcon = responseTime < 1000 ? '🚀' : responseTime < 1900 ? '⚡' : '🐌';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ RESPONSE GENERATED SUCCESSFULLY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`${performanceIcon} Total Response Time: ${(responseTime / 1000).toFixed(2)}s (${responseTime}ms)`);
    console.log(`🤖 AI Processing Time: ${(aiProcessTime / 1000).toFixed(2)}s`);
    console.log(`📊 Performance Status: ${performanceStatus}`);
    console.log(`💬 Response Length: ${aiResponse.length} characters`);
    console.log(`📝 Total Messages in Chat: ${chat.messages.length}`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      success: true,
      response: aiResponse,
      responseTime: responseTime,
      chatId: chat._id,
      documentId: document._id,
      messageCount: chat.messages.length
    });

  } catch (error) {
    const errorTime = Date.now() - startTime;
    
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ CHAT ERROR');
    console.error(`${'='.repeat(60)}`);
    console.error('Error Message:', error.message);
    console.error('Error Time:', (errorTime / 1000).toFixed(2) + 's');
    console.error('Stack:', error.stack);
    console.error(`${'='.repeat(60)}\n`);
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    
    console.log(`\n📋 Fetching chat history for ID: ${chatId} (User: ${userId})`);
    
    const chat = await Chat.findOne({ _id: chatId, userId }).populate('documentId');
    
    if (!chat) {
      console.log('❌ Chat not found or access denied');
      return res.status(404).json({ 
        success: false,
        error: 'Chat not found' 
      });
    }

    console.log(`✅ Found ${chat.messages.length} messages`);

    res.json({
      success: true,
      chatId: chat._id,
      documentId: chat.documentId._id,
      documentName: chat.documentId.originalName,
      messages: chat.messages,
      messageCount: chat.messages.length,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    });

  } catch (error) {
    console.error('❌ Error fetching chat:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.delete('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    
    console.log(`\n🗑️  Deleting chat: ${chatId} (User: ${userId})`);
    
    const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        error: 'Chat not found' 
      });
    }

    console.log(`✅ Chat deleted successfully`);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting chat:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/document/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user._id;
    
    // Verify document belongs to user
    const document = await Document.findOne({ _id: documentId, userId });
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const chats = await Chat.find({ documentId: documentId, userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: chats.length,
      chats: chats
    });

  } catch (error) {
    console.error('❌ Error fetching chats:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;