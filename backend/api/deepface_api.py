"""
DeepFace API endpoints for facial recognition and training
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging

from services.deepface_service import deepface_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/deepface", tags=["deepface"])

class FaceRegistrationRequest(BaseModel):
    employee_id: str
    image_data: str
    angle: Optional[str] = "frontal"

class FaceRecognitionRequest(BaseModel):
    image_data: str
    threshold: Optional[float] = 0.6

class CameraFrameRequest(BaseModel):
    frame_data: str
    camera_id: Optional[str] = "default"

@router.post("/register")
async def register_employee_face(request: FaceRegistrationRequest):
    """Register employee face with DeepFace"""
    try:
        result = deepface_service.register_employee_face(
            request.employee_id,
            request.image_data,
            request.angle
        )
        
        if result.get('success'):
            return {
                "success": True,
                "message": f"Face registered successfully for {request.employee_id}",
                "data": result
            }
        else:
            raise HTTPException(status_code=400, detail=result.get('error', 'Registration failed'))
            
    except Exception as e:
        logger.exception(f"Face registration error for {request.employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recognize")
async def recognize_face(request: FaceRecognitionRequest):
    """Recognize face using DeepFace"""
    try:
        result = deepface_service.recognize_face(request.image_data, request.threshold)
        
        return {
            "success": True,
            "recognition_result": result
        }
        
    except Exception as e:
        logger.exception("Face recognition error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-frame")
async def process_camera_frame(request: CameraFrameRequest):
    """Process camera frame for real-time recognition and attendance"""
    try:
        result = deepface_service.process_camera_frame(request.frame_data, request.camera_id)
        
        return {
            "success": True,
            "frame_result": result
        }
        
    except Exception as e:
        logger.exception("Camera frame processing error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train-all")
async def train_all_employees():
    """Train DeepFace with all employees from MongoDB"""
    try:
        result = deepface_service.train_all_employees()
        
        if result.get('success'):
            return {
                "success": True,
                "message": "Training completed",
                "stats": result
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Training failed'))
            
    except Exception as e:
        logger.exception("Training error")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_training_stats():
    """Get DeepFace training statistics"""
    try:
        stats = deepface_service.get_training_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.exception("Stats retrieval error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-attendance/{employee_id}")
async def mark_attendance(employee_id: str, camera_id: str = "default"):
    """Mark attendance for employee"""
    try:
        result = deepface_service.mark_attendance(employee_id, camera_id)
        
        return {
            "success": True,
            "attendance_result": result
        }
        
    except Exception as e:
        logger.exception(f"Attendance marking error for {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))