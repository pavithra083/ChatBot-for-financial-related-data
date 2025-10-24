import ExcelJS from 'exceljs';

export const convertPDFDataToExcel = async (extractedText, financialAnalysis, outputPath) => {
  try {
    console.log('Creating dynamic Excel structure from MongoDB data...');
    console.log('Financial analysis from DB:', financialAnalysis);

    const workbook = new ExcelJS.Workbook();
    
    const transactionsSheet = workbook.addWorksheet('Financial Transactions');
    
    const transactions = financialAnalysis?.transactions || [];
    
    if (transactions.length > 0) {
      const allKeys = new Set();
      transactions.forEach(transaction => {
        Object.keys(transaction).forEach(key => allKeys.add(key));
      });
      
      const dynamicColumns = Array.from(allKeys).map(key => ({
        header: key.charAt(0).toUpperCase() + key.slice(1), 
        key: key,
        width: 18
      }));
      
      transactionsSheet.columns = dynamicColumns;
      
      transactions.forEach(transaction => {
        const rowData = {};
        dynamicColumns.forEach(col => {
          rowData[col.key] = transaction[col.key] || ''; 
        });
        transactionsSheet.addRow(rowData);
      });
      
      console.log(`Added ${transactions.length} transactions with columns:`, Array.from(allKeys));
    } else {
      transactionsSheet.columns = [
        { header: 'Information', key: 'info', width: 50 }
      ];
      transactionsSheet.addRow({ info: 'No transaction data extracted from PDF' });
    }

    const summarySheet = workbook.addWorksheet('Analysis Summary');
    
    const analysisData = { ...financialAnalysis };
    delete analysisData.transactions;
    
    summarySheet.columns = [
      { header: 'Data Category', key: 'category', width: 25 },
      { header: 'Values', key: 'values', width: 40 }
    ];

    if (Object.keys(analysisData).length > 0) {
      Object.entries(analysisData).forEach(([category, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          summarySheet.addRow({
            category: category,
            values: values.join(', ')
          });
        } else if (typeof values === 'object' && values !== null) {
          summarySheet.addRow({
            category: category,
            values: JSON.stringify(values)
          });
        } else {
          summarySheet.addRow({
            category: category,
            values: String(values)
          });
        }
      });
    } else {
      summarySheet.addRow({
        category: 'No additional analysis data',
        values: 'Only transaction data available'
      });
    }

    const textSheet = workbook.addWorksheet('Extracted Text');
    textSheet.columns = [
      { header: 'Content Line', key: 'line', width: 100 }
    ];

    const textLines = extractedText.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.trim());
    
    textLines.forEach((line, index) => {
      textSheet.addRow({ line: line });
    });

    const metadataSheet = workbook.addWorksheet('Document Metadata');
    
    metadataSheet.columns = [
      { header: 'Property', key: 'property', width: 25 },
      { header: 'Value', key: 'value', width: 30 }
    ];

    metadataSheet.addRow({ property: 'Total Transactions', value: transactions.length });
    metadataSheet.addRow({ property: 'Text Lines Extracted', value: textLines.length });
    metadataSheet.addRow({ property: 'Analysis Categories', value: Object.keys(analysisData).length });
    metadataSheet.addRow({ property: 'Generated At', value: new Date().toISOString() });

    const sheets = [transactionsSheet, summarySheet, textSheet, metadataSheet];
    
    sheets.forEach(sheet => {
      if (sheet.rowCount > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '2F75B5' }
        };
        
        sheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 0;
            if (cellLength > maxLength) {
              maxLength = cellLength;
            }
          });
          column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        });
      }
    });

    console.log('Dynamic Excel file created, saving...');
    
    await workbook.xlsx.writeFile(outputPath);
    console.log('Dynamic Excel file saved successfully:', outputPath);

    return {
      success: true,
      filePath: outputPath,
      sheets: workbook.worksheets.map(sheet => sheet.name),
      transactionCount: transactions.length,
      columnsUsed: transactions.length > 0 ? Array.from(new Set(transactions.flatMap(t => Object.keys(t)))) : []
    };

  } catch (error) {
    console.error('Dynamic Excel conversion error:', error);
    throw new Error(`Failed to create dynamic Excel file: ${error.message}`);
  }
};

export const analyzeDataStructure = (financialAnalysis) => {
  if (!financialAnalysis) return { availableFields: [], dataTypes: {} };
  
  const structure = {
    availableFields: [],
    dataTypes: {},
    sampleData: {}
  };
  
  if (financialAnalysis.transactions && financialAnalysis.transactions.length > 0) {
    financialAnalysis.transactions.forEach(transaction => {
      Object.keys(transaction).forEach(field => {
        if (!structure.availableFields.includes(field)) {
          structure.availableFields.push(field);
          structure.dataTypes[field] = typeof transaction[field];
          structure.sampleData[field] = transaction[field];
        }
      });
    });
  }
  
  Object.keys(financialAnalysis).forEach(key => {
    if (key !== 'transactions' && !structure.availableFields.includes(key)) {
      structure.availableFields.push(key);
      structure.dataTypes[key] = typeof financialAnalysis[key];
      structure.sampleData[key] = financialAnalysis[key];
    }
  });
  
  return structure;
};
