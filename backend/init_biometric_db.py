import sqlite3
import os

def init_biometric_tables():
    """Initialize biometric tables in the database"""
    db_path = os.path.join(os.path.dirname(__file__), 'smartvision.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create attendance_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            check_in_time DATETIME NOT NULL,
            check_out_time DATETIME,
            biometric_session_id TEXT,
            capture_quality REAL,
            retinal_quality REAL,
            verification_method TEXT DEFAULT 'advanced_biometric',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create biometric_captures table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS biometric_captures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            angle TEXT NOT NULL,
            quality_score REAL NOT NULL,
            face_encoding TEXT,
            retinal_features TEXT,
            head_pose_yaw REAL,
            head_pose_pitch REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create biometric_templates table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS biometric_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            template_type TEXT NOT NULL,
            template_data TEXT NOT NULL,
            quality_score REAL,
            created_from_session TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attendance_employee_time ON attendance_logs(employee_id, check_in_time)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_biometric_session ON biometric_captures(session_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_biometric_employee ON biometric_captures(employee_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_templates_employee ON biometric_templates(employee_id, is_active)')
    
    conn.commit()
    conn.close()
    print("Biometric database tables initialized successfully")

if __name__ == "__main__":
    init_biometric_tables()