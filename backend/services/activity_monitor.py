"""
Activity Monitoring Service
Detects idle employees, wandering, and unusual behavior
Uses motion detection + optional person tracking
"""
import cv2
import numpy as np
from collections import deque
from datetime import datetime
import time

class ActivityMonitor:
    def __init__(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=16, detectShadows=False
        )
        self.motion_history = deque(maxlen=300)  # 10 seconds at 30fps
        self.position_history = deque(maxlen=150)  # 5 seconds
        self.last_alert_time = 0
        self.alert_cooldown = 60  # 1 minute between alerts
        
    def detect_motion(self, frame):
        """Detect motion in frame"""
        fg_mask = self.bg_subtractor.apply(frame)
        fg_mask = cv2.threshold(fg_mask, 244, 255, cv2.THRESH_BINARY)[1]
        fg_mask = cv2.erode(fg_mask, None, iterations=1)
        fg_mask = cv2.dilate(fg_mask, None, iterations=2)
        
        motion_pixels = cv2.countNonZero(fg_mask)
        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        motion_ratio = motion_pixels / total_pixels
        
        return motion_ratio, fg_mask
    
    def find_person_center(self, fg_mask):
        """Find center of person in frame"""
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find largest contour (likely person)
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        
        if area < 5000:  # Too small to be person
            return None
        
        M = cv2.moments(largest)
        if M["m00"] == 0:
            return None
        
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        
        return (cx, cy, area)
    
    def analyze_behavior(self, frame):
        """
        Analyze employee behavior
        Returns: (alert_type, confidence, details)
        """
        motion_ratio, fg_mask = self.detect_motion(frame)
        self.motion_history.append(motion_ratio)
        
        person_data = self.find_person_center(fg_mask)
        if person_data:
            self.position_history.append(person_data)
        
        # Check cooldown
        if time.time() - self.last_alert_time < self.alert_cooldown:
            return None, 0, {}
        
        # Analyze patterns
        if len(self.motion_history) < 150:
            return None, 0, {}
        
        recent_motion = list(self.motion_history)[-150:]
        avg_motion = np.mean(recent_motion)
        
        # 1. IDLE DETECTION - Very low motion for extended period
        if avg_motion < 0.005:  # Almost no movement
            idle_duration = len([m for m in recent_motion if m < 0.005]) / 30
            if idle_duration > 3:  # Idle for 3+ seconds
                self.last_alert_time = time.time()
                return "IDLE", 0.85, {
                    "duration": f"{idle_duration:.1f}s",
                    "motion_level": f"{avg_motion*100:.2f}%"
                }
        
        # 2. WANDERING DETECTION - High motion + position changes
        if len(self.position_history) >= 100:
            positions = list(self.position_history)[-100:]
            
            # Calculate movement distance
            total_distance = 0
            for i in range(1, len(positions)):
                dx = positions[i][0] - positions[i-1][0]
                dy = positions[i][1] - positions[i-1][1]
                total_distance += np.sqrt(dx*dx + dy*dy)
            
            # High movement = wandering
            if total_distance > 500 and avg_motion > 0.02:
                self.last_alert_time = time.time()
                return "WANDERING", 0.80, {
                    "distance": f"{total_distance:.0f}px",
                    "motion_level": f"{avg_motion*100:.2f}%"
                }
        
        # 3. ABSENCE DETECTION - No person detected
        if person_data is None and len(self.position_history) > 0:
            # Person was there, now gone
            absence_frames = 0
            for i in range(len(self.motion_history)-1, max(0, len(self.motion_history)-90), -1):
                if self.motion_history[i] < 0.001:
                    absence_frames += 1
            
            if absence_frames > 60:  # 2 seconds of absence
                self.last_alert_time = time.time()
                return "ABSENT", 0.75, {
                    "duration": f"{absence_frames/30:.1f}s"
                }
        
        return None, 0, {}
    
    def reset(self):
        """Reset monitoring state"""
        self.motion_history.clear()
        self.position_history.clear()
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=16, detectShadows=False
        )

# Global instance
activity_monitor = ActivityMonitor()
