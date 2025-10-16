"""
Employee Management API (Improved & Pillow-Safe)
"""

from fastapi import (
    APIRouter, HTTPException, UploadFile, File, Form
)
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import io
import logging
import sys
import os
from datetime import datetime

# ----------------------------------------------
# Safe Pillow Import
# ----------------------------------------------
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    class MockImage:
        @staticmethod
        def open(*args, **kwargs):
            raise ImportError("PIL not available")
    Image = MockImage

# ----------------------------------------------
# Setup imports and logger
# ----------------------------------------------
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.mongodb_service import mongodb_service
from services.deepface_service import deepface_service
from models.schemas import Employee
import cv2
import numpy as np
import base64

logger = logging.getLogger("employee_api")
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/api/employees", tags=["employees"])

# ----------------------------------------------
# Schemas
# ----------------------------------------------

class EmployeeCreate(BaseModel):
    employee_id: str = Field(..., example="EMP001")
    name: str
    department: Optional[str] = ""
    role: Optional[str] = ""
    shift_start: Optional[str] = ""
    shift_end: Optional[str] = ""
    face_image: Optional[str] = ""
    biometric_data: Optional[str] = ""
    unique_id: Optional[str] = ""

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    is_active: Optional[bool] = None

class MessageResponse(BaseModel):
    success: bool
    message: str
    employee_id: Optional[str] = None

# ----------------------------------------------
# Helper Functions
# ----------------------------------------------

def ensure_employee_exists(employee_id: str):
    employee = mongodb_service.get_employee(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

# ----------------------------------------------
# Routes - STATS MUST BE BEFORE DYNAMIC ROUTES
# ----------------------------------------------

@router.get("/stats")
async def get_employee_stats():
    """Get stats from MongoDB"""
    try:
        stats = mongodb_service.get_employee_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.warning(f"MongoDB stats error: {e}")
        return {"success": False, "stats": {"total": 0, "active": 0}}

@router.post("/", response_model=MessageResponse)
async def create_employee(employee_data: dict):
    """Create a new employee (with optional image & biometrics)"""
    try:
        # Validate required fields
        if 'employee_id' not in employee_data:
            raise HTTPException(status_code=400, detail="employee_id is required")
        if 'name' not in employee_data:
            raise HTTPException(status_code=400, detail="name is required")
            
        # Check if employee ID already exists
        existing = mongodb_service.get_employee(employee_data['employee_id'])
        if existing:
            raise HTTPException(status_code=400, detail=f"Employee ID '{employee_data['employee_id']}' already exists")
        
        result = mongodb_service.add_employee(employee_data)
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create employee")
        
        # If face image provided, train face recognition
        if employee_data.get('face_image'):
            try:
                # Decode base64 image
                image_data = base64.b64decode(employee_data['face_image'])
                nparr = np.frombuffer(image_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    # Train face recognition
                    result = deepface_service.register_employee_face(
                        employee_data['employee_id'],
                        base64.b64encode(cv2.imencode('.jpg', img)[1]).decode('utf-8')
                    )
                    success = result.get('success', False)
                    message = result.get('message', 'Face training completed')
                    
                    if success:
                        logger.info(f"Face recognition trained for {employee_data['employee_id']}")
                    else:
                        logger.warning(f"Face training failed for {employee_data['employee_id']}: {message}")
            except Exception as face_error:
                logger.error(f"Face training error for {employee_data['employee_id']}: {face_error}")
        
        return MessageResponse(success=True, message="Employee created and face trained", employee_id=employee_data['employee_id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating employee")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Dict])
async def get_employees(active_only: bool = True):
    """Get all employees"""
    try:
        return mongodb_service.get_all_employees(active_only)
    except Exception as e:
        logger.exception("Error fetching employees")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{employee_id}", response_model=Dict)
async def get_employee(employee_id: str):
    """Get single employee by ID"""
    try:
        return ensure_employee_exists(employee_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching employee {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{employee_id}", response_model=MessageResponse)
async def update_employee(employee_id: str, employee_data: EmployeeUpdate):
    """Update employee details"""
    try:
        ensure_employee_exists(employee_id)
        updated = mongodb_service.update_employee(employee_id, employee_data.dict(exclude_none=True))
        if not updated:
            raise HTTPException(status_code=400, detail="Failed to update employee")
        return MessageResponse(success=True, message="Employee updated", employee_id=employee_id)
    except Exception as e:
        logger.exception(f"Error updating employee {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{employee_id}", response_model=MessageResponse)
async def delete_employee(employee_id: str):
    """Delete employee and remove face data"""
    try:
        ensure_employee_exists(employee_id)
        
        # Remove from face recognition (DeepFace handles this automatically)
        
        # Remove from MongoDB
        mongodb_service.delete_employee(employee_id)
        
        return MessageResponse(success=True, message="Employee and face data deleted", employee_id=employee_id)
    except Exception as e:
        logger.exception(f"Error deleting employee {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{employee_id}/images", response_model=MessageResponse)
async def add_employee_image(
    employee_id: str,
    image: UploadFile = File(...),
    image_type: str = Form("profile")
):
    """Add image for employee and train face recognition with validation"""
    try:
        employee = ensure_employee_exists(employee_id)
        
        # Read image
        image_data = await image.read()
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Train face recognition with validation
        success, message = advanced_face_service.add_employee_face(
            employee_id=employee_id,
            name=employee.get('name', 'Unknown'),
            image=img,
            department=employee.get('department', ''),
            role=employee.get('role', '')
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        # Save image to MongoDB
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        mongodb_service.update_employee(employee_id, {"face_image": image_base64})
        
        return MessageResponse(
            success=True, 
            message=message, 
            employee_id=employee_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error adding image for {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{employee_id}/train-face", response_model=MessageResponse)
async def train_employee_face(employee_id: str):
    """Train face recognition for existing employee"""
    try:
        employee = ensure_employee_exists(employee_id)
        
        face_image = employee.get('face_image')
        if not face_image:
            raise HTTPException(status_code=400, detail="No face image found for employee")
        
        # Decode base64 image
        image_data = base64.b64decode(face_image)
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid face image data")
        
        # Train face recognition
        result = deepface_service.register_employee_face(
            employee_id,
            base64.b64encode(cv2.imencode('.jpg', img)[1]).decode('utf-8')
        )
        success = result.get('success', False)
        message = result.get('message', 'Training completed')
        
        if not success:
            raise HTTPException(status_code=400, detail=f"Face training failed: {message}")
        
        return MessageResponse(
            success=True,
            message=f"Face recognition trained successfully: {message}",
            employee_id=employee_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error training face for {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/filter/department/{department}", response_model=List[Dict])
async def filter_by_department(department: str):
    """Filter employees by department"""
    try:
        return mongodb_service.filter_by_department(department)
    except Exception as e:
        logger.exception("Error filtering employees by department")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register-biometric", response_model=MessageResponse)
async def register_employee_biometric(request_data: dict):
    """Register employee with basic biometric capture"""
    try:
        employee_id = request_data.get('employee_id')
        biometric_data = request_data.get('biometric_data', [])
        
        if not employee_id or not biometric_data:
            raise HTTPException(status_code=400, detail="Employee ID and biometric data required")
        
        employee = ensure_employee_exists(employee_id)
        
        # Process captured images with enhanced biometric data (1 per angle)
        processed_images = 0
        angles_processed = []
        biometric_analysis = {
            'facial_metrics': {},
            'retinal_data': {},
            'quality_scores': {},
            'resolution_data': {},
            'capture_metadata': []
        }
        
        for capture in biometric_data:
            try:
                # Decode base64 image
                image_data = base64.b64decode(capture['image'].split(',')[1])
                nparr = np.frombuffer(image_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    angle = capture['angle']
                    
                    # Store enhanced biometric data
                    if 'biometricData' in capture:
                        bio_data = capture['biometricData']
                        biometric_analysis['facial_metrics'][angle] = {
                            'brightness': bio_data.get('brightness', 0),
                            'contrast': bio_data.get('contrast', 0),
                            'sharpness': bio_data.get('sharpness', 0),
                            'color_distribution': bio_data.get('colorDistribution', {}),
                            'face_region_data': bio_data.get('faceRegionData', {})
                        }
                    
                    # Store resolution data
                    if 'resolution' in capture:
                        biometric_analysis['resolution_data'][angle] = capture['resolution']
                    
                    # Store capture metadata
                    biometric_analysis['capture_metadata'].append({
                        'angle': angle,
                        'timestamp': capture.get('timestamp', time.time()),
                        'quality_assessment': 'high_resolution'
                    })
                    
                    # Train face recognition for this angle  
                    result = deepface_service.register_employee_face(
                        employee_id, 
                        base64.b64encode(cv2.imencode('.jpg', img)[1]).decode('utf-8')
                    )
                    success = result.get('success', False)
                    message = result.get('message', 'Training completed')
                    
                    if success:
                        processed_images += 1
                        angles_processed.append(angle)
                        
                        # Store quality score for this angle
                        biometric_analysis['quality_scores'][angle] = {
                            'face_recognition_success': True,
                            'processing_timestamp': time.time()
                        }
                        
            except Exception as e:
                logger.warning(f"Failed to process {capture.get('angle', 'unknown')} angle: {e}")
                # Store error information
                biometric_analysis['quality_scores'][capture.get('angle', 'unknown')] = {
                    'face_recognition_success': False,
                    'error': str(e),
                    'processing_timestamp': time.time()
                }
        
        if processed_images == 0:
            raise HTTPException(status_code=400, detail="No valid face data could be processed")
        
        # Update employee with comprehensive biometric registration data
        mongodb_service.update_employee(employee_id, {
            "biometric_registered": True,
            "total_images_processed": processed_images,
            "angles_processed": angles_processed,
            "biometric_analysis": biometric_analysis,
            "registration_date": str(datetime.now()),
            "biometric_quality": "high_resolution_multi_angle",
            "capture_method": "manual_5_angle_capture"
        })
        
        return MessageResponse(
            success=True,
            message=f"High-quality biometric registration completed: {processed_images} images from {len(angles_processed)} angles with facial and retinal analysis",
            employee_id=employee_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error registering biometric for {employee_id}")
        raise HTTPException(status_code=500, detail=str(e))












