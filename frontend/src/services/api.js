import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


export const uploadPDF = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Upload API Error:', error);
    throw error;
  }
};

// Send chat message
export const sendChatMessage = async (documentId, message) => {
  try {
    const response = await api.post('/chat', {
      documentId,
      message,
    });
    return response.data;
  } catch (error) {
    console.error('Chat API Error:', error);
    throw error;
  }
};

// Get chat history
export const getChatHistory = async (documentId) => {
  try {
    const response = await api.get(`/chat/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Get Chat History Error:', error);
    throw error;
  }
};

// Download Excel file
export const downloadExcel = async (documentId, filename) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/download/${documentId}`, {
      responseType: 'blob',
    });

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Download Excel Error:', error);
    throw error;
  }
};

export default api;