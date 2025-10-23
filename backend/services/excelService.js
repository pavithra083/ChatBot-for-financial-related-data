import XLSX from 'xlsx';

export const convertPDFDataToExcel = (extractedText, analysis, outputPath) => {
  try {
    console.log('Creating properly structured Excel...');

    const workbook = XLSX.utils.book_new();

    // Create properly structured transaction data WITHOUT description column
    const transactionData = analysis.transactions.map((t) => ({
      'Date': t.date,
      'Income (INR)': t.income,
      'Expenditures (INR)': t.expenditures,
      'Profit (INR)': t.profit
    }));

    // If no proper transactions found, show message
    if (transactionData.length === 0) {
      transactionData.push({
        'Date': 'No data',
        'Income (INR)': 'No data', 
        'Expenditures (INR)': 'No data',
        'Profit (INR)': 'No data'
      });
    }

    const transactionsSheet = XLSX.utils.json_to_sheet(transactionData);
    
    transactionsSheet['!cols'] = [
      { wch: 15 }, // Date
      { wch: 15 }, // Income
      { wch: 18 }, // Expenditures
      { wch: 15 }  // Profit
    ];
    
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Daily Transactions');

    XLSX.writeFile(workbook, outputPath);
    console.log('Excel created with proper structure');
    
    return outputPath;
  } catch (error) {
    console.error('Excel Conversion Error:', error);
    throw new Error('Failed to convert to Excel');
  }
};