import pdfParse from 'pdf-parse';
import fs from 'fs';

export const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('PDF Extraction Error:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

export const analyzeFinancialData = (text) => {
  console.log('Extracting data with correct profit calculation...');
  
  const analysis = {
    currencies: [],
    amounts: [],
    dates: [],
    accounts: [],
    transactions: []
  };

  analysis.transactions = extractTransactionsWithCorrectProfit(text);
  console.log('Final transactions with correct profit:', analysis.transactions);
  return analysis;
};

const extractTransactionsWithCorrectProfit = (text) => {
  const transactions = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    
    const dateMatch = line.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})/);
    if (dateMatch) {
      const date = dateMatch[1];
      console.log('Found date:', date);
      
      
      const financialData = extractFinancialData(lines, i, date);
      
      
      const profit = financialData.income - financialData.expenditures;
      
      transactions.push({
        date: date,
        income: financialData.income,
        expenditures: financialData.expenditures,
        profit: profit 
      });
      
      console.log('Transaction:', {
        date: date,
        income: financialData.income,
        expenditures: financialData.expenditures,
        profit: profit
      });
    }
  }
  
  return transactions;
};

const extractFinancialData = (lines, startIndex, date) => {
  let income = 0;
  let expenditures = 0;
  
  
  for (let i = startIndex; i < Math.min(startIndex + 8, lines.length); i++) {
    const line = lines[i].trim();
    
    
    if ((line.includes('income') || line.includes('amounted to')) && line.includes('INR')) {
      const incomeMatch = line.match(/INR\s+(\d+)/);
      if (incomeMatch) {
        income = parseInt(incomeMatch[1]);
        console.log('Found income:', income, 'for date:', date);
      }
    }
    
    
    if ((line.includes('expenditures') || line.includes('totaled')) && line.includes('INR')) {
      const expenseMatch = line.match(/INR\s+(\d+)/);
      if (expenseMatch) {
        expenditures = parseInt(expenseMatch[1]);
        console.log('Found expenditures:', expenditures, 'for date:', date);
      }
    }
  }
  
  return {
    income: income,
    expenditures: expenditures
  };
};