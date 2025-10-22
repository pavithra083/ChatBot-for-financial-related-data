import React, { useState } from 'react';
import axios from 'axios';
import './DataDownload.css';

const DataDownload = () => {
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadMessage('🔄 Preparing Excel file...');
    
    try {
      const response = await axios.get('http://localhost:8000/download/excel', {
        responseType: 'blob',
        timeout: 30000
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'financial_analysis.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setDownloadMessage('✅ Excel file downloaded successfully!');
      setTimeout(() => setDownloadMessage(''), 3000);
    } catch (error) {
      console.error('Download error:', error);
      let errorMessage = '❌ Error downloading file. Please try again.';
      
      if (error.response?.status === 400) {
        errorMessage = '❌ No document available. Please upload a PDF first.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = '❌ Download timeout. Please try again.';
      }
      
      setDownloadMessage(errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="data-download">
      <div className="download-card">
        <div className="download-header">
          <div className="download-icon">📊</div>
          <div className="download-info">
            <h4>Export Financial Analysis</h4>
            <p>Download extracted financial data as Excel spreadsheet with detailed insights</p>
          </div>
        </div>
        
        <div className="download-features">
          <div className="feature-item">
            <span className="feature-icon">💰</span>
            <span>Financial amounts and totals</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📅</span>
            <span>Date ranges and timelines</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📋</span>
            <span>Extracted tables and data</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📈</span>
            <span>Document analysis summary</span>
          </div>
        </div>

        <button 
          onClick={handleDownload} 
          disabled={downloading}
          className={`download-button ${downloading ? 'downloading' : ''}`}
        >
          {downloading ? (
            <div className="download-loading">
              <div className="download-spinner"></div>
              <span>Generating Excel File...</span>
            </div>
          ) : (
            <div className="download-ready">
              <span>Download Excel Report</span>
              <span className="download-arrow">📥</span>
            </div>
          )}
        </button>

        {downloadMessage && (
          <div className={`download-message ${downloadMessage.includes('❌') ? 'error' : 'success'}`}>
            {downloadMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataDownload;