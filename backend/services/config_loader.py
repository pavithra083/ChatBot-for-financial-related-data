import json
import os
from typing import Dict, Any

class ConfigLoader:
    def __init__(self):
        self.config_path = "config/config.json"
        self.prompts_path = "config/prompts.json"
    
    def load_config(self) -> Dict[str, Any]:
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return self._get_default_config()
    
    def load_prompts(self) -> Dict[str, Any]:
        try:
            with open(self.prompts_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return self._get_default_prompts()
    
    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "app": {"name": "Financial PDF Chatbot", "version": "1.0.0"},
            "server": {"host": "0.0.0.0", "port": 8000},
            "openrouter": {
                "base_url": "https://openrouter.ai/api/v1",
                "default_model": "anthropic/claude-3-haiku",
                "max_tokens": 800,
                "temperature": 0.1
            }
        }
    
    def _get_default_prompts(self) -> Dict[str, Any]:
        return {
            "system_prompts": {
                "financial_analyst": "You are a financial analyst. Provide accurate information based on the document."
            }
        }