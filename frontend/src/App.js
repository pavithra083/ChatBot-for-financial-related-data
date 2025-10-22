
import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';
import DataDownload from './components/DataDownload';
import './App.css';

function App() {
  const [currentDocument, setCurrentDocument] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>📊 Financial PDF Chatbot</h1>
        <p>Upload financial documents and get instant insights</p>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <FileUpload onDocumentProcessed={setCurrentDocument} />
        </div>

        {currentDocument && (
          <>
            <div className="document-info">
              <h3>📄 Active Document</h3>
              <p><strong>File:</strong> {currentDocument.filename}</p>
              <p><strong>Pages:</strong> {currentDocument.pages}</p>
              <p><strong>Tables Found:</strong> {currentDocument.tables_found}</p>
            </div>

            <div className="chat-section">
              <ChatInterface 
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
              />
            </div>

            <div className="export-section">
              <DataDownload />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;