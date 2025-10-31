const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function extractStructuredData(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('PDF text is empty. Check PDF extraction before this step.');
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const fullText = text;
    const prompt = `
You are an expert financial data extraction specialist. Analyze the following document text and extract ALL financial transactions and data.

DOCUMENT TEXT:
${fullText}

IMPORTANT INSTRUCTIONS:
1. Extract ALL financial transactions, amounts, dates, descriptions
2. Return as JSON with this exact structure:
{
  "headers": ["Date", "Description", "Amount", "Category", "Type"],
  "items": [
    {"Date": "YYYY-MM-DD", "Description": "text", "Amount": number, "Category": "text", "Type": "Income/Expense"}
  ],
  "summary": {
    "Document Type": "Financial Report/Statement",
    "Total Transactions": number,
    "Total Income": number,
    "Total Expenses": number,
    "Net Amount": number,
    "Currency": "INR/USD/etc",
    "Status": "Extraction completed"
  }
}

3. Keep descriptions concise but meaningful
4. For amounts: extract numeric values only
5. For dates: use YYYY-MM-DD format
6. Return COMPLETE JSON without truncation
7. If JSON is too large, prioritize the most important transactions

Return ONLY valid JSON, no other text.`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 10,
          topP: 0.8,
          maxOutputTokens: 8192,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 90000
      }
    );

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid API response structure');
    }

    const generatedText = response.data.candidates[0].content.parts[0].text;
    let jsonText = generatedText.trim();

    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    jsonText = cleanJSONString(jsonText);
    let structuredData;

    try {
      structuredData = JSON.parse(jsonText);
    } catch {
      const repairedJSON = repairJSON(jsonText);
      try {
        structuredData = JSON.parse(repairedJSON);
      } catch {
        structuredData = await extractWithFallback(fullText, jsonText);
      }
    }

    structuredData = validateStructuredData(structuredData, fullText);
    return structuredData;

  } catch (error) {
    return {
      headers: ["Date", "Description", "Amount", "Category", "Type"],
      items: [],
      summary: {
        "Document Type": "Unknown",
        "Status": "Extraction failed",
        "Error": error.message,
        "Total Transactions": 0
      },
      fullDocumentText: text || "No document text available"
    };
  }
}

function cleanJSONString(jsonText) {
  let cleaned = jsonText
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function repairJSON(jsonText) {
  try {
    let repaired = jsonText.replace(/"([^"]*)$/, '"$1"');
    repaired = repaired.replace(/,\s*$/, '');
    repaired = repaired.replace(/(\})\s*(\{)/g, '$1,$2');
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }
    const openArrays = (repaired.match(/\[/g) || []).length;
    const closeArrays = (repaired.match(/\]/g) || []).length;
    if (openArrays > closeArrays) {
      repaired += ']'.repeat(openArrays - closeArrays);
    }
    return repaired;
  } catch {
    return jsonText;
  }
}

async function extractWithFallback(fullText, originalJSON) {
  try {
    const patterns = [
      /"items":\s*\[([\s\S]*?)\](?=,\s*"summary")/,
      /"items":\s*\[([\s\S]*?)\](?=,\s*"headers")/,
      /"items":\s*\[([\s\S]*?)\]/,
      /\[([\s\S]*?)\](?=\s*\])/
    ];
    let items = [];

    for (const pattern of patterns) {
      const match = originalJSON.match(pattern);
      if (match && match[1]) {
        try {
          const itemsStr = '[' + match[1] + ']';
          const parsedItems = JSON.parse(itemsStr);
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            items = parsedItems;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (items.length === 0) {
      const amountMatches = fullText.match(/(INR|USD|\$|₹|Rs?\.?\s*)(\d+(?:,\d+)*(?:\.\d+)?)/gi) || [];
      const dateMatches = fullText.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g) || [];
      items = amountMatches.slice(0, 10).map((match, index) => ({
        Date: dateMatches[index] || '2025-01-01',
        Description: `Financial transaction ${index + 1}`,
        Amount: parseFloat(match.replace(/[^\d.]/g, '')),
        Category: 'General',
        Type: 'Info'
      }));
    }

    return {
      headers: ["Date", "Description", "Amount", "Category", "Type"],
      items: items,
      summary: {
        "Document Type": "Financial Report",
        "Total Transactions": items.length,
        "Status": "Extraction completed via fallback",
        "Note": "Some data may be estimated"
      },
      fullDocumentText: fullText
    };
  } catch (error) {
    return {
      headers: ["Date", "Description", "Amount", "Category", "Type"],
      items: [],
      summary: {
        "Document Type": "Unknown",
        "Status": "Extraction failed",
        "Error": error.message
      },
      fullDocumentText: fullText
    };
  }
}

function validateStructuredData(data, fullText) {
  if (!data.headers || !Array.isArray(data.headers)) {
    data.headers = ["Date", "Description", "Amount", "Category", "Type"];
  }
  if (!data.items || !Array.isArray(data.items)) {
    data.items = [];
  }
  if (!data.summary || typeof data.summary !== 'object') {
    data.summary = {};
  }
  data.summary = {
    "Document Type": data.summary["Document Type"] || "Financial Report",
    "Total Transactions": data.items.length,
    "Total Income": data.summary["Total Income"] || 0,
    "Total Expenses": data.summary["Total Expenses"] || 0,
    "Net Amount": data.summary["Net Amount"] || 0,
    "Currency": data.summary["Currency"] || "INR",
    "Status": data.summary["Status"] || "Extraction completed",
    ...data.summary
  };
  if (!data.fullDocumentText) {
    data.fullDocumentText = fullText;
  }
  return data;
}

async function generateChatResponse(userMessage, documentText, structuredData, chatHistory = []) {
  try {
    const generalKeywords = [
      'hello', 'hi', 'hey', 'how are you', 'what is', 'who are you',
      'help', 'thanks', 'thank you', 'good morning', 'good afternoon',
      'what can you do', 'your name', 'introduce yourself'
    ];
    const messageLC = userMessage.toLowerCase();
    const isGeneralQuestion = generalKeywords.some(keyword => messageLC.includes(keyword));

    let systemPrompt = '';
    let contextText = '';

    if (isGeneralQuestion) {
      systemPrompt = `You are a helpful AI assistant specializing in financial document analysis. 
Answer the user's question naturally and professionally. 
Be friendly, concise, and helpful.`;
    } else {
      systemPrompt = `You are an expert financial document analyst AI assistant. 
You have access to the COMPLETE financial document and ALL extracted data.
Your role is to answer questions accurately based on ALL document content.`;

      let dataSummary = '';
      if (structuredData && structuredData.summary) {
        dataSummary = `
STRUCTURED DATA SUMMARY:
${JSON.stringify(structuredData.summary, null, 2)}

EXTRACTED TRANSACTIONS (${structuredData.items?.length || 0} total):
${JSON.stringify(structuredData.items, null, 2)}
`;
      }

      const relevantText = documentText || structuredData.fullDocumentText || '';
      contextText = `
${dataSummary}

COMPLETE DOCUMENT TEXT:
${relevantText}`;
    }

    let conversationHistory = chatHistory.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: conversationHistory,
        systemInstruction: { parts: [{ text: systemPrompt + contextText }] },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const aiResponse = response.data.candidates[0].content.parts[0].text;
    return aiResponse;
  } catch {
    return "I encountered an error while analyzing the document. Please try rephrasing your question.";
  }
}

async function testGeminiConnection() {
  try {
    await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: "Hello, are you working?" }] }] },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  extractStructuredData,
  generateChatResponse,
  testGeminiConnection
};
