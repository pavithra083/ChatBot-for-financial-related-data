import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, Download, FileText, MessageSquare, X, Loader2, BarChart3 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setDocumentId(data.documentId);
        setDocumentInfo({
          filename: data.filename,
          pages: data.pages,
          analysis: data.analysis
        });
        setMessages([{
          role: 'assistant',
          content: `Successfully uploaded "${data.filename}" (${data.pages} pages). I've analyzed the financial data. You can now ask me questions about the document!`
        }]);
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !documentId || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          message: userMessage
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error processing your request.' 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!documentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/download/${documentId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentInfo?.filename || 'document'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download Excel file');
    }
  };

  const handleReset = () => {
    setFile(null);
    setDocumentId(null);
    setMessages([]);
    setDocumentInfo(null);
    setShowAnalysis(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Financial PDF Analyzer</h1>
              <p className="text-purple-100 text-sm">AI-Powered Document Analysis</p>
            </div>
          </div>
          {documentId && (
            <button
              onClick={handleReset}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <X className="w-4 h-4" />
              New Document
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {!documentId ? (
            // Upload Section
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="bg-gradient-to-br from-purple-500 to-blue-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Upload className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Upload Financial PDF</h2>
                <p className="text-purple-200 mb-8">
                  Upload any financial document and ask questions about its content
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div className="space-y-4">
                  {!file ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white hover:bg-gray-100 text-purple-600 font-semibold px-8 py-4 rounded-xl flex items-center gap-3 mx-auto transition-all shadow-lg hover:shadow-xl"
                    >
                      <Upload className="w-5 h-5" />
                      Select PDF File
                    </button>
                  ) : (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 border border-white/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-purple-300" />
                          <div className="text-left">
                            <p className="text-white font-semibold">{file.name}</p>
                            <p className="text-purple-200 text-sm">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFile(null)}
                          className="text-white hover:text-red-300 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Uploading & Analyzing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5" />
                            Upload & Analyze
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Chat Section
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Document Info Bar */}
              <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-medium">{documentInfo?.filename}</span>
                  <span className="text-purple-300 text-sm">({documentInfo?.pages} pages)</span>
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
                </div>
              </div>

              {/* Analysis Panel */}
              {showAnalysis && documentInfo?.analysis && (
                <div className="bg-white/5 border-b border-white/10 p-4 max-h-48 overflow-y-auto">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    Document Analysis
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-purple-300 text-sm">Amounts Found</p>
                      <p className="text-white text-2xl font-bold">{documentInfo.analysis.amounts?.length || 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-purple-300 text-sm">Dates Found</p>
                      <p className="text-white text-2xl font-bold">{documentInfo.analysis.dates?.length || 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-purple-300 text-sm">Accounts</p>
                      <p className="text-white text-2xl font-bold">{documentInfo.analysis.accounts?.length || 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-purple-300 text-sm">Transactions</p>
                      <p className="text-white text-2xl font-bold">{documentInfo.analysis.transactions?.length || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
          )}
        </div>
      </div>
    </div>
  );
}

export default App;