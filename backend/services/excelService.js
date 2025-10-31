const ExcelJS = require('exceljs');

async function generateExcelFromDocument(document) {
  try {
    const structuredData = document.structuredData || {};
    const normalizedData = normalizeStructuredData(structuredData);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Financial Chatbot AI';
    workbook.created = new Date();

    if (normalizedData.items && normalizedData.items.length > 0) {
      createPivotSheet(workbook, normalizedData);
    }

    if (normalizedData.items && normalizedData.items.length > 0) {
      createDetailedSheet(workbook, normalizedData);
    }

    if (document.extractedText) {
      createTextSheet(workbook, document.extractedText);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw new Error(`Excel generation failed: ${error.message}`);
  }
}

function normalizeStructuredData(data) {
  const normalized = {
    items: [],
    headers: ["Date", "Description", "Amount", "Category", "Type"],
    summary: {}
  };

  if (!data) return normalized;

  if (Array.isArray(data.items)) {
    normalized.items = data.items;
  } else if (Array.isArray(data)) {
    normalized.items = data;
  }

  if (Array.isArray(data.headers)) {
    normalized.headers = data.headers;
  }

  if (data.summary && typeof data.summary === 'object') {
    normalized.summary = data.summary;
  }

  if (normalized.items.length > 0) {
    normalized.items = normalized.items.map((item, idx) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        Date: item.Date || item.date || `Row_${idx + 1}`,
        Description: item.Description || item.description || 'N/A',
        Amount: parseFloat(
          String(item.Amount || item.amount || 0).replace(/[^0-9.-]/g, '')
        ) || 0,
        Category: item.Category || item.category || 'Other',
        Type: item.Type || item.type || 'Expense'
      };
    }).filter(item => item !== null);
  }

  return normalized;
}

function createPivotSheet(workbook, data) {
  const sheet = workbook.addWorksheet('📊 Financial Overview', {
    properties: { tabColor: { argb: 'FF70AD47' } }
  });

  const items = data.items || [];
  if (items.length === 0) return;

  const pivot = {};
  items.forEach((item, idx) => {
    const date = item.Date || `Row_${idx + 1}`;
    const category = item.Category || 'Other';
    const amount = parseFloat(item.Amount) || 0;
    if (!pivot[date]) {
      pivot[date] = {};
    }
    pivot[date][category] = (pivot[date][category] || 0) + amount;
  });

  const categories = new Set();
  Object.values(pivot).forEach(row => {
    Object.keys(row).forEach(cat => categories.add(cat));
  });
  const sortedCols = Array.from(categories).sort();

  sheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    ...sortedCols.map(col => ({
      header: col,
      key: col.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      width: 15
    }))
  ];

  Object.entries(pivot).forEach(([date, vals]) => {
    const row = { date };
    sortedCols.forEach(col => {
      const key = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
      row[key] = vals[col] || '';
    });
    sheet.addRow(row);
  });

  const hdr = sheet.getRow(1);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
  hdr.height = 25;
  hdr.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    row.eachCell((cell, colNum) => {
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: colNum === 1 ? 'left' : 'right' 
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      if (colNum > 1 && cell.value && !isNaN(cell.value)) {
        cell.numFmt = '#,##0.00';
      }
      if (rowNum % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
      }
    });
    row.height = 25;
  });

  const totalRow = { date: 'TOTAL' };
  sortedCols.forEach((col, i) => {
    const key = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const letter = String.fromCharCode(66 + i);
    totalRow[key] = { formula: `SUM(${letter}2:${letter}${sheet.rowCount})` };
  });

  const total = sheet.addRow(totalRow);
  total.font = { bold: true };
  total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };
  total.eachCell((cell, colNum) => {
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
    if (colNum > 1) cell.numFmt = '#,##0.00';
  });

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sortedCols.length + 1) + '1' };
}

function createDetailedSheet(workbook, data) {
  const sheet = workbook.addWorksheet('📋 Detailed Transactions', {
    properties: { tabColor: { argb: 'FF6A5ACD' } }
  });

  const items = data.items || [];
  const headers = data.headers || ['Date', 'Description', 'Amount', 'Category', 'Type'];
  if (items.length === 0) return;

  sheet.columns = headers.map(h => ({
    header: h.toUpperCase(),
    key: h.toLowerCase().replace(/\s+/g, '_'),
    width: h === 'Description' ? 45 : 18
  }));

  items.forEach((item, idx) => {
    const row = {};
    headers.forEach(h => {
      const key = h.toLowerCase().replace(/\s+/g, '_');
      let val = item[h] || item[key] || '';
      if (h === 'Amount' && val) {
        val = parseFloat(val.toString().replace(/[^0-9.-]/g, '')) || val;
      }
      row[key] = val;
    });
    const addedRow = sheet.addRow(row);
    addedRow.height = 28;
    if (idx % 2 === 1) {
      addedRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E6FF' } };
    }
  });

  const hdr = sheet.getRow(1);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A5ACD' } };
  hdr.height = 30;
  hdr.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + headers.length) + '1' };

  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    row.eachCell((cell, colNum) => {
      const header = headers[colNum - 1];
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: header === 'Amount' ? 'right' : 'left',
        wrapText: true 
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      if (header === 'Amount') {
        cell.numFmt = '₹#,##0.00';
        cell.font = { bold: true, size: 11 };
      }
      if (header === 'Type') {
        if (cell.value === 'Income') {
          cell.font = { color: { argb: 'FF008000' }, bold: true };
        } else if (cell.value === 'Expense') {
          cell.font = { color: { argb: 'FFDC143C' }, bold: true };
        }
      }
    });
  });
}

function createTextSheet(workbook, text) {
  const sheet = workbook.addWorksheet('📄 Document Text', {
    properties: { tabColor: { argb: 'FFBFBFBF' } }
  });

  sheet.columns = [
    { header: 'Section', key: 'section', width: 15 },
    { header: 'Content', key: 'content', width: 100 }
  ];

  const chunks = [];
  for (let i = 0; i < text.length; i += 2000) {
    chunks.push(text.substring(i, i + 2000));
  }

  chunks.forEach((chunk, i) => {
    sheet.addRow({ section: `Section ${i + 1}`, content: chunk.trim() });
  });

  const hdr = sheet.getRow(1);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
  hdr.height = 25;
  hdr.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.height = 100;
      row.eachCell(cell => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    }
  });
}

module.exports = { generateExcelFromDocument };
