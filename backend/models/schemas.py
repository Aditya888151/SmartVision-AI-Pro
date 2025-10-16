"""
Pydantic models for API requests/responses
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Employee(BaseModel):
    employee_id: str
    name: str
    department: str
    role: str
    shift_start: str
    shift_end: str
    face_images: List[str] = []
    is_active: bool = True

class CameraConfig(BaseModel):
    camera_id: str
    name: str
    source: str
    location: str
    camera_type: str = "security"
    monitor_employees: bool = True
    detection_zones: List[dict] = []

class BehaviorEvent(BaseModel):
    event_id: str
    employee_id: str
    camera_id: str
    behavior_type: str
    confidence: float
    timestamp: datetime
    duration_seconds: Optional[float] = None
    videodb_id: Optional[str] = None

class SecurityAlert(BaseModel):
    alert_id: str
    alert_type: str
    camera_id: Optional[str] = None
    employee_id: Optional[str] = None
    message: str
    severity: str
    timestamp: datetime
    resolved: bool = False
