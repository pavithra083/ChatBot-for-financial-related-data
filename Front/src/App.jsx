import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';

// Import authentication components
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import ProtectedRoute from './components/common/ProtectedRoute';

const API_BASE_URL = 'http://localhost:5000/api';

// Main App Component with Authentication
function AppWithAuth() {
  const { currentUser, login, logout } = useAuth();
  const [authView, setAuthView] = useState('login');
  const [currentPage, setCurrentPage] = useState('upload');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [driveLink, setDriveLink] = useState(null);
  const [showDownloadAnimation, setShowDownloadAnimation] = useState(false);
  const [showDriveAnimation, setShowDriveAnimation] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Authentication handlers
  const handleLogin = (user) => {
    login(user);
  };

  const handleLogout = () => {
    logout();
    setAuthView('login');
    // Reset all app state
    setCurrentPage('upload');
    setFile(null);
    setDocumentId(null);
    setChatId(null);
    setMessages([]);
    setDocumentInfo(null);
    setDriveLink(null);
    setDownloadedFile(null);
  };

  const handleSignup = (user) => {
    login(user);
  };

  // Your existing file handlers
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      showNotification('Please select a PDF file', 'error');
    }
  };

  const handleUpload = async () => {
    if (!file) return showNotification('Select a file first', 'error');

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData);
      setDocumentId(res.data.documentId);
      setChatId(res.data.chatId);
      setDocumentInfo({
        filename: res.data.filename,
        pageCount: res.data.pageCount,
        processingTime: res.data.processingTime
      });
      setMessages([{
        role: 'assistant',
        content: `Document "${res.data.filename}" uploaded successfully! I've analyzed ${res.data.pageCount} pages. Feel free to ask me anything!`,
        timestamp: new Date()
      }]);
      showNotification('Document Uploaded Successfully!', 'success');
      setCurrentPage('chat');
    } catch (err) {
      showNotification('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatId) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);

    try {
      const res = await axios.post(`${API_BASE_URL}/chat`, { chatId, message: userMsg });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
        responseTime: res.data.responseTime
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error occurred. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!documentId) return;

    setShowDownloadAnimation(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/download/${documentId}`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const fileName = `${documentInfo.filename.replace('.pdf', '')}_extracted.xlsx`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      setDownloadedFile({
        url: url,
        name: fileName,
        size: blob.size
      });
      
      setTimeout(() => {
        setShowDownloadAnimation(false);
        showNotification('Excel Downloaded Successfully!', 'success');
      }, 2000);
    } catch {
      setShowDownloadAnimation(false);
      showNotification('Download failed', 'error');
    }
  };

  const handleUploadToDrive = async () => {
    if (!documentId) return;

    setShowDriveAnimation(true);
    setUploadingToDrive(true);
    setDriveLink(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/download/drive/${documentId}`);

      if (res.data.success) {
        const link = res.data.driveLink;
        setDriveLink(link);

        setShowDriveAnimation(false);
        showNotification('Uploaded to Google Drive!', 'success');

        setTimeout(() => {
          window.open(link, '_blank');
        }, 800);
      }
    } catch (err) {
      setShowDriveAnimation(false);
      showNotification('Drive upload failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setTimeout(() => setUploadingToDrive(false), 1000);
    }
  };

  const handleNewDocument = () => {
    setFile(null);
    setDocumentId(null);
    setChatId(null);
    setMessages([]);
    setDocumentInfo(null);
    setDriveLink(null);
    setDownloadedFile(null);
    setCurrentPage('upload');
  };

  // Render authentication screens if not logged in
  if (!currentUser) {
    switch (authView) {
      case 'login':
        return (
          <Login 
            onLogin={handleLogin}
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToForgotPassword={() => setAuthView('forgot')}
          />
        );
      case 'signup':
        return (
          <Signup 
            onSignup={handleSignup}
            onSwitchToLogin={() => setAuthView('login')}
          />
        );
      case 'forgot':
        return (
          <ForgotPassword 
            onSwitchToLogin={() => setAuthView('login')}
            onSwitchToReset={() => setAuthView('reset')}
          />
        );
      case 'reset':
        return (
          <ResetPassword 
            onSwitchToLogin={() => setAuthView('login')}
          />
        );
      default:
        return <Login onLogin={handleLogin} />;
    }
  }

  // Your existing main app UI (protected by authentication)
  return (
    <ProtectedRoute>
      <div className="App">
        {showDownloadAnimation && (
          <div className="animation-overlay">
            <div className="animation-content">
              <div className="animation-spinner"></div>
              <div className="animation-icon">📊</div>
              <h3>Downloading Excel File...</h3>
              <div className="animation-progress-bar">
                <div className="animation-progress-fill excel-progress"></div>
              </div>
            </div>
          </div>
        )}

        {showDriveAnimation && (
          <div className="animation-overlay drive-overlay">
            <div className="animation-content">
              <div className="animation-spinner drive-spinner"></div>
              <div className="animation-icon">☁️</div>
              <h3>Uploading to Google Drive...</h3>
              <div className="animation-progress-bar">
                <div className="animation-progress-fill drive-progress"></div>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <div className={`notification-toast ${notification.type}`}>
            <div className="notification-content">
              <span className="notification-message">{notification.message}</span>
            </div>
          </div>
        )}

        <div className="background-particles">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="particle"></div>
          ))}
        </div>

        <div className="page-container">
          <header className="page-header">
            <div className="header-icon">💼</div>
            <h1>Financial Document AI Chatbot</h1>
            <p>Upload • Analyze • Chat • Export</p>
            <div className="user-info">
              <span>Welcome, {currentUser.name}</span>
              <button onClick={handleLogout} className="btn btn-outline btn-small">
                Logout
              </button>
            </div>
          </header>

          <div className="navigation-tabs">
            <button 
              className={`nav-tab ${currentPage === 'upload' ? 'active' : ''} ${documentId ? 'completed' : ''}`}
              onClick={() => setCurrentPage('upload')}
            >
              <span className="tab-number">1</span>
              <span className="tab-text">Upload Document</span>
              {documentId && <span className="check-icon">✓</span>}
            </button>
            
            <button 
              className={`nav-tab ${currentPage === 'chat' ? 'active' : ''} ${!documentId ? 'locked' : ''}`}
              onClick={() => documentId && setCurrentPage('chat')}
              disabled={!documentId}
            >
              {!documentId && <span className="lock-icon">🔒</span>}
              <span className="tab-number">2</span>
              <span className="tab-text">Chat with AI</span>
            </button>
            
            <button 
              className={`nav-tab ${currentPage === 'export' ? 'active' : ''} ${!documentId ? 'locked' : ''}`}
              onClick={() => documentId && setCurrentPage('export')}
              disabled={!documentId}
            >
              {!documentId && <span className="lock-icon">🔒</span>}
              <span className="tab-number">3</span>
              <span className="tab-text">Export Data</span>
            </button>
          </div>

          <div className="page-content">
            
            {currentPage === 'upload' && (
              <div className="page-section">
                <div className="page-card">
                  <div className="card-header">
                    <h2>
                      <span className="card-icon">📤</span>
                      Upload Your Document
                    </h2>
                    <p>Select a PDF file to analyze with AI</p>
                  </div>

                  <div className="file-upload-area">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleFileChange} 
                      disabled={uploading} 
                      id="file-input" 
                    />
                    <label htmlFor="file-input" className={`file-label ${file ? 'has-file' : ''}`}>
                      <div className="upload-icon-large">
                        {file ? '✅' : '📁'}
                      </div>
                      <div className="upload-text">
                        {file ? (
                          <>
                            <h3>{file.name}</h3>
                            <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </>
                        ) : (
                          <>
                            <h3>Click to Select PDF</h3>
                            <p>or drag and drop here</p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  {file && !documentId && (
                    <button 
                      onClick={handleUpload} 
                      disabled={uploading} 
                      className="btn btn-large btn-primary"
                    >
                      {uploading ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Uploading & Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">🚀</span>
                          <span>Upload & Analyze Document</span>
                        </>
                      )}
                    </button>
                  )}

                  {documentInfo && (
                    <div className="success-section">
                      <div className="success-banner">
                        <div className="success-icon">✓</div>
                        <div className="success-text">
                          <h3>Upload Successful!</h3>
                          <p>Your document has been analyzed</p>
                        </div>
                      </div>

                      <div className="document-stats">
                        <div className="stat-card">
                          <div className="stat-icon">📄</div>
                          <div className="stat-info">
                            <div className="stat-label">Filename</div>
                            <div className="stat-value">{documentInfo.filename}</div>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon">📃</div>
                          <div className="stat-info">
                            <div className="stat-label">Pages</div>
                            <div className="stat-value">{documentInfo.pageCount}</div>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon">⏱️</div>
                          <div className="stat-info">
                            <div className="stat-label">Processing Time</div>
                            <div className="stat-value">{(documentInfo.processingTime / 1000).toFixed(2)}s</div>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setCurrentPage('chat')} 
                        className="btn btn-large btn-success"
                      >
                        <span className="btn-icon">💬</span>
                        <span>Continue to Chat</span>
                        <span className="btn-arrow">→</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentPage === 'chat' && (
              <div className="page-section">
                <div className="page-card chat-card-full">
                  <div className="card-header">
                    <h2>
                      <span className="card-icon">💬</span>
                      Chat with AI Assistant
                    </h2>
                    <p>Document: {documentInfo?.filename}</p>
                  </div>

                  <div className="messages-area">
                    {messages.map((msg, i) => (
                      <div key={i} className={`chat-message ${msg.role}`}>
                        <div className="message-avatar">
                          {msg.role === 'user' ? '👤' : '🤖'}
                        </div>
                        <div className="message-bubble">
                          <div className="message-header">
                            <span className="message-sender">
                              {msg.role === 'user' ? 'You' : 'AI Assistant'}
                            </span>
                            {msg.responseTime && (
                              <span className="message-time">
                                {(msg.responseTime / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                          <div className="message-text">{msg.content}</div>
                          <div className="message-timestamp">
                            {msg.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="chat-message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-bubble typing-bubble">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="chat-input-area">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask anything about your document..."
                      disabled={sending}
                      className="chat-input-large"
                    />
                    <button 
                      type="submit" 
                      disabled={sending || !inputMessage.trim()} 
                      className="btn btn-send-large"
                    >
                      {sending ? (
                        <span className="btn-spinner"></span>
                      ) : (
                        <>
                          <span className="btn-icon">📨</span>
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </form>

                  <div className="page-actions">
                    <button onClick={() => setCurrentPage('export')} className="btn btn-secondary">
                      <span className="btn-icon">📊</span>
                      <span>Continue to Export</span>
                      <span className="btn-arrow">→</span>
                    </button>
                    <button onClick={handleNewDocument} className="btn btn-outline">
                      <span className="btn-icon">📄</span>
                      <span>Upload New Document</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'export' && (
              <div className="page-section">
                <div className="page-card">
                  <div className="card-header">
                    <h2>
                      <span className="card-icon">📊</span>
                      Export Your Data
                    </h2>
                    <p>Download or sync to cloud storage</p>
                  </div>

                  <div className="export-options">
                    <div className="export-card">
                      <div className="export-icon">📥</div>
                      <h3>Download Excel File</h3>
                      <p>Get your analyzed data in Excel format</p>
                      <button 
                        onClick={handleDownloadExcel} 
                        className="btn btn-large btn-download"
                        disabled={showDownloadAnimation}
                      >
                        <span className="btn-icon">📊</span>
                        <span>Download Excel</span>
                        <span className="btn-arrow">↓</span>
                      </button>

                      {downloadedFile && (
                        <div className="file-preview-box">
                          <div className="preview-header">
                            <div className="preview-icon">📊</div>
                            <div className="preview-info">
                              <div className="preview-name">{downloadedFile.name}</div>
                              <div className="preview-size">{(downloadedFile.size / 1024).toFixed(2)} KB</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="export-card">
                      <div className="export-icon">☁️</div>
                      <h3>Upload to Google Drive</h3>
                      <p>Sync your file to cloud storage</p>
                      <button
                        onClick={handleUploadToDrive}
                        disabled={uploadingToDrive}
                        className="btn btn-large btn-drive"
                      >
                        <span className="btn-icon">☁️</span>
                        <span>{uploadingToDrive ? 'Uploading...' : 'Upload to Drive'}</span>
                        {!uploadingToDrive && <span className="btn-arrow">↗</span>}
                      </button>
                      
                      {driveLink && (
                        <div className="file-preview-box">
                          <div className="preview-header">
                            <div className="success-check">✓</div>
                            <div className="preview-info">
                              <div className="preview-name">Uploaded Successfully!</div>
                              <div className="preview-size">Synced to Google Drive</div>
                            </div>
                          </div>
                          <a 
                            href={driveLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-open-file"
                          >
                            <span className="btn-icon">🔗</span>
                            <span>Open in Drive</span>
                            <span className="btn-arrow">→</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="page-actions">
                    <button onClick={() => setCurrentPage('chat')} className="btn btn-outline">
                      <span className="btn-arrow">←</span>
                      <span>Back to Chat</span>
                    </button>
                    <button onClick={handleNewDocument} className="btn btn-primary">
                      <span className="btn-icon">📄</span>
                      <span>Upload New Document</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Main App component that wraps with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

export default App;