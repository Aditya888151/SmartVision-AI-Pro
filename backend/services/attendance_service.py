"""
Automatic Attendance Service
Tracks employee entry/exit through door cameras
Records attendance with shift-aware timing
"""
from datetime import datetime, time as dt_time
from services.mongodb_service import mongodb_service

class AttendanceService:
    def __init__(self):
        self.recent_detections = {}  # Track recent detections to avoid duplicates
        self.cooldown = 30  # 30 seconds cooldown between same employee detections
    
    def is_within_shift(self, employee_id, current_time):
        """Check if current time is within employee shift (excluding lunch)"""
        employee = mongodb_service.get_employee(employee_id)
        if not employee:
            return False
        
        # Parse time in both 12h (AM/PM) and 24h format
        def parse_time(time_str, default):
            try:
                # Try 12-hour format first
                return datetime.strptime(time_str, '%I:%M %p').time()
            except:
                try:
                    # Try 24-hour format
                    return datetime.strptime(time_str, '%H:%M').time()
                except:
                    return datetime.strptime(default, '%I:%M %p').time()
        
        shift_start = parse_time(employee.get('shift_start', '10:30 AM'), '10:30 AM')
        shift_end = parse_time(employee.get('shift_end', '06:00 PM'), '06:00 PM')
        lunch_start = parse_time(employee.get('lunch_start', '01:30 PM'), '01:30 PM')
        lunch_end = parse_time(employee.get('lunch_end', '02:30 PM'), '02:30 PM')
        
        current = current_time.time()
        
        # Check if within shift hours
        if not (shift_start <= current <= shift_end):
            return False
        
        # Check if during lunch
        if lunch_start <= current <= lunch_end:
            return False
        
        return True
    
    def should_record(self, employee_id):
        """Check if enough time passed since last detection"""
        now = datetime.now()
        last_time = self.recent_detections.get(employee_id)
        
        if not last_time:
            return True
        
        elapsed = (now - last_time).total_seconds()
        return elapsed >= self.cooldown
    
    def record_attendance(self, employee_id, camera_id, recognized_faces):
        """Record attendance for detected employees"""
        now = datetime.now()
        
        # Check shift timing
        if not self.is_within_shift(employee_id, now):
            return None
        
        # Check cooldown
        if not self.should_record(employee_id):
            return None
        
        # Update cooldown tracker
        self.recent_detections[employee_id] = now
        
        # Get today's attendance
        today = now.strftime('%Y-%m-%d')
        attendance = mongodb_service.get_attendance(employee_id, today)
        
        if not attendance:
            # First entry of the day
            mongodb_service.create_attendance({
                'employee_id': employee_id,
                'date': today,
                'entries': [{
                    'type': 'entry',
                    'time': now.isoformat(),
                    'camera_id': camera_id
                }],
                'total_entries': 1,
                'total_exits': 0,
                'first_entry': now.isoformat(),
                'last_exit': None,
                'status': 'present'
            })
            return 'entry'
        else:
            # Determine if entry or exit based on last record
            entries = attendance.get('entries', [])
            last_entry = entries[-1] if entries else None
            
            if not last_entry or last_entry['type'] == 'exit':
                # Last was exit, so this is entry
                entry_type = 'entry'
            else:
                # Last was entry, so this is exit
                entry_type = 'exit'
            
            # Add new entry/exit
            entries.append({
                'type': entry_type,
                'time': now.isoformat(),
                'camera_id': camera_id
            })
            
            # Update counts
            total_entries = sum(1 for e in entries if e['type'] == 'entry')
            total_exits = sum(1 for e in entries if e['type'] == 'exit')
            
            # Update attendance
            update_data = {
                'entries': entries,
                'total_entries': total_entries,
                'total_exits': total_exits
            }
            
            if entry_type == 'exit':
                update_data['last_exit'] = now.isoformat()
            
            mongodb_service.update_attendance(employee_id, today, update_data)
            return entry_type
    
    def process_door_camera_frame(self, camera_id, recognized_faces):
        """Process multiple faces detected at door camera"""
        results = []
        
        for face in recognized_faces:
            employee_id = face.get('employee_id')
            if not employee_id or employee_id == 'Unknown':
                continue
            
            entry_type = self.record_attendance(employee_id, camera_id, recognized_faces)
            if entry_type:
                results.append({
                    'employee_id': employee_id,
                    'name': face.get('name', 'Unknown'),
                    'type': entry_type,
                    'time': datetime.now().isoformat()
                })
        
        return results

# Global instance
attendance_service = AttendanceService()
