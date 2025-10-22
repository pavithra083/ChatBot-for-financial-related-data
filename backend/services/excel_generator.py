import pandas as pd
from io import BytesIO
from typing import Dict, Any

class ExcelGenerator:
    def generate_financial_report(self, data: Dict[str, Any]) -> BytesIO:
        output = BytesIO()
        
        try:
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                # Summary Sheet
                self._create_summary_sheet(writer, data)
                
                # Financial Data Sheet
                self._create_financial_data_sheet(writer, data)
                
            output.seek(0)
            return output
            
        except Exception as e:
            raise Exception(f"Excel generation failed: {str(e)}")
    
    def _create_summary_sheet(self, writer, data: Dict[str, Any]):
        summary_data = {
            'Metric': ['Pages', 'Tables', 'Amounts Found', 'Dates Found', 'Key Terms'],
            'Value': [
                data.get('summary', {}).get('total_pages', 0),
                data.get('summary', {}).get('table_count', 0),
                len(data.get('financial_metrics', {}).get('amounts', [])),
                len(data.get('financial_metrics', {}).get('dates', [])),
                ', '.join(data.get('financial_metrics', {}).get('key_terms', []))
            ]
        }
        
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Summary', index=False)
    
    def _create_financial_data_sheet(self, writer, data: Dict[str, Any]):
        financial_data = data.get('financial_metrics', {})
        
        if financial_data.get('amounts'):
            df_amounts = pd.DataFrame({'Amounts': financial_data['amounts']})
            df_amounts.to_excel(writer, sheet_name='Amounts', index=False)
        
        if financial_data.get('dates'):
            df_dates = pd.DataFrame({'Dates': financial_data['dates']})
            df_dates.to_excel(writer, sheet_name='Dates', index=False)