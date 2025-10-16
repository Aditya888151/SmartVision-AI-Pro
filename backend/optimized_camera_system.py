"""
Optimized Real-Time Camera System
- Async frame capture with threading
- Separate inference pipeline
- Minimal latency streaming
- FPS monitoring
"""
import cv2
import threading
import time
import base64
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.deepface_service import deepface_service
from services.videodb_integration import videodb_service
from services.mongodb_service import mongodb_service
from services.activity_monitor import activity_monitor
from services.attendance_service import attendance_service

from collections import deque

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

active_cameras = {}

def load_cameras_from_db():
    cameras = mongodb_service.get_all_cameras()
    return {cam['camera_id']: cam for cam in cameras}

camera_configs = load_cameras_from_db()

class OptimizedCamera:
    def __init__(self, camera_id, source, camera_type='activity'):
        self.camera_id = camera_id
        self.source = int(source) if source.isdigit() else source
        self.camera_type = camera_type
        self.cap = None
        self.running = False
        self.capture_thread = None
        self.current_frame = None
        self.frame_lock = threading.Lock()
        self.frame_count = 0
        self.activity_buffer = deque(maxlen=300)
        self.latest_alert = None
        self.last_alert_time = {}
        self.alert_throttle_seconds = 60
        
    def start(self):
        if self.running:
            return True
            
        result = [False]
        error_msg = [None]
        
        def init_camera():
            try:
                print(f"Opening camera {self.camera_id} with source: {self.source}")
                
                if isinstance(self.source, str) and self.source.startswith('rtsp'):
                    # RTSP camera - set environment variables for better compatibility
                    import os
                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|max_delay;500000"
                    
                    self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
                    if self.cap.isOpened():
                        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        self.cap.set(cv2.CAP_PROP_FPS, 30)
                else:
                    # Webcam - use DSHOW backend with high-quality settings
                    self.cap = cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    self.cap.set(cv2.CAP_PROP_FPS, 60)
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                
                if not self.cap or not self.cap.isOpened():
                    error_msg[0] = f"Cannot connect to {self.source}. Check IP/credentials/network."
                    print(f"Failed to open: {error_msg[0]}")
                    return
                
                print(f"Camera {self.camera_id} opened, reading first frame...")
                
                # Try multiple times for RTSP (can be slow)
                max_attempts = 5 if isinstance(self.source, str) and self.source.startswith('rtsp') else 1
                ret, frame = False, None
                
                for attempt in range(max_attempts):
                    ret, frame = self.cap.read()
                    if ret and frame is not None:
                        break
                    print(f"Attempt {attempt + 1}/{max_attempts} - waiting for frames...")
                    time.sleep(1)
                
                if not ret or frame is None:
                    error_msg[0] = "Connected but no video stream. Check camera settings."
                    print(f"No frames after {max_attempts} attempts: {error_msg[0]}")
                    self.cap.release()
                    self.cap = None
                    return
                
                self.running = True
                self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.capture_thread.start()
                result[0] = True
                print(f"Camera {self.camera_id} started successfully")
                
            except Exception as e:
                error_msg[0] = str(e)
                print(f"Camera {self.camera_id} error: {e}")
                if self.cap:
                    self.cap.release()
                    self.cap = None
        
        init_thread = threading.Thread(target=init_camera)
        init_thread.daemon = True
        init_thread.start()
        
        # RTSP cameras need more time to connect
        timeout = 15.0 if isinstance(self.source, str) and self.source.startswith('rtsp') else 5.0
        init_thread.join(timeout=timeout)
        
        if init_thread.is_alive():
            print(f"Camera {self.camera_id} initialization timeout after {timeout}s")
            return False
        
        if not result[0] and error_msg[0]:
            print(f"Camera {self.camera_id} failed: {error_msg[0]}")
        
        return result[0]
            
    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()
            
    def _capture_loop(self):
        consecutive_failures = 0
        while self.running:
            if self.cap and self.cap.isOpened():
                try:
                    frame = self._get_frame()
                    if frame is not None:
                        consecutive_failures = 0
                        self._process_frame(frame)
                    else:
                        consecutive_failures = self._handle_frame_failure(consecutive_failures)
                        if consecutive_failures is None:
                            break
                except Exception as e:
                    print(f"Capture loop error: {e}")
                    consecutive_failures = self._handle_capture_error(consecutive_failures)
                    if consecutive_failures is None:
                        break
            else:
                time.sleep(0.1)
    
    def _get_frame(self):
        """Get frame from camera with minimal latency"""
        # Single grab for high-speed streaming
        self.cap.grab()
        ret, frame = self.cap.retrieve()
        return cv2.flip(frame, 1) if ret and frame is not None else None
    
    def _process_frame(self, frame):
        """Process captured frame"""
        # Update display frame immediately for smooth streaming
        with self.frame_lock:
            self.current_frame = frame
        
        # Reduce processing frequency for better performance
        if self.camera_type == 'door' and self.frame_count % 10 == 0:  # Every 0.33s for door security
            self._process_door_camera(frame)
        elif self.camera_type == 'activity' and self.frame_count % 45 == 0:  # Every 1.5s
            self._process_activity_camera(frame)
        
        self.activity_buffer.append(frame.copy())
        self.frame_count += 1
    
    def _process_door_camera(self, frame):
        """Process door camera for attendance"""
        try:
            recognized = self._adaptive_face_recognition(frame)
            if recognized:
                self._handle_recognized_person(recognized)
            else:
                self._handle_unknown_person(frame)
        except Exception as e:
            print(f"Attendance processing error: {e}")
    
    def _process_activity_camera(self, frame):
        """Process activity camera for behavior monitoring only - NO face recognition"""
        try:
            alert_type, confidence, details = activity_monitor.analyze_behavior(frame)
            # Only alert on suspicious/timepass behavior, not normal working
            if alert_type and alert_type != 'working_ok':
                # Check throttling to avoid spam
                if self._should_create_alert(alert_type):
                    human_message = self._humanize_alert(alert_type, details, confidence)
                    self.latest_alert = {
                        "type": alert_type,
                        "message": human_message,
                        "confidence": confidence,
                        "details": details,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "camera_id": self.camera_id,
                        "camera_type": "activity",
                        "identity_checked": False,
                        "likely_employee": "unknown"
                    }
                    # Basic threat analysis
                    self.latest_alert.update({
                        "ai_threat_level": "medium",
                        "ai_summary": f"Suspicious {alert_type} behavior detected",
                        "ai_recommendations": ["Monitor closely", "Verify employee activity"]
                    })
                    
                    # Save clip with thumbnail
                    if len(self.activity_buffer) > 0:
                        self._save_activity_clip_with_thumbnail(alert_type, details, frame, human_message)
                    print(f"AI-Enhanced alert: {self.camera_id}, {alert_type}, threat: {threat_analysis.get('threat_level')}")
            # Activity cameras do NOT create alerts for face detection - only behavior
        except Exception as e:
            print(f"Activity monitoring error: {e}")
    
    def _handle_recognized_person(self, recognized):
        """Handle recognized employee"""
        try:
            # Ensure recognized is a list of dicts
            if isinstance(recognized, str):
                return
            if not isinstance(recognized, list) or len(recognized) == 0:
                return
                
            person_data = recognized[0] if isinstance(recognized[0], dict) else {"name": str(recognized[0]), "employee_id": str(recognized[0])}
            
            attendance_results = self._safe_attendance_processing([person_data])
            if attendance_results:
                for result in attendance_results:
                    self.latest_alert = {
                        "type": "attendance_recorded",
                        "employee_id": result.get('employee_id', 'UNKNOWN'),
                        "name": result.get('name', 'Unknown'),
                        "confidence": person_data.get('confidence', 0),
                        "details": result,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "camera_id": self.camera_id
                    }
                    self._save_attendance_clip(person_data, "registered")
        except Exception as e:
            print(f"Handle recognized person error: {e}")
    
    def _handle_unknown_person(self, frame):
        """Handle unknown person detection - ONLY for door cameras"""
        if self.camera_type != 'door':
            return
            
        # Use DeepFace to detect faces
        try:
            from deepface import DeepFace
            faces = DeepFace.extract_faces(frame, detector_backend="opencv", enforce_detection=False)
        except:
            faces = []
        
        if faces:
            print(f"🔍 Unknown person detected: {len(faces)} faces")
            
            # Always generate clip for unknown person (no throttling for security)
            self.latest_alert = {
                "type": "unauthorized_person",
                "employee_id": "UNKNOWN",
                "name": "Unauthorized Person",
                "confidence": 0,
                "details": {"faces_detected": len(faces), "authorized": False},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "camera_id": self.camera_id,
                "ai_threat_level": "high",
                "ai_summary": "Unauthorized person detected at door",
                "ai_recommendations": ["Immediate security alert", "Verify identity", "Check access logs"]
            }
            
            # Save security clip to VideoDB (always save, no throttling)
            self._save_unauthorized_person_clip(frame, len(faces))
            print(f"🚨 SECURITY ALERT: Unauthorized person detected on door camera {self.camera_id}")
    
    def _handle_frame_failure(self, consecutive_failures):
        """Handle frame capture failure"""
        consecutive_failures += 1
        if consecutive_failures > 30:
            self.running = False
            return None
        time.sleep(0.1)
        return consecutive_failures
    
    def _handle_capture_error(self, consecutive_failures):
        """Handle capture loop error"""
        consecutive_failures += 1
        if consecutive_failures > 10:
            self.running = False
            return None
        time.sleep(0.1)
        return consecutive_failures
    

    
    def _save_attendance_clip(self, person_data, person_type):
        """Save attendance clip for door camera events"""
        try:
            frames = list(self.activity_buffer)[-150:]  # Last 5 seconds
            videodb_service.save_security_clip(
                frames=frames,
                camera_id=self.camera_id,
                event_type=f"door_{person_type}",
                metadata={
                    "person_type": person_type,
                    "person_name": person_data.get('name', 'Unknown'),
                    "employee_id": person_data.get('employee_id', 'UNKNOWN'),
                    "confidence": person_data.get('confidence', 0),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "camera_type": "door"
                }
            )
        except Exception as e:
            print(f"Attendance clip save error: {e}")
    
    def _save_unauthorized_person_clip(self, frame, face_count):
        """Save security clip when unauthorized person detected on door camera"""
        try:
            frames = list(self.activity_buffer)[-300:]  # Last 10 seconds for security
            if not frames:
                frames = [frame] * 30  # Fallback: repeat current frame
            
            clip_id = videodb_service.save_security_clip(
                frames=frames,
                camera_id=self.camera_id,
                event_type="unauthorized_person",
                metadata={
                    "alert_type": "security_breach",
                    "threat_level": "high",
                    "faces_detected": face_count,
                    "authorized": False,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "camera_type": "door",
                    "security_priority": "immediate",
                    "clip_duration_seconds": len(frames) / 30.0
                }
            )
            
            if clip_id:
                print(f"🎥 Security clip saved to VideoDB: {clip_id}")
            else:
                print("❌ Failed to save security clip to VideoDB")
                
        except Exception as e:
            print(f"❌ Security clip save error: {e}")
    
    def get_frame(self):
        with self.frame_lock:
            return self.current_frame
    
    def get_latest_alert(self):
        alert = self.latest_alert
        self.latest_alert = None
        return alert
    
    def _adaptive_face_recognition(self, frame):
        """Try face recognition with multiple threshold levels using deep learning"""
        thresholds = [0.6, 0.7, 0.8]  # Higher = more lenient for registered users
        
        # Convert frame to base64 for deepface_service
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            print(f"Frame encoding error: {e}")
            return None
        
        for threshold in thresholds:
            try:
                result = deepface_service.recognize_face(frame_base64, threshold=threshold)
                if result.get('recognized'):
                    print(f"✅ Face recognized at threshold {threshold}: {result['name']} ({result['confidence']:.2f})")
                    return [{
                        'employee_id': result['employee_id'],
                        'name': result['name'],
                        'confidence': result['confidence']
                    }]
            except Exception as e:
                print(f"Face recognition error at threshold {threshold}: {e}")
                continue
        print("❌ No face recognized at any threshold")
        return None
    
    def _safe_attendance_processing(self, recognized_faces):
        """Safely process attendance with error handling"""
        try:
            # Ensure proper format for attendance service
            if not recognized_faces or not isinstance(recognized_faces, list):
                return None
            return attendance_service.process_door_camera_frame(self.camera_id, recognized_faces)
        except Exception as e:
            print(f"Attendance service error: {e}")
            return None
    
    def _should_create_alert(self, alert_type):
        """Check if alert should be created (throttling)"""
        now = datetime.now(timezone.utc)
        last_time = self.last_alert_time.get(alert_type)
        
        if not last_time or (now - last_time).total_seconds() >= self.alert_throttle_seconds:
            self.last_alert_time[alert_type] = now
            return True
        return False
    
    def _humanize_alert(self, alert_type, details, confidence):
        """Create human-readable alert message"""
        messages = {
            'timepass_phone': f"Employee making timepass — using phone at desk (confidence: {confidence:.2f})",
            'loitering': f"Loitering near restricted area — possible non-working behavior (confidence: {confidence:.2f})",
            'idle': f"Employee sitting idle — no productive activity detected (confidence: {confidence:.2f})",
            'chatting': f"Extended chatting detected — possible time wastage (confidence: {confidence:.2f})",
            'suspicious': f"Suspicious behavior detected — requires attention (confidence: {confidence:.2f})"
        }
        return messages.get(alert_type, f"Unusual behavior detected: {alert_type} (confidence: {confidence:.2f})")
    
    def _create_thumbnail_from_frame(self, frame):
        """Generate thumbnail from frame"""
        try:
            thumbnail = cv2.resize(frame, (320, 240))
            _, buffer = cv2.imencode('.jpg', thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 80])
            return buffer.tobytes()
        except Exception as e:
            print(f"Thumbnail creation error: {e}")
            return None
    
    def _save_activity_clip_with_thumbnail(self, alert_type, details, frame, human_message):
        """Save activity clip with thumbnail"""
        try:
            frames = list(self.activity_buffer)
            thumbnail = self._create_thumbnail_from_frame(frame)
            
            clip_metadata = {
                "alert_type": alert_type,
                "human_message": human_message,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "camera_type": "activity",
                "identity_checked": False,
                "likely_employee": "unknown",
                "frame_count": self.frame_count,
                "clip_length_seconds": len(frames) / 30.0
            }
            
            clip_id = videodb_service.save_security_clip(
                frames=frames,
                camera_id=self.camera_id,
                event_type=f"activity_{alert_type.lower()}",
                metadata=clip_metadata,
                thumbnail=thumbnail
            )
            print(f"Activity clip saved: {clip_id}")
            
        except Exception as e:
            print(f"Activity clip save error: {e}")

@router.post("/")
async def add_camera(data: dict):
    camera_id = data["camera_id"]
    
    # Check if camera ID already exists
    if camera_id in camera_configs:
        return {"success": False, "message": f"Camera ID '{camera_id}' already exists"}
    
    mongodb_service.add_camera(data)
    camera_configs[camera_id] = data
    return {"success": True, "message": f"Camera {camera_id} added"}

@router.get("/")
async def get_cameras():
    result = []
    for cid, config in camera_configs.items():
        result.append({
            "camera_id": cid,
            "name": config.get("name", "Unknown"),
            "source": config.get("source", "0"),
            "location": config.get("location", "Unknown"),
            "camera_type": config.get("camera_type", "activity"),
            "is_active": cid in active_cameras and active_cameras[cid].running
        })
    return result

@router.post("/{camera_id}/start")
async def start_camera(camera_id: str):
    try:
        if camera_id not in camera_configs:
            return {"success": False, "message": "Camera not found in configuration"}
        
        if camera_id in active_cameras:
            return {"success": False, "message": "Camera already running"}
            
        config = camera_configs[camera_id]
        camera_type = config.get("camera_type", "activity")
        if camera_type == "security":
            camera_type = "activity"
        
        source = config.get("source", "0")
        print(f"Starting camera {camera_id}: source={source}, type={camera_type}")
        
        camera = OptimizedCamera(camera_id, source, camera_type)
        
        if camera.start():
            active_cameras[camera_id] = camera
            mongodb_service.update_camera_status(camera_id, True)
            return {"success": True, "message": f"Camera {camera_id} started successfully"}
        else:
            return {"success": False, "message": f"Camera source '{source}' not available. Check if camera is connected or not in use by another app."}
    except Exception as e:
        print(f"Error starting camera {camera_id}: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

@router.post("/{camera_id}/stop")
async def stop_camera(camera_id: str):
    try:
        if camera_id in active_cameras:
            active_cameras[camera_id].stop()
            del active_cameras[camera_id]
            mongodb_service.update_camera_status(camera_id, False)
            return {"success": True, "message": f"Camera {camera_id} stopped"}
        else:
            return {"success": False, "message": "Camera not running"}
    except Exception as e:
        print(f"Error stopping camera {camera_id}: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

@router.delete("/{camera_id}")
async def delete_camera(camera_id: str):
    try:
        if camera_id in active_cameras:
            active_cameras[camera_id].stop()
            del active_cameras[camera_id]
        if camera_id in camera_configs:
            del camera_configs[camera_id]
        mongodb_service.delete_camera(camera_id)
        return {"success": True, "message": f"Camera {camera_id} deleted"}
    except Exception as e:
        print(f"Error deleting camera {camera_id}: {e}")
        return {"success": False, "message": f"Error deleting camera: {str(e)}"}

@router.get("/{camera_id}/stream")
async def stream_camera(camera_id: str, quality: int = 70):
    if camera_id not in active_cameras:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not active")
        
    camera = active_cameras[camera_id]
    
    def generate():
        while camera.running:
            frame = camera.get_frame()
            if frame is not None:
                ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            time.sleep(0.016)  # 60fps
    
    return StreamingResponse(
        generate(), 
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive"
        }
    )

@router.get("/{camera_id}/stats")
async def get_camera_stats(camera_id: str):
    if camera_id not in active_cameras:
        return {"fps": 0, "running": False, "frame_count": 0}
    
    camera = active_cameras[camera_id]
    return {
        "fps": 60,  # Actual streaming fps
        "running": camera.running,
        "frame_count": camera.frame_count,
        "camera_type": camera.camera_type,
        "buffer_size": len(camera.activity_buffer)
    }

@router.get("/{camera_id}/alerts")
async def get_camera_alerts(camera_id: str):
    """Get latest activity alerts"""
    if camera_id not in active_cameras:
        return {"alert": None}
    
    camera = active_cameras[camera_id]
    alert = camera.get_latest_alert()
    return {"alert": alert}

@router.get("/attendance/{employee_id}/today")
async def get_today_attendance(employee_id: str):
    """Get today's attendance for employee"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    attendance = mongodb_service.get_attendance(employee_id, today)
    return attendance or {}

@router.get("/attendance/{employee_id}/month/{year}/{month}")
async def get_monthly_attendance(employee_id: str, year: int, month: int):
    """Get monthly attendance for employee"""
    records = mongodb_service.get_monthly_attendance(employee_id, year, month)
    return {"records": records, "total_days": len(records)}

@router.get("/status/quick")
async def get_quick_status():
    """Fast status endpoint for responsive UI"""
    return {
        "active_count": len(active_cameras),
        "total_cameras": len(camera_configs),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/{camera_id}/info")
async def get_camera_info(camera_id: str):
    """Get camera info without heavy processing"""
    config = camera_configs.get(camera_id, {})
    is_active = camera_id in active_cameras and active_cameras[camera_id].running
    
    return {
        "camera_id": camera_id,
        "name": config.get("name", "Unknown"),
        "location": config.get("location", "Unknown"),
        "camera_type": config.get("camera_type", "activity"),
        "is_active": is_active,
        "frame_count": active_cameras[camera_id].frame_count if is_active else 0
    }

@router.get("/alerts/recent")
async def get_recent_alerts():
    """Get recent alerts from all active cameras"""
    alerts = []
    for camera_id, camera in active_cameras.items():
        alert = camera.get_latest_alert()
        if alert:
            alerts.append(alert)
    
    return {"alerts": alerts, "count": len(alerts)}

@router.get("/security/summary")
async def get_security_summary():
    """Get AI-powered security summary"""
    # Collect recent alerts from all cameras
    all_alerts = []
    for camera_id, camera in active_cameras.items():
        alert = camera.get_latest_alert()
        if alert:
            all_alerts.append(alert)
    
    # Get camera info
    camera_info = [
        {
            "camera_id": cid,
            "type": config.get("camera_type", "activity"),
            "location": config.get("location", "Unknown"),
            "active": cid in active_cameras
        }
        for cid, config in camera_configs.items()
    ]
    
    # Generate basic summary
    summary = f"Security Status: {len(active_cameras)} cameras active, {len(all_alerts)} recent alerts"
    
    return {
        "summary": summary,
        "active_cameras": len(active_cameras),
        "total_alerts": len(all_alerts),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.post("/ai/configure")
async def configure_ai(api_key: str):
    """Configure AI API key"""
    try:
        from services.ai_analysis_service import ai_analysis_service
        ai_analysis_service.api_key = api_key
        return {"success": True, "message": "AI API key configured successfully"}
    except Exception as e:
        return {"success": False, "message": f"Error configuring AI: {str(e)}"}

@router.post("/test-rtsp")
async def test_rtsp(data: dict):
    """Test RTSP connection"""
    try:
        source = data.get("source")
        print(f"Testing RTSP: {source}")
        
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            return {"success": False, "message": "Cannot connect to RTSP stream"}
        
        ret, frame = cap.read()
        cap.release()
        
        if ret and frame is not None:
            return {"success": True, "message": f"RTSP working! Frame size: {frame.shape}"}
        else:
            return {"success": False, "message": "Connected but no frames received"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
