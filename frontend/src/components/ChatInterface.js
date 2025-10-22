import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';

const ChatInterface = ({ chatHistory, setChatHistory }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = { 
      role: 'user', 
      content: inputMessage,
      timestamp: new Date().toISOString(),
      id: Date.now() + '-user'
    };
    
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/chat', {
        message: inputMessage
      }, {
        timeout: 30000
      });

      const botMessage = { 
        role: 'assistant', 
        content: response.data.answer,
        timestamp: new Date().toISOString(),
        id: Date.now() + '-assistant',
        sources: response.data.sources,
        confidence: response.data.confidence
      };
      
      setChatHistory(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: '❌ Sorry, I encountered an error processing your request. Please try again or reupload the document.',
        timestamp: new Date().toISOString(),
        id: Date.now() + '-error',
        isError: true
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exampleQuestions = [
    "What are the main financial amounts mentioned in this document?",
    "Can you list all the dates found in this PDF?",
    "What financial terms or categories are present?",
    "Summarize the key financial information from this document",
    "Are there any tables of data? What do they contain?",
    "What is the total of all amounts mentioned?",
    "Show me the range of dates covered in this document"
  ];

  const clearChat = () => {
    setChatHistory([]);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="header-content">
          <h3>💬 Document Chat Assistant</h3>
          <p>Ask questions about your financial document</p>
        </div>
        {chatHistory.length > 0 && (
          <button className="clear-chat-btn" onClick={clearChat}>
            🗑️ Clear Chat
          </button>
        )}
      </div>

      <div className="chat-messages">
        {chatHistory.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-content">
              <div className="welcome-icon">🎯</div>
              <h4>Ready to analyze your financial document!</h4>
              <p>Ask questions about amounts, dates, tables, or get a summary</p>
              <div className="example-questions">
                <p className="examples-title">Try asking:</p>
                {exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    className="example-question"
                    onClick={() => setInputMessage(question)}
                    disabled={loading}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {chatHistory.map((message) => (
              <div key={message.id} className={`message ${message.role} ${message.isError ? 'error' : ''}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? '👤' : message.isError ? '❌' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                  <div className="message-footer">
                    <span className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.confidence && (
                      <span className={`confidence ${message.confidence}`}>
                        {message.confidence === 'high' ? '✅ High confidence' : '⚠️ Low confidence'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {loading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span>Analyzing document</span>
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="scroll-anchor" />
      </div>

      <div className="chat-input-container">
        <div className="chat-input">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about financial amounts, dates, tables, or document content..."
            disabled={loading}
            rows="3"
            className="message-textarea"
          />
          <button 
            onClick={handleSendMessage} 
            disabled={loading || !inputMessage.trim()}
            className="send-button"
          >
            {loading ? (
              <div className="button-loading">
                <div className="button-spinner"></div>
                Sending...
              </div>
            ) : (
              <>
                <span>Send</span>
                <span className="send-icon">📤</span>
              </>
            )}
          </button>
        </div>
        <div className="input-hint">
          💡 Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;