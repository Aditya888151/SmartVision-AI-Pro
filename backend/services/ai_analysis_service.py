"""
AI Analysis Service
Integrates with OpenAI GPT-4 Vision for intelligent security analysis
"""
import cv2
import base64
import requests
from datetime import datetime
import json

class AIAnalysisService:
    def __init__(self, api_key=None):
        import os
        self.api_key = api_key or os.getenv('OPENAI_API_KEY', '')
        if self.api_key:
            self.api_key = self.api_key.strip()
        
        self.base_url = "https://api.openai.com/v1/chat/completions"
        if self.api_key and self.api_key != "your-openai-api-key-here":
            print(f"OpenAI API key loaded ({len(self.api_key)} chars) - AI analysis enabled")
        else:
            print("No OpenAI API key - using mock analysis")
        
    def encode_frame(self, frame):
        """Convert frame to base64 for API"""
        _, buffer = cv2.imencode('.jpg', frame)
        return base64.b64encode(buffer).decode('utf-8')
    
    def analyze_security_scene(self, frame, camera_type="activity", context=""):
        """Analyze frame for security threats and behavior"""
        
        if not self.api_key or self.api_key == "your-openai-api-key-here":
            return self._mock_analysis(camera_type)
        
        image_b64 = self.encode_frame(frame)
        
        prompt = f"""
        Analyze this security camera footage for:
        1. Potential security threats or intruders
        2. Suspicious behavior or activities  
        3. Safety violations or incidents
        4. Overall security assessment
        
        Camera Type: {camera_type}
        Context: {context}
        
        Provide a JSON response with:
        - threat_level: "low", "medium", "high", "critical"
        - detected_objects: list of objects/people seen
        - behavior_analysis: description of activities
        - security_summary: brief assessment
        - recommendations: suggested actions
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4-vision-preview",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_b64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 500
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Try to parse JSON response
                try:
                    return json.loads(content)
                except:
                    return {
                        "threat_level": "low",
                        "security_summary": content,
                        "detected_objects": ["person"],
                        "behavior_analysis": "Normal activity detected",
                        "recommendations": ["Continue monitoring"]
                    }
            else:
                return self._mock_analysis(camera_type)
                
        except Exception as e:
            print(f"AI Analysis error: {e}")
            return self._mock_analysis(camera_type)
    
    def generate_incident_report(self, alerts, camera_data, timeframe="last hour"):
        """Generate comprehensive incident report"""
        
        if not self.api_key or self.api_key == "your-openai-api-key-here":
            return self._mock_report(alerts)
        
        prompt = f"""
        Generate a security incident report based on these alerts:
        
        Alerts: {json.dumps(alerts, indent=2)}
        Camera Data: {json.dumps(camera_data, indent=2)}
        Timeframe: {timeframe}
        
        Create a professional security report with:
        1. Executive Summary
        2. Incident Details
        3. Risk Assessment
        4. Recommendations
        5. Follow-up Actions
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000
                },
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "report": result['choices'][0]['message']['content'],
                    "generated_at": datetime.now().isoformat(),
                    "alert_count": len(alerts)
                }
            else:
                return self._mock_report(alerts)
                
        except Exception as e:
            print(f"Report generation error: {e}")
            return self._mock_report(alerts)
    
    def _mock_analysis(self, camera_type):
        """Mock analysis when API key not available"""
        return {
            "threat_level": "low",
            "detected_objects": ["person"],
            "behavior_analysis": f"Normal {camera_type} camera activity detected",
            "security_summary": "No immediate threats identified",
            "recommendations": ["Continue routine monitoring"],
            "ai_enabled": False
        }
    
    def _mock_report(self, alerts):
        """Mock report when API key not available"""
        return {
            "report": f"""
SECURITY INCIDENT REPORT
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

EXECUTIVE SUMMARY:
{len(alerts)} security alerts detected in the monitoring period.

INCIDENT DETAILS:
- Total Alerts: {len(alerts)}
- Threat Level: Low to Medium
- Primary Concerns: Routine security monitoring

RECOMMENDATIONS:
- Continue standard monitoring procedures
- Review alert patterns for optimization
- Consider AI enhancement with API key integration

Note: This is a basic report. Enable AI analysis with API key for detailed insights.
            """,
            "generated_at": datetime.now().isoformat(),
            "alert_count": len(alerts),
            "ai_enabled": False
        }

# Global instance - will be initialized after env vars load
ai_analysis_service = None

def get_ai_service():
    global ai_analysis_service
    if ai_analysis_service is None:
        ai_analysis_service = AIAnalysisService()
    return ai_analysis_service