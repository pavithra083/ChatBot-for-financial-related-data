import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Download,
  FileText,
  MessageSquare,
  X,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { sendChatMessage, downloadExcel } from '../services/api';

const ChatInterface = ({ documentInfo, onReset }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Successfully uploaded "${documentInfo.filename}" (${documentInfo.pages} pages). I've analyzed the financial data. You can now ask me questions about the document!`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const response = await sendChatMessage(documentInfo.documentId, userMessage);

      if (response.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.response },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request.',
          },
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      await downloadExcel(documentInfo.documentId, documentInfo.filename);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download Excel file');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Document Info Bar */}
      <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-purple-400" />
          <span className="text-white font-medium">{documentInfo.filename}</span>
          <span className="text-purple-300 text-sm">
            ({documentInfo.pages} pages)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
          >
            <BarChart3 className="w-4 h-4" />
            Analysis
          </button>
          <button
            onClick={handleDownloadExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
          <button
            onClick={onReset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm"
          >
            <X className="w-4 h-4" />
            New Doc
          </button>
        </div>
      </div>

      {/* Analysis Panel */}
      {showAnalysis && documentInfo.analysis && (
        <div className="bg-white/5 border-b border-white/10 p-4 max-h-48 overflow-y-auto">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Document Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-purple-300 text-sm">Amounts Found</p>
              <p className="text-white text-2xl font-bold">
                {documentInfo.analysis.amounts?.length || 0}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-purple-300 text-sm">Dates Found</p>
              <p className="text-white text-2xl font-bold">
                {documentInfo.analysis.dates?.length || 0}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-purple-300 text-sm">Accounts</p>
              <p className="text-white text-2xl font-bold">
                {documentInfo.analysis.accounts?.length || 0}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-purple-300 text-sm">Transactions</p>
              <p className="text-white text-2xl font-bold">
                {documentInfo.analysis.transactions?.length || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-white/10 backdrop-blur-sm text-white border border-white/20'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 text-purple-300">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-xs font-semibold">AI Assistant</span>
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-white">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white/5 border-t border-white/10 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your financial document..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-purple-300 text-xs mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;