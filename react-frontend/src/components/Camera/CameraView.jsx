import React, { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import ActivityAlerts from '../ActivityAlerts';
const API_BASE_URL = 'http://localhost:8000';

const CameraView = ({ cameraId, onClose }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedEmployees, setDetectedEmployees] = useState([]);
  const [accessAlerts, setAccessAlerts] = useState([]);

  useEffect(() => {
    startCameraStream();
    const cleanup = startEmployeeDetection();
    return () => {
      if (videoRef.current) {
        videoRef.current.src = '';
      }
      cleanup();
    };
  }, [cameraId]);

  const startCameraStream = async () => {
    if (videoRef.current) {
      videoRef.current.src = `http://localhost:8000/api/cameras/${cameraId}/stream`;
    }
  };

  const startEmployeeDetection = () => {
    const detectionInterval = setInterval(() => {
      fetchRealDetections();
    }, 2000);

    return () => clearInterval(detectionInterval);
  };

  const fetchRealDetections = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/recognition/${cameraId}/detections`);
      const data = await response.json();
      
      if (data.detections && data.detections.length > 0) {
        data.detections.forEach(detection => {
          const detected = {
            id: detection.employee_id,
            name: detection.name,
            confidence: detection.confidence,
            authorized: detection.authorized,
            department: detection.department,
            role: detection.role
          };
          
          setDetectedEmployees(prev => [detected, ...prev.slice(0, 4)]);

          if (!detected.authorized || detected.confidence < 70) {
            const alert = {
              id: Date.now(),
              type: detected.authorized ? 'low_confidence' : 'unauthorized',
              employee: detected.name,
              timestamp: new Date().toLocaleTimeString(),
              confidence: detected.confidence
            };
            
            setAccessAlerts(prev => [alert, ...prev.slice(0, 9)]);
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch detections:', error);
    }
  };

  const stopRecording = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsRecording(false);
  };

  const startRecording = () => {
    setIsRecording(true);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 w-full h-full max-h-[95vh] overflow-y-auto border border-cyan-400/30">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-cyan-400 flex items-center">
            <Camera className="w-6 h-6 mr-2" />
            Camera {cameraId} - Live View
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
              <img 
                ref={videoRef} 
                alt="Camera Stream"
                className="w-full h-auto max-h-[75vh] object-contain bg-slate-800"
                style={{ display: 'block', margin: '0 auto' }}
              />
              
              {detectedEmployees.length > 0 && (
                <div className="absolute top-4 left-4 space-y-2">
                  {detectedEmployees.slice(0, 2).map((emp, index) => (
                    <div key={index} className={`px-3 py-2 rounded-lg ${
                      emp.authorized && emp.confidence > 70 
                        ? 'bg-green-600/80 text-white' 
                        : 'bg-red-600/80 text-white'
                    }`}>
                      <div className="flex items-center gap-2">
                        {emp.authorized && emp.confidence > 70 ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-semibold">{emp.name}</span>
                      </div>
                      <div className="text-xs">Confidence: {emp.confidence}%</div>
                    </div>
                  ))}
                </div>
              )}

              <ActivityAlerts cameraId={cameraId} />
              
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-semibold">RECORDING</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold flex items-center gap-2"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Detected Employees
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detectedEmployees.length === 0 ? (
                  <p className="text-gray-400 text-sm">No employees detected</p>
                ) : (
                  detectedEmployees.map((emp, index) => (
                    <div key={index} className="bg-slate-700 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold">{emp.name}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          emp.authorized && emp.confidence > 70 
                            ? 'bg-green-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}>
                          {emp.confidence}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        ID: {emp.id} | Status: {emp.authorized ? 'Authorized' : 'Unauthorized'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Access Alerts
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {accessAlerts.length === 0 ? (
                  <p className="text-gray-400 text-sm">No alerts</p>
                ) : (
                  accessAlerts.map((alert) => (
                    <div key={alert.id} className="bg-red-900/50 border border-red-600 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-red-400 font-semibold text-sm">
                          {alert.type === 'unauthorized' ? 'Unauthorized Access' : 'Low Confidence'}
                        </span>
                        <span className="text-xs text-gray-400">{alert.timestamp}</span>
                      </div>
                      <div className="text-white text-sm">{alert.employee}</div>
                      <div className="text-xs text-gray-400">Confidence: {alert.confidence}%</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraView;
