import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const analyzeDocumentStructure = async (pdfText) => {
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analyze this document and determine:
1. What type of financial/business document is this?
2. What are the main data tables/structures?
3. What column names would make sense for Excel export?

Return JSON with:
{
  "documentType": "invoice|transaction_report|balance_sheet|investment_portfolio|unknown",
  "recommendedSheets": [
    {
      "sheetName": "string",
      "columns": ["string"],
      "data": [{"values": ["string"]}]
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyze this document:\n\n${pdfText.substring(0, 10000)}`
          }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('AI Analysis Error:', error);
    return getFallbackStructure(pdfText);
  }
};

const getFallbackStructure = (text) => {
  // Completely generic fallback - no assumptions
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  return {
    documentType: 'generic',
    recommendedSheets: [
      {
        sheetName: 'Document Content',
        columns: ['Line Number', 'Content'],
        data: lines.map((line, index) => ({ values: [index + 1, line] }))
      }
    ]
  };
};

