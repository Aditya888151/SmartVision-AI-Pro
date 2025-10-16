# Advanced Biometric Capture Setup Guide

## 1. Install Dependencies

### Backend Dependencies
```bash
cd backend
pip install -r requirements_biometric.txt
```

### Additional System Requirements
```bash
# For dlib (face recognition)
pip install cmake
pip install dlib

# For MediaPipe (Google's ML framework)
pip install mediapipe

# For OpenCV with optimizations
pip install opencv-contrib-python
```

## 2. Database Setup

Run the database schema update:
```bash
cd backend
sqlite3 smartvision.db < database_schema_biometric.sql
```

## 3. AI Model Downloads

The system will automatically download required models on first run:
- MediaPipe Face Mesh model (~2MB)
- MediaPipe Face Detection model (~1MB)
- Face recognition models (~100MB)

## 4. Camera Requirements

### Recommended Hardware:
- **Minimum**: 720p webcam with good lighting
- **Optimal**: 1080p+ camera with auto-focus
- **Distance**: Works from 2-15 feet from camera
- **Lighting**: Ensure even lighting on face

### Camera Settings:
- Resolution: 1280x720 minimum
- Frame rate: 30fps recommended
- Auto-focus: Enabled
- Auto-exposure: Enabled

## 5. Performance Optimization

### For High-Distance Capture (10+ feet):
1. Use high-resolution camera (1080p+)
2. Ensure good lighting conditions
3. Adjust quality thresholds in `advanced_biometric_service.py`:
   ```python
   self.min_face_size = 100  # Reduce for distant faces
   self.min_sharpness = 80   # Reduce threshold
   ```

### For Real-time Performance:
1. Adjust processing interval in React component:
   ```javascript
   // In AdvancedBiometricCapture.jsx
   }, 300); // Increase from 200ms to 300ms for slower devices
   ```

2. Enable GPU acceleration (if available):
   ```python
   # Add to advanced_biometric_service.py
   import cv2
   cv2.setUseOptimized(True)
   ```

## 6. Configuration Options

### Quality Thresholds (in `advanced_biometric_service.py`):
```python
# Adjust these values based on your requirements
self.min_face_size = 150      # Minimum face size in pixels
self.min_sharpness = 100      # Laplacian variance threshold
self.min_brightness = 50      # Minimum brightness
self.max_brightness = 200     # Maximum brightness
```

### Angle Detection Sensitivity:
```python
# Modify angle thresholds for easier/harder capture
self.angle_thresholds = {
    'frontal': {'yaw': (-20, 20), 'pitch': (-15, 15)},  # Wider range
    'left_profile': {'yaw': (20, 70), 'pitch': (-20, 20)},
    # ... adjust other angles
}
```

## 7. Usage Instructions

### For Employees:
1. Click "Advanced AI Capture" button
2. Position face in camera view
3. Follow on-screen instructions for each angle
4. System automatically captures when angle is detected
5. Wait for all 5 angles to complete
6. Attendance is logged automatically

### For Administrators:
1. Monitor capture quality in real-time
2. View session progress and statistics
3. Access detailed biometric data in database
4. Configure quality thresholds as needed

## 8. Troubleshooting

### Common Issues:

**Camera not detected:**
- Check browser permissions
- Ensure camera is not used by other applications
- Try different browsers (Chrome recommended)

**Poor quality captures:**
- Improve lighting conditions
- Move closer to camera (3-8 feet optimal)
- Ensure camera lens is clean
- Check camera focus settings

**Slow processing:**
- Reduce video resolution
- Increase processing interval
- Close other applications
- Check CPU/memory usage

**Angle not detected:**
- Move head more slowly
- Ensure good lighting on face
- Check if face is fully visible
- Adjust angle thresholds in code

### Performance Monitoring:
```python
# Add to advanced_biometric_service.py for debugging
import time
start_time = time.time()
# ... processing code ...
print(f"Processing time: {time.time() - start_time:.3f}s")
```

## 9. Security Considerations

- Biometric data is stored locally in SQLite database
- Face encodings are one-way hashed (cannot reconstruct face)
- Retinal patterns are stored as feature vectors only
- Session data is automatically cleaned up
- No biometric data is transmitted over network

## 10. API Endpoints

### Start Session:
```
POST /api/biometric/start-session
Body: {"employee_id": "EMP_001"}
```

### Process Frame:
```
POST /api/biometric/process-frame
Body: {
  "employee_id": "EMP_001",
  "session_id": "session_123",
  "frame_data": "data:image/jpeg;base64,..."
}
```

### Get Progress:
```
GET /api/biometric/session-progress/{session_id}
```

### Complete Attendance:
```
POST /api/biometric/complete-attendance
Body: {"employee_id": "EMP_001", "session_id": "session_123"}
```

## 11. Integration with Existing System

The advanced biometric system integrates seamlessly with your existing employee management:

- Uses same employee database
- Maintains compatibility with basic capture
- Adds enhanced security features
- Provides detailed analytics
- Supports both manual and automatic attendance logging

## 12. Future Enhancements

Planned improvements:
- Iris pattern recognition
- Liveness detection (anti-spoofing)
- Multi-person simultaneous capture
- Cloud-based AI processing
- Mobile app integration
- Voice recognition integration