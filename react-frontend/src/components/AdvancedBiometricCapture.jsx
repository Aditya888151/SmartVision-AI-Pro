import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Eye, CheckCircle, AlertCircle, RotateCcw, User } from 'lucide-react';

const AdvancedBiometricCapture = ({ employeeId, onComplete, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({
    captured_angles: [],
    required_angles: [],
    progress_percentage: 0,
    is_complete: false,
    quality_scores: {},
    retinal_quality: {}
  });
  
  const [currentAnalysis, setCurrentAnalysis] = useState({
    face_detected: false,
    current_angle: null,
    quality_score: 0,
    retinal_quality: 0,
    head_pose: { yaw: 0, pitch: 0 }
  });
  
  const [messages, setMessages] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const processingIntervalRef = useRef(null);

  const angleInstructions = {
    frontal: "Look straight at the camera",
    left_profile: "Turn your head 45° to the RIGHT (show left side of face)",
    right_profile: "Turn your head 45° to the LEFT (show right side of face)", 
    up_angle: "Tilt your head UP (look slightly above camera)",
    down_angle: "Tilt your head DOWN (look slightly below camera)"
  };

  const angleColors = {
    frontal: 'bg-blue-500',
    left_profile: 'bg-green-500',
    right_profile: 'bg-purple-500',
    up_angle: 'bg-yellow-500',
    down_angle: 'bg-red-500'
  };

  useEffect(() => {
    startCamera();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (sessionId && stream) {
      startProcessing();
    }
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
    };
  }, [sessionId, stream]);

  const startCamera = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      // Use default camera for attendance
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to load
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = resolve;
        });
      }
      
      addMessage('Camera connected successfully!', 'success');
      
      // Start biometric session
      const response = await fetch('http://localhost:8000/api/biometric/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setSessionId(data.session_id);
        setSessionProgress(prev => ({
          ...prev,
          required_angles: data.required_angles
        }));
        addMessage('AI biometric session started. Position your face clearly.', 'info');
      } else {
        throw new Error(data.message || 'Failed to start session');
      }
    } catch (error) {
      console.error('Camera/Session error:', error);
      if (error.name === 'NotAllowedError') {
        addMessage('Camera permission denied. Please allow camera access and refresh.', 'error');
      } else if (error.name === 'NotFoundError') {
        addMessage('No camera found. Please connect a camera and try again.', 'error');
      } else if (error.name === 'NotReadableError') {
        addMessage('Camera is being used by another application.', 'error');
      } else {
        addMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  const startProcessing = () => {
    processingIntervalRef.current = setInterval(async () => {
      if (!isProcessing && videoRef.current && canvasRef.current) {
        await processFrame();
      }
    }, 200); // Process every 200ms for smooth real-time analysis
  };

  const processFrame = async () => {
    if (isProcessing || !videoRef.current || !canvasRef.current || !sessionId) return;
    
    // Check if video is ready
    if (videoRef.current.readyState !== 4) return;
    
    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Ensure video has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const frameData = canvas.toDataURL('image/jpeg', 0.8);
      
      const response = await fetch('http://localhost:8000/api/biometric/process-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          session_id: sessionId,
          frame_data: frameData
        })
      });
      
      if (!response.ok) {
        console.error(`Server error: ${response.status}`);
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        setCurrentAnalysis({
          face_detected: result.face_detected || false,
          current_angle: result.current_angle || null,
          quality_score: result.quality_score || 0,
          retinal_quality: result.retinal_quality || 0,
          head_pose: result.head_pose || { yaw: 0, pitch: 0 }
        });
        
        if (result.session_progress) {
          setSessionProgress(result.session_progress);
        }
        
        if (result.auto_captured) {
          addMessage(`✓ ${result.captured_angle} angle captured!`, 'success');
        }
        
        if (result.session_complete) {
          setIsComplete(true);
          addMessage('All angles captured! Processing attendance...', 'success');
          
          // Stop processing
          if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current);
          }
          
          // Complete attendance
          setTimeout(() => {
            onComplete({
              session_id: sessionId,
              biometric_data: result.session_progress
            });
          }, 2000);
        }
        
        if (result.message && !result.face_detected) {
          // Only show face detection messages occasionally to avoid spam
          if (Math.random() < 0.1) {
            addMessage(result.message, 'info');
          }
        }
      } else if (result.error) {
        console.error('Processing error:', result.error);
      }
    } catch (error) {
      console.error('Frame processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (text, type = 'info') => {
    const message = {
      id: Date.now(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [message, ...prev.slice(0, 4)]); // Keep last 5 messages
  };

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
    }
    if (sessionId) {
      fetch(`http://localhost:8000/api/biometric/session/${sessionId}`, {
        method: 'DELETE'
      }).catch(console.error);
    }
  };

  const getNextRequiredAngle = () => {
    const remaining = sessionProgress.required_angles.filter(
      angle => !sessionProgress.captured_angles.includes(angle)
    );
    return remaining[0];
  };

  const getAngleStatus = (angle) => {
    if (sessionProgress.captured_angles.includes(angle)) {
      return 'completed';
    }
    if (currentAnalysis.current_angle === angle) {
      return 'current';
    }
    return 'pending';
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-6xl h-full max-h-[95vh] overflow-y-auto border border-cyan-400/30">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-cyan-400 flex items-center">
            <Eye className="w-6 h-6 mr-2" />
            Advanced Biometric Capture
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <div className="relative bg-black rounded-xl overflow-hidden mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto max-h-[60vh] object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Face Detection Overlay */}
              {currentAnalysis.face_detected && (
                <div className="absolute top-4 left-4 space-y-2">
                  <div className="bg-green-600/80 text-white px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Face Detected</span>
                    </div>
                  </div>
                  
                  {currentAnalysis.current_angle && (
                    <div className={`${angleColors[currentAnalysis.current_angle] || 'bg-gray-600'}/80 text-white px-3 py-2 rounded-lg`}>
                      <div className="text-sm font-semibold">{currentAnalysis.current_angle.replace('_', ' ').toUpperCase()}</div>
                      <div className="text-xs">Quality: {Math.round(currentAnalysis.quality_score)}%</div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Quality Indicators */}
              <div className="absolute top-4 right-4 space-y-2">
                <div className="bg-black/60 text-white px-3 py-2 rounded-lg">
                  <div className="text-xs">Face Quality</div>
                  <div className={`text-sm font-bold ${currentAnalysis.quality_score >= 75 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {Math.round(currentAnalysis.quality_score)}%
                  </div>
                </div>
                <div className="bg-black/60 text-white px-3 py-2 rounded-lg">
                  <div className="text-xs">Retinal Quality</div>
                  <div className={`text-sm font-bold ${currentAnalysis.retinal_quality >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {Math.round(currentAnalysis.retinal_quality)}%
                  </div>
                </div>
              </div>
              
              {/* Processing Indicator */}
              {isProcessing && (
                <div className="absolute bottom-4 left-4 bg-blue-600/80 text-white px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm">Processing...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">Capture Progress</span>
                <span className="text-cyan-400">{Math.round(sessionProgress.progress_percentage)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${sessionProgress.progress_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Control Panel */}
          <div className="space-y-4">
            
            {/* Angle Status */}
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Required Angles</h3>
              <div className="space-y-2">
                {sessionProgress.required_angles.map((angle) => {
                  const status = getAngleStatus(angle);
                  return (
                    <div key={angle} className={`p-3 rounded-lg border-2 ${
                      status === 'completed' ? 'bg-green-600/20 border-green-500' :
                      status === 'current' ? 'bg-blue-600/20 border-blue-500 animate-pulse' :
                      'bg-slate-700 border-slate-600'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">
                          {angle.replace('_', ' ').toUpperCase()}
                        </span>
                        {status === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {status === 'current' && <RotateCcw className="w-5 h-5 text-blue-400 animate-spin" />}
                      </div>
                      {sessionProgress.quality_scores[angle] && (
                        <div className="text-xs text-gray-400 mt-1">
                          Quality: {Math.round(sessionProgress.quality_scores[angle])}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Current Instruction */}
            {!isComplete && (
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">Instructions</h3>
                {!stream ? (
                  <div className="text-center">
                    <div className="text-red-400 mb-3">Camera not connected</div>
                    <button 
                      onClick={startCamera}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      Enable Camera
                    </button>
                  </div>
                ) : !sessionId ? (
                  <div className="text-blue-400">Starting biometric session...</div>
                ) : currentAnalysis.face_detected ? (
                  <div className="text-white">
                    {currentAnalysis.current_angle ? (
                      <div>
                        <div className="text-green-400 mb-2">✓ {currentAnalysis.current_angle.replace('_', ' ').toUpperCase()} detected!</div>
                        <div className="text-sm">Hold steady for automatic capture...</div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium mb-2 text-yellow-400">Next Required: {getNextRequiredAngle()?.replace('_', ' ').toUpperCase()}</div>
                        <div className="text-sm text-gray-300 mb-2">
                          {angleInstructions[getNextRequiredAngle()]}
                        </div>
                        <div className="text-xs text-blue-400">
                          Current: {currentAnalysis.current_angle ? currentAnalysis.current_angle.replace('_', ' ').toUpperCase() : 'No angle detected'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Pose: Yaw {Math.round(currentAnalysis.head_pose?.yaw || 0)}°, Pitch {Math.round(currentAnalysis.head_pose?.pitch || 0)}°
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-yellow-400">
                    Position your face clearly in the camera view
                  </div>
                )}
              </div>
            )}
            
            {/* Messages */}
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Status Messages</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-sm">No messages yet</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`p-2 rounded text-sm ${
                      message.type === 'success' ? 'bg-green-600/20 text-green-400' :
                      message.type === 'error' ? 'bg-red-600/20 text-red-400' :
                      'bg-blue-600/20 text-blue-400'
                    }`}>
                      <div className="flex justify-between items-start">
                        <span>{message.text}</span>
                        <span className="text-xs opacity-60">{message.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Completion Status */}
            {isComplete && (
              <div className="bg-green-600/20 border border-green-500 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Capture Complete!</span>
                </div>
                <p className="text-white text-sm">
                  All biometric data captured successfully. Processing attendance...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedBiometricCapture;