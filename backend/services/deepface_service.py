"""
DeepFace Service for Facial Recognition and Training
Uses DeepFace library for face detection, recognition, and attendance
"""

import cv2
import numpy as np
import base64
import os
import pickle
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import json

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("DeepFace not installed. Install with: pip install deepface")

from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

class DeepFaceService:
    def __init__(self):
        self.model_name = "VGG-Face"  # Options: VGG-Face, Facenet, OpenFace, DeepID, ArcFace
        self.detector_backend = "opencv"  # Options: opencv, ssd, dlib, mtcnn, retinaface
        self.distance_metric = "cosine"  # Options: cosine, euclidean, euclidean_l2
        self.face_db_path = "face_database"
        self.embeddings_file = "face_embeddings.pkl"
        
        # Create face database directory
        os.makedirs(self.face_db_path, exist_ok=True)
        
        # Load existing embeddings
        self.face_embeddings = self.load_embeddings()
        
        logger.info(f"DeepFace service initialized with {self.model_name}")
    
    def decode_image(self, image_data: str) -> np.ndarray:
        """Decode base64 image to numpy array"""
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Image decode error: {e}")
            return None
    
    def extract_face_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Extract face embedding using DeepFace"""
        if not DEEPFACE_AVAILABLE:
            logger.error("DeepFace not available")
            return None
        
        try:
            # Get face embedding
            embedding = DeepFace.represent(
                img_path=image,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=False
            )
            
            if embedding and len(embedding) > 0:
                return np.array(embedding[0]["embedding"])
            return None
            
        except Exception as e:
            logger.error(f"Face embedding extraction failed: {e}")
            return None
    
    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """Detect faces in image using DeepFace"""
        if not DEEPFACE_AVAILABLE:
            return []
        
        try:
            # Detect faces
            faces = DeepFace.extract_faces(
                img_path=image,
                detector_backend=self.detector_backend,
                enforce_detection=False
            )
            
            face_regions = []
            for i, face in enumerate(faces):
                if face is not None:
                    # Convert face to proper format
                    face_array = (face * 255).astype(np.uint8)
                    face_regions.append({
                        'face_id': i,
                        'face_array': face_array,
                        'confidence': 0.9  # DeepFace doesn't return confidence
                    })
            
            return face_regions
            
        except Exception as e:
            logger.error(f"Face detection failed: {e}")
            return []
    
    def register_employee_face(self, employee_id: str, image_data: str, angle: str = "frontal") -> Dict:
        """Register employee face with DeepFace"""
        try:
            # Decode image
            image = self.decode_image(image_data)
            if image is None:
                return {'success': False, 'error': 'Invalid image data'}
            
            # Extract face embedding
            embedding = self.extract_face_embedding(image)
            if embedding is None:
                return {'success': False, 'error': 'No face detected or embedding failed'}
            
            # Store embedding
            if employee_id not in self.face_embeddings:
                self.face_embeddings[employee_id] = {}
            
            self.face_embeddings[employee_id][angle] = {
                'embedding': embedding.tolist(),
                'timestamp': datetime.now().isoformat(),
                'model': self.model_name
            }
            
            # Save to file
            self.save_embeddings()
            
            # Update MongoDB
            employee_data = {
                'deepface_registered': True,
                'deepface_embeddings': self.face_embeddings[employee_id],
                'deepface_model': self.model_name,
                'last_training_date': datetime.now()
            }
            
            mongodb_service.update_employee(employee_id, employee_data)
            
            return {
                'success': True,
                'employee_id': employee_id,
                'angle': angle,
                'embedding_size': len(embedding),
                'model_used': self.model_name
            }
            
        except Exception as e:
            logger.error(f"Employee registration failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def recognize_face(self, image_data: str, threshold: float = 0.6) -> Dict:
        """Recognize face using trained DeepFace embeddings"""
        try:
            # Decode image
            image = self.decode_image(image_data)
            if image is None:
                return {'recognized': False, 'error': 'Invalid image data'}
            
            # Extract embedding from input image
            input_embedding = self.extract_face_embedding(image)
            if input_embedding is None:
                return {'recognized': False, 'error': 'No face detected'}
            
            # Compare with stored embeddings
            best_match = None
            best_distance = float('inf')
            
            for employee_id, angles in self.face_embeddings.items():
                for angle, data in angles.items():
                    stored_embedding = np.array(data['embedding'])
                    
                    # Calculate cosine distance
                    if self.distance_metric == "cosine":
                        distance = 1 - np.dot(input_embedding, stored_embedding) / (
                            np.linalg.norm(input_embedding) * np.linalg.norm(stored_embedding)
                        )
                    else:  # euclidean
                        distance = np.linalg.norm(input_embedding - stored_embedding)
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_match = {
                            'employee_id': employee_id,
                            'angle': angle,
                            'distance': distance,
                            'confidence': 1 - distance if distance < 1 else 0
                        }
            
            # Check if match is good enough
            if best_match and best_distance < threshold:
                # Get employee details
                employee = mongodb_service.get_employee(best_match['employee_id'])
                
                return {
                    'recognized': True,
                    'employee_id': best_match['employee_id'],
                    'name': employee.get('name', 'Unknown') if employee else 'Unknown',
                    'confidence': best_match['confidence'],
                    'distance': best_distance,
                    'angle_matched': best_match['angle'],
                    'model_used': self.model_name
                }
            else:
                return {
                    'recognized': False,
                    'reason': 'No match found above threshold',
                    'best_distance': best_distance,
                    'threshold': threshold
                }
                
        except Exception as e:
            logger.error(f"Face recognition failed: {e}")
            return {'recognized': False, 'error': str(e)}
    
    def mark_attendance(self, employee_id: str, camera_id: str = "default") -> Dict:
        """Mark attendance for recognized employee"""
        try:
            from services.attendance_service import attendance_service
            
            # Create recognized face data for attendance service
            recognized_faces = [{
                'employee_id': employee_id,
                'name': 'Recognized Employee',
                'confidence': 0.9
            }]
            
            # Process attendance
            results = attendance_service.process_door_camera_frame(camera_id, recognized_faces)
            
            if results:
                return {
                    'success': True,
                    'attendance_marked': True,
                    'employee_id': employee_id,
                    'entry_type': results[0].get('type'),
                    'timestamp': results[0].get('time')
                }
            else:
                return {
                    'success': True,
                    'attendance_marked': False,
                    'reason': 'Outside shift hours or cooldown period'
                }
                
        except Exception as e:
            logger.error(f"Attendance marking failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def process_camera_frame(self, frame_data: str, camera_id: str = "default") -> Dict:
        """Process camera frame for real-time recognition and attendance"""
        try:
            # Recognize face
            recognition_result = self.recognize_face(frame_data)
            
            if recognition_result.get('recognized'):
                employee_id = recognition_result['employee_id']
                
                # Mark attendance
                attendance_result = self.mark_attendance(employee_id, camera_id)
                
                return {
                    'face_detected': True,
                    'recognized': True,
                    'employee_id': employee_id,
                    'name': recognition_result['name'],
                    'confidence': recognition_result['confidence'],
                    'attendance': attendance_result,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'face_detected': recognition_result.get('error') != 'No face detected',
                    'recognized': False,
                    'reason': recognition_result.get('reason', recognition_result.get('error')),
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Camera frame processing failed: {e}")
            return {'error': str(e)}
    
    def train_all_employees(self) -> Dict:
        """Train DeepFace with all employees from MongoDB"""
        try:
            employees = mongodb_service.get_all_employees()
            trained_count = 0
            failed_count = 0
            
            for employee in employees:
                employee_id = employee.get('employee_id')
                face_image = employee.get('face_image')
                
                if face_image:
                    result = self.register_employee_face(employee_id, face_image)
                    if result.get('success'):
                        trained_count += 1
                    else:
                        failed_count += 1
                        logger.warning(f"Training failed for {employee_id}: {result.get('error')}")
            
            return {
                'success': True,
                'total_employees': len(employees),
                'trained_successfully': trained_count,
                'failed': failed_count,
                'model_used': self.model_name
            }
            
        except Exception as e:
            logger.error(f"Training all employees failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_training_stats(self) -> Dict:
        """Get training statistics"""
        return {
            'total_trained_employees': len(self.face_embeddings),
            'model_used': self.model_name,
            'detector_backend': self.detector_backend,
            'distance_metric': self.distance_metric,
            'employees': list(self.face_embeddings.keys()),
            'deepface_available': DEEPFACE_AVAILABLE
        }
    
    def load_embeddings(self) -> Dict:
        """Load face embeddings from file"""
        try:
            if os.path.exists(self.embeddings_file):
                with open(self.embeddings_file, 'rb') as f:
                    return pickle.load(f)
        except Exception as e:
            logger.error(f"Loading embeddings failed: {e}")
        return {}
    
    def save_embeddings(self):
        """Save face embeddings to file"""
        try:
            with open(self.embeddings_file, 'wb') as f:
                pickle.dump(self.face_embeddings, f)
        except Exception as e:
            logger.error(f"Saving embeddings failed: {e}")

# Global service instance
deepface_service = DeepFaceService()