"""
OpenAI Service for AI-powered analysis and processing
"""

import os
import logging
from typing import Dict, List, Optional
import json

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if self.api_key and OPENAI_AVAILABLE:
            openai.api_key = self.api_key
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            self.client = None
        
        logger.info(f"OpenAI service initialized: {bool(self.client)}")
    
    def analyze_face_quality(self, face_data: Dict) -> Dict:
        """Analyze face quality using OpenAI"""
        if not self.client:
            return {'error': 'OpenAI not available'}
        
        try:
            prompt = f"""
            Analyze this facial biometric data for quality assessment:
            - Face detected: {face_data.get('face_detected', False)}
            - Confidence: {face_data.get('confidence', 0)}
            - Resolution: {face_data.get('resolution', {})}
            
            Provide a quality score (0-100) and recommendations for improvement.
            Respond in JSON format with 'quality_score' and 'recommendations'.
            """
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return {'error': str(e)}
    
    def generate_attendance_insights(self, attendance_data: List[Dict]) -> Dict:
        """Generate attendance insights using OpenAI"""
        if not self.client:
            return {'error': 'OpenAI not available'}
        
        try:
            prompt = f"""
            Analyze this attendance data and provide insights:
            {json.dumps(attendance_data[:10])}  # Limit data size
            
            Provide insights about:
            1. Attendance patterns
            2. Punctuality trends
            3. Recommendations
            
            Respond in JSON format.
            """
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            logger.error(f"OpenAI insights failed: {e}")
            return {'error': str(e)}

# Global service instance
openai_service = OpenAIService()