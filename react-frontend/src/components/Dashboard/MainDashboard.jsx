import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Video, Eye, Database, TrendingUp, Shield, 
  UserPlus, Play, Square, Trash2, Camera, Upload 
} from 'lucide-react';
import RealTimeFaceDetection from '../FaceCapture/RealTimeFaceDetection';
import CameraView from '../Camera/CameraView';
import BasicBiometricCapture from '../BasicBiometricCapture';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const MainDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCameras: 0,
    activeCameras: 0,
    totalVideoDB: 0,
    behaviorEvents: 0
  });
  const [employees, setEmployees] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [empFaceData, setEmpFaceData] = useState(null);
  const [showSmartphoneCapture, setShowSmartphoneCapture] = useState(false);
  const [showCameraView, setShowCameraView] = useState(null);
  const [showEmployeeTracking, setShowEmployeeTracking] = useState(false);
  const [trackingEmployee, setTrackingEmployee] = useState(null);
  const [cameraStates, setCameraStates] = useState({});
  const [empStream, setEmpStream] = useState(null);
  const [showBasicBiometric, setShowBasicBiometric] = useState(false);
  
  // Employee form data
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: '',
    name: '',
    department: 'Production',
    role: '',
    shift_start: '10:30 AM',
    shift_end: '6:00 PM',
    lunch_start: '1:30 PM',
    lunch_end: '2:30 PM'
  });
  
  // Camera form data
  const [cameraForm, setCameraForm] = useState({
    camera_id: '',
    name: '',
    source: '',
    location: '',
    camera_type: 'activity',
    monitor_employees: true
  });

  useEffect(() => {
    loadDashboardData();
  }, []);
  
  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'employees') await loadEmployees();
        if (activeTab === 'cameras') await loadCameras();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (activeTab !== 'dashboard') {
      loadTabData();
    }
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
      const data = await response.json();
      setStats({
        totalEmployees: data.employees?.total || 0,
        totalCameras: data.cameras?.total || 0,
        activeCameras: data.cameras?.active || 0,
        totalVideoDB: data.videodb?.total || 0,
        behaviorEvents: data.events?.today || 0
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setStats({ totalEmployees: 0, totalCameras: 0, activeCameras: 0, totalVideoDB: 0, behaviorEvents: 0 });
    }
  };
  
  const loadEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/`);
      const data = await response.json();
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]);
    }
  };
  
  const loadCameras = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/`);
      const data = await response.json();
      setCameras(data || []);
      
      // Sync camera states with backend
      const newStates = {};
      if (data && Array.isArray(data)) {
        data.forEach(cam => {
          newStates[cam.camera_id] = cam.is_active ? 'active' : 'stopped';
        });
      }
      setCameraStates(newStates);
    } catch (error) {
      console.error('Error loading cameras:', error);
      setCameras([]);
      setCameraStates({});
    }
  };
  
  const handleEmployeeFormChange = useCallback((field, value) => {
    setEmployeeForm(prev => ({...prev, [field]: value}));
  }, []);
  
  const handleCameraFormChange = useCallback((field, value) => {
    setCameraForm(prev => ({...prev, [field]: value}));
  }, []);
  
  const addEmployee = async () => {
    if (!employeeForm.employee_id || !employeeForm.name) {
      alert('Employee ID and Name are required');
      return;
    }
    
    if (!empFaceData) {
      alert('Face capture is required');
      return;
    }
    
    try {
      const employeeData = {
        ...employeeForm,
        is_active: true,
        face_image: empFaceData || '',
        biometric_data: employeeForm.biometricData ? JSON.stringify(employeeForm.biometricData) : '{}',
        unique_id: `${employeeForm.employee_id}_${Date.now()}`
      };
      
      const response = await fetch(`${API_BASE_URL}/api/employees/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
      const data = await response.json();
      
      alert('Employee registered successfully!');
      setEmployeeForm({ employee_id: '', name: '', department: 'Production', role: '', shift_start: '10:30 AM', shift_end: '6:00 PM', lunch_start: '1:30 PM', lunch_end: '2:30 PM' });
      setEmpFaceData(null);
      loadEmployees();
      loadDashboardData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };
  
  const addCamera = async () => {
    if (!cameraForm.camera_id || !cameraForm.name || !cameraForm.source) {
      alert('Camera ID, Name, and Source are required');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...cameraForm, detection_zones: []})
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Camera added successfully!');
        setCameraForm({ camera_id: '', name: '', source: '', location: '', camera_type: 'activity', monitor_employees: true });
        loadCameras();
        loadDashboardData();
      } else {
        alert(data.message || 'Failed to add camera');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };
  
  const startEmpCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setEmpStream(stream);
    } catch (error) {
      
    }
  };
  
  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    const video = document.querySelector('video');
    if (video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      setEmpFaceData(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      empStream?.getTracks().forEach(track => track.stop());
      setEmpStream(null);
    }
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setEmpFaceData(e.target.result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const deleteEmployee = async (employeeId) => {
    if (!confirm(`Are you sure you want to delete employee ${employeeId}?`)) {
      return;
    }
    
    try {
      await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, { method: 'DELETE' });
      loadEmployees();
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };
  
  const deleteCamera = async (cameraId) => {
    if (!confirm(`Are you sure you want to delete camera ${cameraId}?`)) {
      return;
    }
    
    try {
      await fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, { method: 'DELETE' });
      loadCameras();
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting camera:', error);
    }
  };
  
  const startCameraMonitoring = async (cameraId) => {
    try {
      setCameraStates(prev => ({...prev, [cameraId]: 'starting'}));
      
      const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/start`, { method: 'POST' });
      const data = await response.json();
      console.log('Start camera response:', data);
      
      if (data.success) {
        setCameraStates(prev => ({...prev, [cameraId]: 'active'}));
        // Force reload cameras to sync state
        setTimeout(() => loadCameras(), 500);
        loadDashboardData();
      } else {
        setCameraStates(prev => ({...prev, [cameraId]: 'error'}));
        alert(data.message || 'Failed to start camera');
      }
      
    } catch (error) {
      console.error('Start camera error:', error);
      setCameraStates(prev => ({...prev, [cameraId]: 'error'}));
      alert('Error starting camera: ' + error.message);
    }
  };
  
  const stopCameraMonitoring = async (cameraId) => {
    try {
      setCameraStates(prev => ({...prev, [cameraId]: 'stopping'}));
      
      const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/stop`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setCameraStates(prev => ({...prev, [cameraId]: 'stopped'}));
        loadDashboardData();
        
      } else {
        setCameraStates(prev => ({...prev, [cameraId]: 'error'}));
        
      }
    } catch (error) {
      setCameraStates(prev => ({...prev, [cameraId]: 'error'}));
      
    }
  };
  
  const viewCamera = (cameraId) => {
    // Check if camera is active before viewing
    const cameraState = cameraStates[cameraId];
    if (cameraState !== 'active') {
      
      return;
    }
    setShowCameraView(cameraId);
  };
  
  const trackEmployee = (employeeId) => {
    setTrackingEmployee(employeeId);
    setShowEmployeeTracking(true);
  };
  
  const handleBasicBiometricComplete = (result) => {
    setEmpFaceData('basic_capture_complete');
    setEmployeeForm({
      ...employeeForm,
      biometricData: {
        totalImages: result.images.length,
        captureType: 'high_quality_biometric',
        images: result.images,
        employeeId: result.employeeId
      }
    });
    setShowBasicBiometric(false);
    
    // Show success message with options
    const message = `✅ ${result.message || 'Biometric registration completed successfully!'}`;
    alert(message);
    
    // Refresh employee list to show updated data
    if (activeTab === 'employees') {
      loadEmployees();
    }
    loadDashboardData();
  };
  
  const formatTime12Hour = (timeString) => {
    if (!timeString) return '-';
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const handleSmartphoneFaceCapture = (faceData) => {
    const faceImage = faceData.captures[0].image;
    setEmpFaceData(faceImage);
    setShowSmartphoneCapture(false);
    
    setEmployeeForm({
      ...employeeForm,
      faceAnalysis: faceData,
      biometricData: {
        faceEncoding: faceData.metadata.faceEncoding,
        biometricPoints: faceData.metadata.biometricPoints,
        totalCaptures: faceData.metadata.totalCaptures,
        scanAngles: faceData.metadata.scanAngles,
        averageConfidence: faceData.metadata.averageConfidence,
        livenessScore: faceData.metadata.livenessScore,
        qualityScore: faceData.metadata.qualityScore,
        securityLevel: faceData.metadata.securityLevel,
        eyeTracking: faceData.metadata.eyeTracking,
        antispoofingScore: faceData.metadata.antispoofingScore,
        captureTimestamp: faceData.timestamp,
        scanType: faceData.scanType
      }
    });
  };

  const StatCard = ({ icon: Icon, title, value, subtitle }) => (
    <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-cyan-400/30 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-gray-400 text-xs sm:text-sm font-medium uppercase tracking-wide mb-2 sm:mb-3 flex items-center">
            <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-cyan-400" />
            <span className="hidden sm:inline">{title}</span>
            <span className="sm:hidden">{title.split(' ')[0]}</span>
          </h3>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2 gradient-text">{value}</div>
          <div className="text-gray-400 text-xs sm:text-sm">{subtitle}</div>
        </div>
        <Icon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-cyan-400/30 group-hover:text-cyan-400/60 transition-colors duration-300" />
      </div>
    </div>
  );

  const TabButton = ({ id, icon: Icon, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-300 text-sm sm:text-base ${
        isActive 
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/50 shadow-lg scale-105' 
          : 'glass text-gray-400 hover:text-white hover:bg-white/10 hover:scale-105 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.charAt(0)}</span>
    </button>
  );

  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard icon={Users} title="Employees" value={stats.totalEmployees} subtitle="Registered in system" />
        <StatCard icon={Video} title="Cameras" value={`${stats.activeCameras}/${stats.totalCameras}`} subtitle="Active / Total" />
        <StatCard icon={Database} title="VideoDB Clips" value={stats.totalVideoDB} subtitle="Security recordings" />
        <StatCard icon={Eye} title="Behavior Alerts" value={stats.behaviorEvents} subtitle="Today" />
      </div>
      
      {/* Quick Actions */}
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-400/30">
        <h3 className="text-lg sm:text-xl font-bold text-purple-400 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveTab('employees')}
            className="glass rounded-lg p-3 sm:p-4 text-center hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-cyan-400/30"
          >
            <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-cyan-400" />
            <div className="text-xs sm:text-sm font-medium text-white">Add Employee</div>
          </button>
          <button 
            onClick={() => setActiveTab('cameras')}
            className="glass rounded-lg p-3 sm:p-4 text-center hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-green-400/30"
          >
            <Video className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-green-400" />
            <div className="text-xs sm:text-sm font-medium text-white">Add Camera</div>
          </button>
          <button 
            onClick={() => window.open('/attendance', '_blank')}
            className="glass rounded-lg p-3 sm:p-4 text-center hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-yellow-400/30"
          >
            <Eye className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-yellow-400" />
            <div className="text-xs sm:text-sm font-medium text-white">Attendance</div>
          </button>
          <button 
            onClick={() => window.open('/reports', '_blank')}
            className="glass rounded-lg p-3 sm:p-4 text-center hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-pink-400/30"
          >
            <Database className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-pink-400" />
            <div className="text-xs sm:text-sm font-medium text-white">Reports</div>
          </button>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-cyan-400/30">
        <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          System Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass rounded-lg p-3 border border-green-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Biometric System</div>
                <div className="text-green-400 font-bold">Online</div>
              </div>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="glass rounded-lg p-3 border border-blue-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Face Recognition</div>
                <div className="text-blue-400 font-bold">Active</div>
              </div>
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="glass rounded-lg p-3 border border-purple-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Database</div>
                <div className="text-purple-400 font-bold">Connected</div>
              </div>
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const EmployeesTab = useMemo(() => (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Add Employee Form */}
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-cyan-400/30 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold gradient-text mb-4 sm:mb-6 flex items-center">
          <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-cyan-400" />
          <span className="hidden sm:inline">Add Employee</span>
          <span className="sm:hidden">Add Employee</span>
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-white text-xs sm:text-sm font-medium mb-1 sm:mb-2">Employee ID</label>
            <input 
              type="text" 
              placeholder="e.g., EMP_001"
              value={employeeForm.employee_id}
              onChange={(e) => handleEmployeeFormChange('employee_id', e.target.value)}
              className="w-full p-2 sm:p-3 glass rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none transition-all duration-300 text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-white text-xs sm:text-sm font-medium mb-1 sm:mb-2">Full Name</label>
            <input 
              type="text" 
              placeholder="John Doe"
              value={employeeForm.name}
              onChange={(e) => handleEmployeeFormChange('name', e.target.value)}
              className="w-full p-2 sm:p-3 glass rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none transition-all duration-300 text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Department</label>
            <select 
              value={employeeForm.department}
              onChange={(e) => handleEmployeeFormChange('department', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
            >
              <option>Production</option>
              <option>Quality Control</option>
              <option>Warehouse</option>
              <option>Security</option>
              <option>Administration</option>
            </select>
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Role</label>
            <input 
              type="text" 
              placeholder="Supervisor"
              value={employeeForm.role}
              onChange={(e) => handleEmployeeFormChange('role', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#cccccc] text-sm font-medium mb-2">Shift Start</label>
              <select 
                value={employeeForm.shift_start}
                onChange={(e) => handleEmployeeFormChange('shift_start', e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
              >
                <option value="6:00 AM">6:00 AM</option>
                <option value="6:30 AM">6:30 AM</option>
                <option value="7:00 AM">7:00 AM</option>
                <option value="7:30 AM">7:30 AM</option>
                <option value="8:00 AM">8:00 AM</option>
                <option value="8:30 AM">8:30 AM</option>
                <option value="9:00 AM">9:00 AM</option>
                <option value="9:30 AM">9:30 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="10:30 AM">10:30 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="11:30 AM">11:30 AM</option>
                <option value="12:00 PM">12:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-[#cccccc] text-sm font-medium mb-2">Shift End</label>
              <select 
                value={employeeForm.shift_end}
                onChange={(e) => handleEmployeeFormChange('shift_end', e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
              >
                <option value="3:00 PM">3:00 PM</option>
                <option value="3:30 PM">3:30 PM</option>
                <option value="4:00 PM">4:00 PM</option>
                <option value="4:30 PM">4:30 PM</option>
                <option value="5:00 PM">5:00 PM</option>
                <option value="5:30 PM">5:30 PM</option>
                <option value="6:00 PM">6:00 PM</option>
                <option value="6:30 PM">6:30 PM</option>
                <option value="7:00 PM">7:00 PM</option>
                <option value="7:30 PM">7:30 PM</option>
                <option value="8:00 PM">8:00 PM</option>
                <option value="8:30 PM">8:30 PM</option>
                <option value="9:00 PM">9:00 PM</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#cccccc] text-sm font-medium mb-2">Lunch Start</label>
              <select 
                value={employeeForm.lunch_start}
                onChange={(e) => handleEmployeeFormChange('lunch_start', e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
              >
                <option value="11:30 AM">11:30 AM</option>
                <option value="12:00 PM">12:00 PM</option>
                <option value="12:30 PM">12:30 PM</option>
                <option value="1:00 PM">1:00 PM</option>
                <option value="1:30 PM">1:30 PM</option>
                <option value="2:00 PM">2:00 PM</option>
                <option value="2:30 PM">2:30 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-[#cccccc] text-sm font-medium mb-2">Lunch End</label>
              <select 
                value={employeeForm.lunch_end}
                onChange={(e) => handleEmployeeFormChange('lunch_end', e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
              >
                <option value="12:30 PM">12:30 PM</option>
                <option value="1:00 PM">1:00 PM</option>
                <option value="1:30 PM">1:30 PM</option>
                <option value="2:00 PM">2:00 PM</option>
                <option value="2:30 PM">2:30 PM</option>
                <option value="3:00 PM">3:00 PM</option>
                <option value="3:30 PM">3:30 PM</option>
              </select>
            </div>
          </div>
          <div className="text-center p-4 border-2 border-dashed border-[#1a1a1a] rounded bg-[#0f0f0f]">
            {empStream ? (
              <div>
                <video autoPlay className="w-full h-32 rounded mb-2" ref={(video) => { if (video && empStream) video.srcObject = empStream; }} />
                <button onClick={capturePhoto} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                  📸 Capture
                </button>
              </div>
            ) : empFaceData ? (
              <div>
                <p className="text-green-400 font-semibold mb-2 text-sm sm:text-base">✓ Face Data Complete!</p>
                <img src={`data:image/jpeg;base64,${empFaceData}`} className="w-32 h-24 mx-auto rounded border-2 border-green-400" />
                <div className="mt-2 text-xs text-gray-400">
                  {employeeForm.biometricData?.securityLevel ? (
                    <div>
                      <div>Security Level: <span className="text-green-400">{employeeForm.biometricData.securityLevel}</span></div>
                      <div>Quality Score: <span className="text-blue-400">{Math.floor(employeeForm.biometricData.qualityScore || 0)}/100</span></div>
                      <div>Captures: {employeeForm.biometricData.totalCaptures} angles</div>
                      <div>Liveness: <span className="text-green-400">{employeeForm.biometricData.livenessScore}%</span></div>
                      <div className="text-xs text-green-400 mt-1">✓ Face image captured and ready</div>
                    </div>
                  ) : (
                    <div className="text-red-400">⚠ Face scan required for registration</div>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <button 
                    onClick={() => {
                      if (!employeeForm.employee_id) {
                        alert('Please enter Employee ID first');
                        return;
                      }
                      setShowBasicBiometric(true);
                    }}
                    className="text-purple-400 hover:text-purple-300 text-sm underline transition-colors"
                  >
                    Recapture Face Data
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <Camera className="w-12 h-12 text-[#858585] mx-auto mb-2" />
                <p className="text-[#cccccc] font-medium mb-2">Face Registration Required</p>
                <p className="text-xs text-[#858585] mb-4">AI-powered biometric analysis</p>
                <div className="flex justify-center">
                  <button 
                    onClick={() => {
                      if (!employeeForm.employee_id) {
                        alert('Please enter Employee ID first');
                        return;
                      }
                      setShowBasicBiometric(true);
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center font-bold shadow-lg transition-all duration-300 hover:scale-105 text-sm sm:text-base"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="hidden sm:inline">Capture Face Data</span>
                    <span className="sm:hidden">Capture Face</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={addEmployee} 
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-2 sm:py-3 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 text-sm sm:text-base"
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Register Employee
          </button>
        </div>
      </div>
      
      {/* Employee List */}
      <div className="lg:col-span-2 glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-400/30 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold gradient-text mb-4 sm:mb-6 flex items-center">
          <Users className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-purple-400" />
          Employee Management
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {employees.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-sm sm:text-base">No employees found. Add employees to get started.</p>
            </div>
          ) : (
            employees.map((emp, index) => (
              <div key={emp.employee_id || index} className="glass rounded-xl p-3 sm:p-4 border border-cyan-400/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
                <div className="flex gap-2 sm:gap-3 mb-3">
                  {(emp.face_image && emp.face_image.trim() !== '') ? (
                    <img 
                      src={`data:image/jpeg;base64,${emp.face_image}`}
                      alt={emp.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-cyan-400 shadow-lg"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {!(emp.face_image && emp.face_image.trim() !== '') && (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-2 border-cyan-400 shadow-lg">
                      <span className="text-white text-sm sm:text-lg font-bold">{emp.name?.charAt(0) || 'E'}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold mb-1 text-sm sm:text-base truncate">{emp.name}</h4>
                    <p className="text-gray-400 text-xs mb-1">ID: {emp.employee_id}</p>
                    <p className="text-gray-400 text-xs truncate">Dept: {emp.department}</p>
                  </div>
                </div>
                <div className="text-xs text-[#858585] mb-2">
                  <div>Role: {emp.role}</div>
                  <div>Shift: {formatTime12Hour(emp.shift_start)}-{formatTime12Hour(emp.shift_end)}</div>
                  <div>Lunch: {formatTime12Hour(emp.lunch_start || '12:00')}-{formatTime12Hour(emp.lunch_end || '13:00')}</div>
                </div>
                {emp.biometric_data && emp.biometric_data !== '{}' && (
                  <div className="text-xs text-[#4ec9b0] mb-2">
                    ✓ Biometric: {(() => {
                      try {
                        const data = typeof emp.biometric_data === 'string' ? JSON.parse(emp.biometric_data) : emp.biometric_data;
                        return data.securityLevel || 'Registered';
                      } catch {
                        return 'Registered';
                      }
                    })()}
                  </div>
                )}
                <div className="flex gap-2">
                  <button 
                    onClick={() => trackEmployee(emp.employee_id)}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 hover:scale-105"
                  >
                    Track
                  </button>
                  <button 
                    onClick={() => deleteEmployee(emp.employee_id)}
                    className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm transition-all duration-300 hover:scale-105"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ), [employeeForm, employees, empFaceData]);

  const CamerasTab = useMemo(() => (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Add Camera Form */}
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-400/30 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold gradient-text mb-4 sm:mb-6 flex items-center">
          <Video className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-green-400" />
          Add Camera
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-white text-xs sm:text-sm font-medium mb-1 sm:mb-2">Camera ID</label>
            <input 
              type="text" 
              placeholder="CAM_001"
              value={cameraForm.camera_id}
              onChange={(e) => handleCameraFormChange('camera_id', e.target.value)}
              className="w-full p-2 sm:p-3 glass rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-all duration-300 text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Camera Name</label>
            <input 
              type="text" 
              placeholder="Production Floor"
              value={cameraForm.name}
              onChange={(e) => handleCameraFormChange('name', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Source</label>
            <input 
              type="text" 
              placeholder="0 or RTSP URL"
              value={cameraForm.source}
              onChange={(e) => handleCameraFormChange('source', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Location</label>
            <input 
              type="text" 
              placeholder="Building A - Floor 1"
              value={cameraForm.location}
              onChange={(e) => handleCameraFormChange('location', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[#cccccc] text-sm font-medium mb-2">Camera Type</label>
            <select 
              value={cameraForm.camera_type}
              onChange={(e) => handleCameraFormChange('camera_type', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded text-[#cccccc] focus:border-[#007acc] focus:outline-none transition-colors"
            >
              <option value="door">Door Camera (Face Recognition)</option>
              <option value="activity">Activity Camera (Behavior Monitoring)</option>
            </select>
            <p className="text-xs text-[#858585] mt-1">
              {cameraForm.camera_type === 'door' ? '🚪 Identifies employees at entry/exit points' : '👁️ Monitors employee activity and behavior'}
            </p>
          </div>
          <button 
            onClick={addCamera} 
            className="w-full bg-gradient-to-r from-green-500 to-cyan-600 hover:from-green-600 hover:to-cyan-700 text-white font-bold py-2 sm:py-3 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 text-sm sm:text-base"
          >
            <Video className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Add Camera
          </button>
        </div>
      </div>
      
      {/* Camera List */}
      <div className="lg:col-span-2 glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-400/30 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold gradient-text mb-4 sm:mb-6 flex items-center">
          <Video className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-400" />
          Camera Management
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {cameras.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Video className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-sm sm:text-base">No cameras found. Add cameras to get started.</p>
            </div>
          ) : (
            cameras.map((cam, index) => (
              <div key={index} className="glass rounded-xl p-3 sm:p-4 border border-blue-400/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
                <h4 className="text-white font-bold mb-2 text-sm sm:text-base truncate">{cam.name}</h4>
                <div className="space-y-1 mb-3">
                  <p className="text-gray-400 text-xs truncate">ID: {cam.camera_id}</p>
                  <p className="text-gray-400 text-xs truncate">Location: {cam.location}</p>
                  <p className="text-gray-400 text-xs">
                    Type: {cam.camera_type === 'door' ? '🚪 Door' : '👁️ Activity'}
                  </p>
                </div>
                <div className="mb-3">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center ${
                    cameraStates[cam.camera_id] === 'active' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                    cameraStates[cam.camera_id] === 'starting' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' :
                    cameraStates[cam.camera_id] === 'stopping' ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' :
                    cameraStates[cam.camera_id] === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' :
                    'bg-gradient-to-r from-gray-500 to-slate-600 text-white'
                  }`}>
                    {cameraStates[cam.camera_id] === 'active' ? '🟢 ACTIVE' :
                     cameraStates[cam.camera_id] === 'starting' ? '🟡 STARTING' :
                     cameraStates[cam.camera_id] === 'stopping' ? '🟠 STOPPING' :
                     cameraStates[cam.camera_id] === 'error' ? '🔴 ERROR' :
                     '⚫ STOPPED'}
                  </span>
                </div>
                {/* Small Camera Preview */}
                {cameraStates[cam.camera_id] === 'active' && (
                  <div className="mb-3">
                    <div 
                      onClick={() => viewCamera(cam.camera_id)}
                      className="w-full h-32 bg-black rounded border-2 border-[#007acc] cursor-pointer hover:border-[#1177bb] transition-colors overflow-hidden shadow-md"
                    >
                      <img 
                        src={`${API_BASE_URL}/api/cameras/${cam.camera_id}/stream`}
                        alt="Camera Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full bg-[#0f0f0f] flex items-center justify-center text-[#858585]" style={{display: 'none'}}>
                        <Camera className="w-8 h-8" />
                      </div>
                    </div>
                    <p className="text-xs text-[#858585] mt-1 text-center">Click to view full screen</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {cameraStates[cam.camera_id] !== 'active' ? (
                    <button 
                      onClick={() => startCameraMonitoring(cam.camera_id)}
                      disabled={cameraStates[cam.camera_id] === 'starting'}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-2 py-1 sm:py-2 rounded-lg text-xs font-medium flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:scale-100"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">{cameraStates[cam.camera_id] === 'starting' ? 'Starting' : 'Start'}</span>
                      <span className="sm:hidden">▶</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => stopCameraMonitoring(cam.camera_id)}
                      disabled={cameraStates[cam.camera_id] === 'stopping'}
                      className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-2 py-1 sm:py-2 rounded-lg text-xs font-medium flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:scale-100"
                    >
                      <Square className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">{cameraStates[cam.camera_id] === 'stopping' ? 'Stopping' : 'Stop'}</span>
                      <span className="sm:hidden">⏹</span>
                    </button>
                  )}
                  <button 
                    onClick={() => viewCamera(cam.camera_id)}
                    className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-2 py-1 sm:py-2 rounded-lg text-xs font-medium flex items-center justify-center transition-all duration-300 hover:scale-105"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">View</span>
                    <span className="sm:hidden">👁</span>
                  </button>
                  <button 
                    onClick={() => deleteCamera(cam.camera_id)}
                    className="col-span-2 bg-gradient-to-r from-gray-600 to-slate-700 hover:from-gray-700 hover:to-slate-800 text-white px-2 py-1 sm:py-2 rounded-lg text-xs font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ), [cameraForm, cameras, cameraStates, handleCameraFormChange]);

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#007acc] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[#cccccc]">Loading...</p>
          </div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-400 mb-4">Error: {error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-[#007acc] hover:bg-[#1177bb] text-white px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    
    try {
      switch (activeTab) {
        case 'dashboard': return <DashboardTab />;
        case 'employees': return EmployeesTab;
        case 'cameras': return CamerasTab;
        default: return <DashboardTab />;
      }
    } catch (err) {
      console.error('Render error:', err);
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-400 mb-4">Render Error: {err.message}</p>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className="bg-[#007acc] hover:bg-[#1177bb] text-white px-4 py-2 rounded"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="glass-dark p-4 sm:p-6 shadow-2xl border-b border-cyan-400/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text flex items-center mb-1 sm:mb-2">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 mr-2 sm:mr-3 text-cyan-400" />
              <span className="hidden sm:inline">SmartVision AI Monitoring System</span>
              <span className="sm:hidden">SmartVision AI</span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm">Real-time CCTV & Employee Activity Monitoring</p>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>System Online</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="glass-dark p-3 sm:p-4 border-b border-purple-400/20">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <TabButton id="dashboard" icon={TrendingUp} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={setActiveTab} />
          <TabButton id="employees" icon={Users} label="Employees" isActive={activeTab === 'employees'} onClick={setActiveTab} />
          <TabButton id="cameras" icon={Video} label="Cameras" isActive={activeTab === 'cameras'} onClick={setActiveTab} />
          <button 
            onClick={() => window.open('/attendance', '_blank')}
            className="flex items-center px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-300 text-sm sm:text-base glass text-gray-400 hover:text-white hover:bg-white/10 hover:scale-105 border border-transparent"
          >
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Attendance</span>
            <span className="sm:hidden">A</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 sm:p-4 lg:p-6">
        {renderTabContent()}
      </div>
      
      {showCameraView && (
        <CameraView 
          cameraId={showCameraView}
          onClose={() => setShowCameraView(null)}
        />
      )}
      

      
      {showBasicBiometric && (
        <BasicBiometricCapture 
          employeeId={employeeForm.employee_id}
          onComplete={handleBasicBiometricComplete}
          onClose={() => setShowBasicBiometric(false)}
        />
      )}
    </div>
  );
};

export default MainDashboard;
