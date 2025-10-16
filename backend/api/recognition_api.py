"""
Real-time Face Recognition API
Returns actual recognition results from camera
"""

from fastapi import APIRouter
from services.mongodb_service import mongodb_service
from optimized_camera_system import active_cameras
from services.deepface_service import deepface_service
import cv2
from datetime import datetime

router = APIRouter(prefix="/api/recognition", tags=["recognition"])

# Store recent detections
recent_detections = {}

@router.get("/{camera_id}/detections")
async def get_camera_detections(camera_id: str):
    """Get real-time face detection results with high accuracy"""
    
    if camera_id not in active_cameras:
        return {"detections": [], "message": "Camera not active"}
    
    camera = active_cameras[camera_id]
    frame = camera.get_frame()
    
    if frame is None:
        return {"detections": []}
    
    # Recognize faces with deep learning (threshold 0.4 = strict)
    results = deepface_service.recognize_face(frame, threshold=0.4)
    
    detections = []
    
    if results and results.get('recognized'):
        # Known employee detected
        employee = mongodb_service.get_employee(results['employee_id'])
        detection = {
            "employee_id": results['employee_id'],
            "name": results['name'],
            "department": employee.get('department', '') if employee else '',
            "role": employee.get('role', '') if employee else '',
            "confidence": results['confidence'],
            "authorized": True,
            "timestamp": datetime.now().isoformat()
        }
        detections.append(detection)
    elif results and not results.get('recognized'):
        # Face detected but not recognized
        detection = {
            "employee_id": "UNKNOWN",
            "name": "Unknown Person",
            "department": "",
            "role": "",
            "confidence": 0,
            "authorized": False,
            "timestamp": datetime.now().isoformat()
        }
        detections.append(detection)
    
    return {"detections": detections}
