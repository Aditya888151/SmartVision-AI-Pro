"""
MongoDB Service for Employee Data Storage
"""

from pymongo import MongoClient
from datetime import datetime
import logging
import json
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class MongoDBService:
    def __init__(self):
        import os
        self.connection_string = os.getenv('MONGODB_URI', '')
        self.database_name = os.getenv('MONGODB_DATABASE', 'AI_Automation')
        self.client = None
        self.db = None
        self.employees_collection = None
        self.cameras_collection = None
        self.attendance_collection = None
        self.connect()
    
    def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = MongoClient(self.connection_string, serverSelectionTimeoutMS=5000)
            self.db = self.client[self.database_name]
            self.employees_collection = self.db.employees
            self.cameras_collection = self.db.cameras
            self.attendance_collection = self.db.attendance
            
            # Test connection
            self.client.admin.command('ping')
            logger.info("✅ Connected to MongoDB successfully")
            
            # Create indexes in background (non-blocking)
            try:
                self.employees_collection.create_index("employee_id", unique=True, background=True)
                self.cameras_collection.create_index("camera_id", unique=True, background=True)
            except Exception:
                pass  # Indexes may already exist
            
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            # Don't raise - allow fallback to SQLite
            self.client = None
            self.db = None
            self.employees_collection = None
            self.cameras_collection = None
            self.attendance_collection = None
    
    def add_employee(self, employee_data: Dict) -> bool:
        """Add employee with all metadata to MongoDB"""
        try:
            if self.employees_collection is None:
                logger.warning("MongoDB not connected")
                return False
            
            # Check if employee_id already exists
            if self.get_employee(employee_data.get("employee_id")):
                logger.warning(f"Employee ID {employee_data.get('employee_id')} already exists")
                return False
                
            # Prepare document
            document = {
                "employee_id": employee_data.get("employee_id"),
                "unique_id": employee_data.get("unique_id", f"{employee_data.get('employee_id')}_{int(datetime.now().timestamp())}"),
                "name": employee_data.get("name"),
                "department": employee_data.get("department", ""),
                "role": employee_data.get("role", ""),
                "shift_start": employee_data.get("shift_start", "10:30 AM"),
                "shift_end": employee_data.get("shift_end", "06:00 PM"),
                "lunch_start": employee_data.get("lunch_start", "01:30 PM"),
                "lunch_end": employee_data.get("lunch_end", "02:30 PM"),
                "face_image": employee_data.get("face_image", ""),
                "biometric_data": json.loads(employee_data.get("biometric_data", "{}")) if isinstance(employee_data.get("biometric_data"), str) else employee_data.get("biometric_data", {}),
                "is_active": employee_data.get("is_active", True),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            # Insert or update
            result = self.employees_collection.replace_one(
                {"employee_id": employee_data.get("employee_id")},
                document,
                upsert=True
            )
            
            logger.info(f"✅ Employee {employee_data.get('employee_id')} saved to MongoDB")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to add employee to MongoDB: {e}")
            return False
    
    def get_employee(self, employee_id: str) -> Optional[Dict]:
        """Get employee by ID"""
        try:
            employee = self.employees_collection.find_one({"employee_id": employee_id})
            if employee:
                employee["_id"] = str(employee["_id"])  # Convert ObjectId to string
            return employee
            
        except Exception as e:
            logger.error(f"❌ Failed to get employee {employee_id}: {e}")
            return None
    
    def get_all_employees(self, active_only: bool = True) -> List[Dict]:
        """Get all employees"""
        try:
            if self.employees_collection is None:
                return []
                
            query = {"is_active": True} if active_only else {}
            employees = list(self.employees_collection.find(query))
            
            # Convert ObjectId to string and debug
            for emp in employees:
                emp["_id"] = str(emp["_id"])
            
            return employees
            
        except Exception as e:
            logger.error(f"Failed to get employees: {e}")
            return []
    
    def update_employee(self, employee_id: str, update_data: Dict) -> bool:
        """Update employee data"""
        try:
            update_data["updated_at"] = datetime.now()
            
            result = self.employees_collection.update_one(
                {"employee_id": employee_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"❌ Failed to update employee {employee_id}: {e}")
            return False
    
    def delete_employee(self, employee_id: str) -> bool:
        """Delete employee"""
        try:
            result = self.employees_collection.delete_one({"employee_id": employee_id})
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"❌ Failed to delete employee {employee_id}: {e}")
            return False
    
    def search_employees(self, query: Dict) -> List[Dict]:
        """Search employees with custom query"""
        try:
            employees = list(self.employees_collection.find(query))
            
            # Convert ObjectId to string
            for emp in employees:
                emp["_id"] = str(emp["_id"])
            
            return employees
            
        except Exception as e:
            logger.error(f"❌ Failed to search employees: {e}")
            return []
    
    def get_employee_stats(self) -> Dict:
        """Get employee statistics"""
        try:
            total = self.employees_collection.count_documents({})
            active = self.employees_collection.count_documents({"is_active": True})
            with_biometric = self.employees_collection.count_documents({"biometric_data": {"$ne": {}}})
            
            return {
                "total": total,
                "active": active,
                "with_biometric": with_biometric,
                "inactive": total - active
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get employee stats: {e}")
            return {"total": 0, "active": 0, "with_biometric": 0, "inactive": 0}
    
    def add_camera(self, camera_data: Dict) -> bool:
        """Add camera to MongoDB"""
        try:
            if self.cameras_collection is None:
                return False
            
            # Check if camera_id already exists
            existing = self.cameras_collection.find_one({"camera_id": camera_data.get("camera_id")})
            if existing:
                logger.warning(f"Camera ID {camera_data.get('camera_id')} already exists")
                return False
            
            document = {
                "camera_id": camera_data.get("camera_id"),
                "name": camera_data.get("name"),
                "source": camera_data.get("source"),
                "location": camera_data.get("location", ""),
                "camera_type": camera_data.get("camera_type", "security"),
                "is_active": False,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            self.cameras_collection.replace_one(
                {"camera_id": camera_data.get("camera_id")},
                document,
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add camera: {e}")
            return False
    
    def get_all_cameras(self) -> List[Dict]:
        """Get all cameras from MongoDB"""
        try:
            if self.cameras_collection is None:
                return []
            cameras = list(self.cameras_collection.find({}))
            for cam in cameras:
                cam["_id"] = str(cam["_id"])
            return cameras
        except Exception as e:
            logger.error(f"Failed to get cameras: {e}")
            return []
    
    def update_camera_status(self, camera_id: str, is_active: bool) -> bool:
        """Update camera active status"""
        try:
            if self.cameras_collection is None:
                return False
            result = self.cameras_collection.update_one(
                {"camera_id": camera_id},
                {"$set": {"is_active": is_active, "updated_at": datetime.now()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update camera status: {e}")
            return False
    
    def delete_camera(self, camera_id: str) -> bool:
        """Delete camera from MongoDB"""
        try:
            if self.cameras_collection is None:
                return False
            result = self.cameras_collection.delete_one({"camera_id": camera_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete camera: {e}")
            return False
    
    def create_attendance(self, attendance_data: Dict) -> bool:
        """Create attendance record"""
        try:
            if self.attendance_collection is None:
                return False
            self.attendance_collection.insert_one(attendance_data)
            return True
        except Exception as e:
            logger.error(f"Failed to create attendance: {e}")
            return False
    
    def get_attendance(self, employee_id: str, date: str) -> Optional[Dict]:
        """Get attendance for employee on specific date"""
        try:
            if self.attendance_collection is None:
                return None
            return self.attendance_collection.find_one({"employee_id": employee_id, "date": date})
        except Exception as e:
            logger.error(f"Failed to get attendance: {e}")
            return None
    
    def update_attendance(self, employee_id: str, date: str, update_data: Dict) -> bool:
        """Update attendance record"""
        try:
            if self.attendance_collection is None:
                return False
            result = self.attendance_collection.update_one(
                {"employee_id": employee_id, "date": date},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update attendance: {e}")
            return False
    
    def get_monthly_attendance(self, employee_id: str, year: int, month: int) -> List[Dict]:
        """Get full month attendance for employee"""
        try:
            if self.attendance_collection is None:
                return []
            date_pattern = f"{year}-{month:02d}"
            records = list(self.attendance_collection.find({
                "employee_id": employee_id,
                "date": {"$regex": f"^{date_pattern}"}
            }).sort("date", 1))
            for rec in records:
                rec["_id"] = str(rec["_id"])
            return records
        except Exception as e:
            logger.error(f"Failed to get monthly attendance: {e}")
            return []
    
    def store_facial_biometric_data(self, employee_id: str, biometric_analysis: Dict) -> bool:
        """Store comprehensive facial biometric analysis data"""
        try:
            if self.employees_collection is None:
                return False
            
            # Create biometric data structure
            biometric_data = {
                "facial_analysis": biometric_analysis,
                "registration_timestamp": datetime.now(),
                "ml_service_used": biometric_analysis.get('services_used', []),
                "quality_scores": self._extract_quality_scores(biometric_analysis),
                "facial_features": self._extract_facial_features(biometric_analysis),
                "biometric_templates": self._create_biometric_templates(biometric_analysis),
                "security_level": "high" if len(biometric_analysis.get('services_used', [])) > 1 else "medium"
            }
            
            # Update employee with biometric data
            result = self.employees_collection.update_one(
                {"employee_id": employee_id},
                {
                    "$set": {
                        "facial_biometric_data": biometric_data,
                        "biometric_registered": True,
                        "biometric_registration_date": datetime.now(),
                        "updated_at": datetime.now()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Failed to store facial biometric data for {employee_id}: {e}")
            return False
    
    def get_facial_biometric_data(self, employee_id: str) -> Optional[Dict]:
        """Get facial biometric data for employee"""
        try:
            employee = self.get_employee(employee_id)
            if employee:
                return employee.get('facial_biometric_data')
            return None
            
        except Exception as e:
            logger.error(f"Failed to get facial biometric data for {employee_id}: {e}")
            return None
    
    def store_biometric_capture_session(self, employee_id: str, capture_data: List[Dict]) -> str:
        """Store biometric capture session with multiple angles"""
        try:
            if self.db is None:
                return None
            
            # Create biometric captures collection if not exists
            captures_collection = self.db.biometric_captures
            
            session_data = {
                "employee_id": employee_id,
                "session_id": f"{employee_id}_{int(datetime.now().timestamp())}",
                "capture_timestamp": datetime.now(),
                "captures": capture_data,
                "total_captures": len(capture_data),
                "angles_captured": [cap.get('angle') for cap in capture_data],
                "processing_status": "pending",
                "ml_analysis_results": []
            }
            
            result = captures_collection.insert_one(session_data)
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Failed to store capture session for {employee_id}: {e}")
            return None
    
    def update_capture_session_analysis(self, session_id: str, analysis_results: List[Dict]) -> bool:
        """Update capture session with ML analysis results"""
        try:
            if self.db is None:
                return False
            
            captures_collection = self.db.biometric_captures
            
            result = captures_collection.update_one(
                {"_id": session_id},
                {
                    "$set": {
                        "ml_analysis_results": analysis_results,
                        "processing_status": "completed",
                        "analysis_timestamp": datetime.now()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Failed to update capture session analysis: {e}")
            return False
    
    def get_biometric_templates_for_recognition(self, employee_id: str = None) -> List[Dict]:
        """Get biometric templates for face recognition"""
        try:
            if self.employees_collection is None:
                return []
            
            query = {"biometric_registered": True}
            if employee_id:
                query["employee_id"] = employee_id
            
            employees = list(self.employees_collection.find(query, {
                "employee_id": 1,
                "name": 1,
                "facial_biometric_data.biometric_templates": 1,
                "facial_biometric_data.quality_scores": 1
            }))
            
            templates = []
            for emp in employees:
                biometric_data = emp.get('facial_biometric_data', {})
                templates.append({
                    "employee_id": emp['employee_id'],
                    "name": emp['name'],
                    "templates": biometric_data.get('biometric_templates', {}),
                    "quality_scores": biometric_data.get('quality_scores', {})
                })
            
            return templates
            
        except Exception as e:
            logger.error(f"Failed to get biometric templates: {e}")
            return []
    
    def _extract_quality_scores(self, analysis: Dict) -> Dict:
        """Extract quality scores from analysis"""
        primary = analysis.get('primary_analysis', {})
        combined = analysis.get('combined_features', {})
        
        return {
            "overall_quality": combined.get('quality_score', 0),
            "face_detection_confidence": primary.get('primary_face', {}).get('confidence', 0),
            "service_used": primary.get('service', 'unknown'),
            "landmark_count": combined.get('landmark_count', 0),
            "processing_timestamp": datetime.now().isoformat()
        }
    
    def _extract_facial_features(self, analysis: Dict) -> Dict:
        """Extract facial features from analysis"""
        primary = analysis.get('primary_analysis', {})
        advanced = primary.get('advanced_features', {})
        
        return {
            "facial_landmarks": advanced.get('facial_landmarks', 0),
            "emotion_analysis": advanced.get('emotion_analysis', {}),
            "age_gender": advanced.get('age_gender', {}),
            "quality_metrics": advanced.get('quality_metrics', {}),
            "head_pose": advanced.get('head_pose', {}),
            "bounding_box": primary.get('primary_face', {}).get('bounding_box', {})
        }
    
    def _create_biometric_templates(self, analysis: Dict) -> Dict:
        """Create biometric templates for recognition"""
        combined = analysis.get('combined_features', {})
        primary = analysis.get('primary_analysis', {})
        
        return {
            "feature_vector": combined,
            "face_encoding": primary.get('primary_face', {}).get('landmarks', {}),
            "service_specific_data": {
                "service": primary.get('service', 'unknown'),
                "face_id": primary.get('primary_face', {}).get('face_id', ''),
                "confidence": primary.get('primary_face', {}).get('confidence', 0)
            },
            "template_version": "1.0",
            "created_at": datetime.now().isoformat()
        }

# Global MongoDB service instance
mongodb_service = MongoDBService()
