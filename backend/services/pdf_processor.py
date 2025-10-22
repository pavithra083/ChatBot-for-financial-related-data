import pdfplumber
import re
import os
from typing import Dict, List, Any

class PDFProcessor:
    def extract_financial_data(self, file_path: str) -> Dict[str, Any]:
        """
        Extract text and financial data from PDF
        """
        full_text = ""
        tables = []
        
        try:
            print(f"🔍 Opening PDF file: {file_path}")
            
           
            if not os.path.exists(file_path):
                raise Exception(f"File not found: {file_path}")
            
            with pdfplumber.open(file_path) as pdf:
                print(f"📄 PDF opened successfully. Pages: {len(pdf.pages)}")
                
                for i, page in enumerate(pdf.pages):
                    print(f"   Processing page {i+1}...")
                    
                    
                    text = page.extract_text()
                    if text:
                        full_text += text + "\n\n"
                        print(f"     Extracted {len(text)} characters")
                    else:
                        print(f"     No text found on page {i+1}")
                    
                    # Extract tables
                    page_tables = page.extract_tables()
                    if page_tables:
                        print(f"     Found {len(page_tables)} tables on page {i+1}")
                        for table in page_tables:
                            if table and any(any(cell for cell in row if cell) for row in table):
                                tables.append({
                                    'page': page.page_number,
                                    'data': table
                                })
                    else:
                        print(f"     No tables found on page {i+1}")
            
            print(f"✅ PDF extraction complete")
            print(f"   - Total text length: {len(full_text)}")
            print(f"   - Total tables found: {len(tables)}")
            
           
            financial_metrics = self._analyze_financial_content(full_text)
            
            print(f"💰 Financial analysis:")
            print(f"   - Amounts found: {len(financial_metrics['amounts'])}")
            print(f"   - Dates found: {len(financial_metrics['dates'])}")
            print(f"   - Key terms: {financial_metrics['key_terms']}")
            
            return {
                'raw_text': full_text,
                'tables': tables,
                'financial_metrics': financial_metrics,
                'summary': {
                    'total_pages': len(pdf.pages),
                    'table_count': len(tables),
                    'has_financial_data': len(financial_metrics['amounts']) > 0 or len(financial_metrics['key_terms']) > 0
                }
            }
            
        except Exception as e:
            print(f"❌ PDF processing error in extract_financial_data: {str(e)}")
            raise Exception(f"PDF processing error: {str(e)}")
    
    def _analyze_financial_content(self, text: str) -> Dict[str, List]:
        """
        Identify financial patterns in text
        """
        try:
            # Financial patterns
            amount_pattern = r'\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
            date_pattern = r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b'
            
            amounts = re.findall(amount_pattern, text)
            dates = re.findall(date_pattern, text)
            
            financial_terms = ['revenue', 'expense', 'profit', 'loss', 'balance', 
                             'transaction', 'payment', 'invoice', 'tax', 'total',
                             'amount', 'fee', 'charge', 'credit', 'debit']
            found_terms = [term for term in financial_terms if term in text.lower()]
            
            return {
                'amounts': amounts[:50],  # Limit to first 50
                'dates': dates[:20],      # Limit to first 20
                'key_terms': list(set(found_terms))
            }
        except Exception as e:
            print(f"❌ Financial analysis error: {str(e)}")
            return {
                'amounts': [],
                'dates': [],
                'key_terms': []
            }