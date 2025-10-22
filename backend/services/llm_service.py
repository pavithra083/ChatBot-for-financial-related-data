import openai
import os
from typing import Dict, Any
from .config_loader import ConfigLoader

class LLMService:
    def __init__(self):
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        
        self.config_loader = ConfigLoader()
        self.config = self.config_loader.load_config()
        self.prompts = self.config_loader.load_prompts()
        
        self.base_url = self.config['openrouter']['base_url']
        self.model = self.config['openrouter']['default_model']
        self.max_tokens = self.config['openrouter']['max_tokens']
        self.temperature = self.config['openrouter']['temperature']
        
    async def ask_question(self, question: str, context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            client = openai.AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key
            )
            
            prompt = self._build_prompt(question, context)
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts['system_prompts']['financial_analyst']
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            return {
                "answer": response.choices[0].message.content,
                "sources": ["document_analysis"],
                "confidence": "high"
            }
            
        except Exception as e:
            return {
                "answer": f"Error: {str(e)}",
                "sources": [],
                "confidence": "low"
            }
    
    def _build_prompt(self, question: str, context: Dict[str, Any]) -> str:
        financial_data = context.get('financial_metrics', {})
        
        prompt = f"""
        Analyze this financial document and answer the question.

        DOCUMENT INFO:
        - Pages: {context.get('summary', {}).get('total_pages', 0)}
        - Tables: {context.get('summary', {}).get('table_count', 0)}
        - Key Terms: {', '.join(financial_data.get('key_terms', []))}
        - Amounts Found: {len(financial_data.get('amounts', []))}
        - Dates: {financial_data.get('dates', [])[:5]}

        DOCUMENT CONTENT:
        {context.get('raw_text', '')[:1500]}

        QUESTION: {question}

        Answer based ONLY on the document above.
        """
        return prompt