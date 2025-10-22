import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './FileUpload.css';

const FileUpload = ({ onDocumentProcessed }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      await handleFileUpload(file);
    } else {
      setMessage('❌ Please select a valid PDF file');
      setTimeout(() => setMessage(''), 3000);
    }
  }, [onDocumentProcessed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleFileUpload = async (file) => {
    setUploading(true);
    setMessage('🔄 Processing PDF document...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds timeout
      });

      setMessage('✅ PDF processed successfully! Ready for analysis.');
      onDocumentProcessed(response.data);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Upload error:', error);
      let errorMessage = '❌ Error processing PDF. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = '❌ Request timeout. The file might be too large.';
      } else if (error.response?.status === 413) {
        errorMessage = '❌ File too large. Please upload a PDF under 50MB.';
      } else if (error.response?.data?.detail) {
        errorMessage = `❌ ${error.response.data.detail}`;
      }
      
      setMessage(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <div
        {...getRootProps()}
        className={`drop-zone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="upload-content">
          {uploading ? (
            <div className="uploading-state">
              <div className="spinner"></div>
              <p>Processing PDF...</p>
              <small>This may take a moment for larger files</small>
            </div>
          ) : (
            <>
              <div className="upload-icon">📁</div>
              {isDragActive ? (
                <div className="drag-active">
                  <p>Drop the PDF here to upload</p>
                </div>
              ) : (
                <div className="upload-instructions">
                  <p><strong>Drag & drop a financial PDF here</strong></p>
                  <p>or click to browse files</p>
                  <div className="supported-files">
                    <small>Supported: Bank statements, invoices, financial reports</small>
                    <small>Max size: 50MB</small>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {message && (
        <div className={`upload-message ${message.includes('❌') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default FileUpload;