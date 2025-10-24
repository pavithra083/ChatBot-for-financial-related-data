import pdfParse from 'pdf-parse';
import Document from '../models/Document.js';

export const extractTextFromPDF = async (fileBuffer) => {
  try {
    const data = await pdfParse(fileBuffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    throw new Error('Failed to extract text from PDF');
  }
};

export const savePDFToMongoDB = async (file, extractedData, financialAnalysis) => {
  try {
    const newDocument = new Document({
      filename: `${file.originalname}_${Date.now()}`,
      originalName: file.originalname,
      fileSize: file.size,
      extractedText: extractedData.text,
      metadata: {
        pages: extractedData.pages,
        fileSize: file.size,
        mimetype: file.mimetype,
        financialData: financialAnalysis,
        transactions: financialAnalysis.transactions,
        processedAt: new Date()
      }
    });

    const savedDocument = await newDocument.save();
    console.log('📄 PDF saved to MongoDB with ID:', savedDocument._id);
    return savedDocument;
  } catch (error) {
    throw error;
  }
};

export const processAndAnalyzePDF = async (fileBuffer, originalName) => {
  try {
    const extractedData = await extractTextFromPDF(fileBuffer);
    const financialAnalysis = analyzeFinancialData(extractedData.text);
    
    const fileInfo = {
      buffer: fileBuffer,
      originalname: originalName,
      size: fileBuffer.length,
      mimetype: 'application/pdf'
    };
    
    const savedDocument = await savePDFToMongoDB(fileInfo, extractedData, financialAnalysis);
    
    return {
      documentId: savedDocument._id,
      extractedData: extractedData,
      financialAnalysis: financialAnalysis,
      mongoDocument: savedDocument
    };
    
  } catch (error) {
    throw error;
  }
};

export const analyzeFinancialData = (text) => {
  const analysis = {
    currencies: extractCurrencies(text),
    amounts: extractAllAmounts(text),
    dates: extractAllDates(text),
    accounts: extractAccountReferences(text),
    transactions: extractFullyDynamicTransactions(text)
  };
  
  return analysis;
};

const extractFullyDynamicTransactions = (text) => {
  
  const tableTransactions = extractTableData(text);
  if (tableTransactions.length > 0) {
    console.log('📊 Table detection found:', tableTransactions.length, 'transactions');
    return tableTransactions;
  }
  
 
  const transactions = [];
  const lines = text.split('\n');
  let currentTransaction = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const date = extractAnyDate(line);
    if (date) {
      if (Object.keys(currentTransaction).length > 0) {
        transactions.push(currentTransaction);
      }
      currentTransaction = { date };
    }
    
    const financialData = extractAnyFinancialData(line);
    if (financialData && Object.keys(currentTransaction).length > 0) {
      currentTransaction = { ...currentTransaction, ...financialData };
    }
  }
  
  if (Object.keys(currentTransaction).length > 0) {
    transactions.push(currentTransaction);
  }
  
  console.log('📝 Line-by-line extraction found:', transactions.length, 'transactions');
  return transactions;
};

const extractTableData = (text) => {
  const transactions = [];
  const lines = text.split('\n');
  
  let inTableSection = false;
  let headerFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    
    if ((line.includes('Date') && (line.includes('Income') || line.includes('Revenue') || line.includes('Salary'))) || 
        (line.includes('Date') && (line.includes('Expenditure') || line.includes('Expense') || line.includes('Spending')))) {
      inTableSection = true;
      headerFound = true;
      continue;
    }
    
    if (inTableSection && line && !line.includes('---') && !line.includes('===')) {
      
      const rowData = extractTableRow(line);
      if (rowData && rowData.date && (rowData.income > 0 || rowData.expenditures > 0)) {
        
        if (!rowData.profit && rowData.income && rowData.expenditures) {
          rowData.profit = rowData.income - rowData.expenditures;
        }
        rowData.source = 'table_detection';
        transactions.push(rowData);
      }
    }
    
    
    if (inTableSection && (!line || line.includes('---') || i === lines.length - 1)) {
      inTableSection = false;
    }
  }
  
  return transactions;
};

const extractTableRow = (line) => {
  
  const columns = line.split(/\s{2,}|\t/).filter(col => col.trim());
  
  if (columns.length >= 3) {
    const transaction = {
      date: extractAnyDate(columns[0]) || columns[0]?.trim(),
      income: 0,
      expenditures: 0,
      profit: 0
    };
    
    
    const numericValues = [];
    for (let i = 1; i < columns.length; i++) {
      const amount = parseFloat(columns[i].replace(/,/g, '')) || 0;
      
      if (amount > 100 && amount !== 2025 && amount !== 2024 && amount !== 2023) {
        numericValues.push(amount);
      }
    }
    
    
    if (numericValues.length >= 2) {
    
      transaction.income = numericValues[0];
      
     
      if (numericValues.length >= 2) {
        transaction.expenditures = numericValues[1];
      }
      
      
      if (numericValues.length >= 3) {
        transaction.profit = numericValues[2];
      }
    }
    
    
    for (let i = 1; i < columns.length; i++) {
      const col = columns[i].trim();
      const amount = parseFloat(col.replace(/,/g, '')) || 0;
      if (!amount && col.length > 10 && col.length < 100) {
        transaction.description = col;
        break;
      }
    }
    
    return transaction;
  }
  
  return null;
};

const extractAnyDate = (line) => {
  const datePatterns = [
    /(\d{1,2}-[A-Za-z]{3}-\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /([A-Za-z]+ \d{1,2}, \d{4})/,
    /(\d{1,2}\.[A-Za-z]{3}\.\d{4})/,
    /(\d{1,2} [A-Za-z]+ \d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = line.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const extractAnyFinancialData = (line) => {
  const financialData = {};
  
  
  const amountPatterns = [
    /(?:INR|USD|EUR|GBP|CAD|AUD|JPY|CNY)\s*[:]?\s*([\d,]+)/gi,
    /[\$€£₹¥]?\s*([\d,]+\.?\d*)\s*[\$€£₹¥]?/g,
    /(?:amount|total|value|balance|sum|payment|fee|charge|cost|price)[:\s]*([\d,]+\.?\d*)/gi,
    /([\d,]+\.?\d*)\s*(?:dollars|euros|pounds|rupees|yen)/gi
  ];
  
  for (const pattern of amountPatterns) {
    const matches = [...line.matchAll(pattern)];
    matches.forEach(match => {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      
      if (!isNaN(amount) && amount > 100 && amount !== 2025 && amount !== 2024 && amount !== 2023) {
        const category = detectAmountCategory(line, amount);
        if (category !== 'ignore') {
          financialData[category] = amount;
        }
      }
    });
  }
  
  
  const description = extractFinancialDescription(line);
  if (description) {
    financialData.description = description;
  }
  
  return Object.keys(financialData).length > 0 ? financialData : null;
};

const detectAmountCategory = (line, amount) => {
  const lineLower = line.toLowerCase();
  
  
  if (amount === 2025 || amount === 2024 || amount === 2023) {
    return 'ignore';
  }
  
  
  const incomeKeywords = ['income', 'revenue', 'salary', 'earnings', 'payment received', 'deposit', 'credit', 'received', 'revenue:', 'income:'];
  if (incomeKeywords.some(keyword => lineLower.includes(keyword))) {
    return 'income';
  }
  
  
  const expenseKeywords = ['expenditure', 'expense', 'spending', 'cost', 'payment', 'fee', 'charge', 'debit', 'withdrawal', 'bill', 'expenditures:'];
  if (expenseKeywords.some(keyword => lineLower.includes(keyword))) {
    return 'expenditures';
  }
  
  
  const profitKeywords = ['profit', 'net', 'balance', 'surplus', 'gain', 'profit:', 'net profit'];
  if (profitKeywords.some(keyword => lineLower.includes(keyword))) {
    return 'profit';
  }
  
  return 'amount';
};

const extractFinancialDescription = (line) => {
  const cleanLine = line.replace(/[\d$,€£₹¥]/g, '').trim();
  
  if (cleanLine.length > 5 && cleanLine.length < 100 && 
      !cleanLine.match(/^\s*[-\*•]\s*/) && 
      cleanLine !== cleanLine.toUpperCase()) {
    return cleanLine;
  }
  return null;
};

const extractCurrencies = (text) => {
  const currencyPattern = /(INR|USD|EUR|GBP|CAD|AUD|JPY|CNY|\$|€|£|₹|¥)/gi;
  return [...new Set(text.match(currencyPattern) || [])];
};

const extractAllAmounts = (text) => {
  return text.match(/[\d,]+\.?\d*/g) || [];
};

const extractAllDates = (text) => {
  const datePattern = /(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]+ \d{1,2}, \d{4}|\d{1,2}\.[A-Za-z]{3}\.\d{4}|\d{1,2} [A-Za-z]+ \d{4})/gi;
  return text.match(datePattern) || [];
};

const extractAccountReferences = (text) => {
  const accountPattern = /(account|acct|acc|iban|number)[:\s]*([A-Za-z0-9\-]+)/gi;
  const matches = [...text.matchAll(accountPattern)];
  return matches.map(match => match[2]);
};