-- Enhanced database schema for advanced biometric capture

-- Attendance logs with biometric data
CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    check_in_time DATETIME NOT NULL,
    check_out_time DATETIME,
    biometric_session_id TEXT,
    capture_quality REAL,
    retinal_quality REAL,
    verification_method TEXT DEFAULT 'advanced_biometric',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- Detailed biometric captures for each session
CREATE TABLE IF NOT EXISTS biometric_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    angle TEXT NOT NULL, -- frontal, left_profile, right_profile, up_angle, down_angle
    quality_score REAL NOT NULL,
    face_encoding TEXT, -- JSON array of face encoding
    retinal_features TEXT, -- JSON object with retinal analysis
    head_pose_yaw REAL,
    head_pose_pitch REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- Biometric templates for fast matching
CREATE TABLE IF NOT EXISTS biometric_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    template_type TEXT NOT NULL, -- 'face_encoding', 'retinal_pattern'
    template_data TEXT NOT NULL, -- JSON encoded template
    quality_score REAL,
    created_from_session TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_employee_time ON attendance_logs(employee_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_biometric_session ON biometric_captures(session_id);
CREATE INDEX IF NOT EXISTS idx_biometric_employee ON biometric_captures(employee_id);
CREATE INDEX IF NOT EXISTS idx_templates_employee ON biometric_templates(employee_id, is_active);