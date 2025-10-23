import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const generateChatResponse = async (userQuery, documentContext, chatHistory = []) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a financial data analysis assistant. You have access to the following financial document content:

${documentContext}

Analyze this data and answer user questions accurately. Focus on:
- Financial figures and amounts
- Transaction details
- Dates and timelines
- Account information
- Trends and patterns

Provide clear, concise, and accurate responses based on the document content.`
      },
      ...chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userQuery
      }
    ];

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: 'openai/gpt-4o',
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Financial Chatbot'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    throw new Error('Failed to generate response from AI');
  }
};