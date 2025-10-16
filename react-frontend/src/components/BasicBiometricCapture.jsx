import React, { useState, useRef, useEffect } from 'react';
import { Camera, User, CheckCircle, RotateCcw, ArrowRight } from 'lucide-react';

const BasicBiometricCapture = ({ employeeId, onComplete, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const angles = [
    { name: 'Frontal', instruction: 'Look straight at the camera' },
    { name: 'Left Profile', instruction: 'Turn your head 45° to the right' },
    { name: 'Right Profile', instruction: 'Turn your head 45° to the left' },
    { name: 'Up Angle', instruction: 'Tilt your head up slightly' },
    { name: 'Down Angle', instruction: 'Tilt your head down slightly' }
  ];

  useEffect(() => {
    startCamera();
    return () => cleanup();
  }, []);

  const startCamera = async () => {
    try {
      // Request highest quality camera settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
          aspectRatio: { ideal: 16/9 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('High quality camera error, trying fallback:', error);
      // Fallback to standard quality
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: 'user'
          }
        });
        
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackError) {
        console.error('Camera error:', fallbackError);
      }
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || capturedImages.length >= 5) return;
    
    setIsCapturing(true);
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Use original video resolution for high quality
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);
    
    // Capture at maximum quality (0.98 instead of 0.8)
    const imageData = canvas.toDataURL('image/jpeg', 0.98);
    
    // Extract additional biometric data
    const biometricData = extractBiometricData(canvas, ctx);
    
    const newCapture = {
      angle: angles[currentAngle].name.toLowerCase().replace(' ', '_'),
      image: imageData,
      timestamp: Date.now(),
      biometricData: biometricData,
      resolution: {
        width: video.videoWidth,
        height: video.videoHeight
      }
    };
    
    setCapturedImages(prev => {
      const updated = [...prev, newCapture];
      return updated.slice(0, 5); // Ensure max 5 images
    });
    
    setTimeout(() => {
      setIsCapturing(false);
      if (currentAngle < angles.length - 1) {
        setCurrentAngle(prev => prev + 1);
      } else {
        completeCapture();
      }
    }, 500);
  };
  
  const extractBiometricData = (canvas, ctx) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Calculate image quality metrics
    let totalBrightness = 0;
    let totalContrast = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate brightness (luminance)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }
    
    const avgBrightness = totalBrightness / pixelCount;
    
    // Calculate contrast
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalContrast += Math.pow(brightness - avgBrightness, 2);
    }
    
    const contrast = Math.sqrt(totalContrast / pixelCount);
    
    return {
      brightness: avgBrightness,
      contrast: contrast,
      sharpness: calculateSharpness(imageData),
      colorDistribution: calculateColorDistribution(data),
      faceRegionData: extractFaceRegionData(imageData),
      timestamp: Date.now()
    };
  };
  
  const calculateSharpness = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let sharpness = 0;
    
    // Sobel edge detection for sharpness
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        const gx = -data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x+1)) * 4] +
                   -2 * data[(y * width + (x-1)) * 4] + 2 * data[(y * width + (x+1)) * 4] +
                   -data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        const gy = -data[((y-1) * width + (x-1)) * 4] - 2 * data[((y-1) * width + x) * 4] - data[((y-1) * width + (x+1)) * 4] +
                   data[((y+1) * width + (x-1)) * 4] + 2 * data[((y+1) * width + x) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        sharpness += Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return sharpness / ((width - 2) * (height - 2));
  };
  
  const calculateColorDistribution = (data) => {
    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }
    
    return {
      red: rSum / pixelCount,
      green: gSum / pixelCount,
      blue: bSum / pixelCount
    };
  };
  
  const extractFaceRegionData = (imageData) => {
    // Extract center region (likely face area) for detailed analysis
    const width = imageData.width;
    const height = imageData.height;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(width, height) * 0.3; // 30% of image size
    
    const faceRegion = {
      centerX,
      centerY,
      regionSize,
      pixelDensity: width * height,
      aspectRatio: width / height
    };
    
    return faceRegion;
  };

  const completeCapture = async () => {
    try {
      setIsCapturing(true);
      
      // Convert captured images to the format backend expects
      const biometricImages = {};
      capturedImages.slice(0, 5).forEach(capture => {
        const angleName = capture.angle.charAt(0).toUpperCase() + capture.angle.slice(1).replace('_', '');
        biometricImages[angleName] = capture.image;
      });
      
      const response = await fetch('http://localhost:8000/api/advanced-ml-biometric/register-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          biometric_images: biometricImages
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        const summary = result.analysis_summary || {};
        const successMessage = `✅ Advanced ML Registration Complete!\n\n📊 Analysis:\n• ${summary.total_pixels_analyzed?.toLocaleString() || 0} pixels analyzed\n• ${summary.total_ml_features_extracted || 0} ML features\n• Quality: ${Math.round(summary.average_quality_score || 0)}%\n• Security: ${summary.biometric_security_level || 'High'}`;
        
        alert(successMessage);
        
        onComplete({ 
          success: true, 
          images: capturedImages.slice(0, 5),
          message: result.message,
          employeeId: employeeId,
          analysisData: summary
        });
      } else {
        // Handle error response
        const errorMsg = result.error || result.message || `Registration failed (${response.status})`;
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Advanced ML Registration error:', error);
      alert('❌ Advanced ML Registration Failed: ' + error.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-lg z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="glass-dark rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl border border-cyan-400/40 shadow-2xl max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 lg:mb-8 gap-4 sm:gap-0">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text flex items-center mb-1 sm:mb-2">
              <User className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 mr-2 sm:mr-3 text-purple-400" />
              <span className="hidden sm:inline">Advanced ML Biometric Registration</span>
              <span className="sm:hidden">ML Registration</span>
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm">Pixel-level facial analysis with ML/DL processing</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-purple-400 text-xs font-medium">Advanced ML Engine Active</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-2xl sm:text-3xl transition-all duration-300 hover:rotate-90 hover:scale-110 p-2 rounded-full hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6">
          
          {/* Camera Feed */}
          {/* Camera Section */}
          <div className="order-1 lg:order-1">
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6 border border-cyan-400/30 aspect-video sm:aspect-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full sm:h-auto object-cover sm:object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Camera Frame Overlay */}
              <div className="absolute inset-2 sm:inset-4 border border-cyan-400/50 sm:border-2 rounded-lg sm:rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-t-2 border-l-2 sm:border-t-4 sm:border-l-4 border-cyan-400"></div>
                <div className="absolute top-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-t-2 border-r-2 sm:border-t-4 sm:border-r-4 border-cyan-400"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-b-2 border-l-2 sm:border-b-4 sm:border-l-4 border-cyan-400"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-b-2 border-r-2 sm:border-b-4 sm:border-r-4 border-cyan-400"></div>
              </div>
              
              {isCapturing && (
                <div className="absolute inset-0 bg-cyan-400/20 flex items-center justify-center animate-pulse">
                  <div className="bg-gradient-to-r from-green-500 to-cyan-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold shadow-lg text-sm sm:text-base">
                    ✓ Captured!
                  </div>
                </div>
              )}
            </div>
            
            {/* Capture Button */}
            <div className="text-center">
              <button
                onClick={captureImage}
                disabled={isCapturing || capturedImages.length >= 5}
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 sm:gap-3 mx-auto shadow-lg transition-all duration-300 hover:scale-105 disabled:scale-100 text-sm sm:text-base"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden sm:inline">{capturedImages.length >= 5 ? 'Complete' : 'Capture Photo'}</span>
                <span className="sm:hidden">{capturedImages.length >= 5 ? 'Done' : 'Capture'}</span>
              </button>
            </div>
          </div>
          
          {/* Instructions & Progress */}
          {/* Instructions & Progress Section */}
          <div className="order-2 lg:order-2 space-y-3 sm:space-y-4">
            
            {/* Current Instruction */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-cyan-400/30">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-cyan-400">
                  {currentAngle < angles.length ? `Step ${currentAngle + 1}` : 'Complete!'}
                </h3>
                <div className="text-xs sm:text-sm text-gray-400 bg-slate-700/50 px-2 py-1 rounded-full">
                  {currentAngle < angles.length ? `${currentAngle + 1}/${angles.length}` : '✓'}
                </div>
              </div>
              
              {capturedImages.length < 5 ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2">
                      {angles[currentAngle].name}
                    </div>
                    <div className="text-gray-300 text-sm sm:text-base lg:text-lg">
                      {angles[currentAngle].instruction}
                    </div>
                  </div>
                  
                  {/* Visual Guide */}
                  <div className="flex justify-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 border-2 border-cyan-400 rounded-full flex items-center justify-center bg-cyan-400/10">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-400/20 rounded-full flex items-center justify-center">
                        {currentAngle === 0 && <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>}
                        {currentAngle === 1 && <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 rotate-45 animate-bounce" />}
                        {currentAngle === 2 && <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 -rotate-45 animate-bounce" />}
                        {currentAngle === 3 && <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 -rotate-90 animate-bounce" />}
                        {currentAngle === 4 && <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 rotate-90 animate-bounce" />}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-xl sm:text-2xl text-green-400 font-bold mb-2">🎉 Registration Complete!</div>
                  <div className="text-green-300 text-sm sm:text-base mb-4">All 5 angles captured with high-quality biometric data</div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setCapturedImages([]);
                        setCurrentAngle(0);
                      }}
                      className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 text-sm"
                    >
                      Recapture
                    </button>
                    <button
                      onClick={completeCapture}
                      disabled={isCapturing}
                      className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 text-sm"
                    >
                      {isCapturing ? 'Registering...' : 'Register Biometric'}
                    </button>
                    <button
                      onClick={onClose}
                      className="bg-gradient-to-r from-green-500 to-cyan-600 hover:from-green-600 hover:to-cyan-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 text-sm"
                    >
                      Continue to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Progress */}
            {/* Progress Section */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-400/30">
              <h3 className="text-lg sm:text-xl font-bold text-purple-400 mb-3 sm:mb-4 flex items-center">
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span className="hidden sm:inline">Progress ({capturedImages.length}/5)</span>
                <span className="sm:hidden">Progress {capturedImages.length}/5</span>
              </h3>
              
              {/* Progress Bar */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
                  <span>Angles Captured</span>
                  <span>{capturedImages.length}/5</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 sm:h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-cyan-500 h-2 sm:h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(capturedImages.length / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Angle List */}
              <div className="space-y-2 sm:space-y-3">
                {angles.map((angle, index) => {
                  const isComplete = capturedImages.some(img => img.angle === angle.name.toLowerCase().replace(' ', '_'));
                  const isCurrent = index === currentAngle;
                  
                  return (
                    <div key={index} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl flex items-center justify-between transition-all duration-300 ${
                      isComplete ? 'bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-400/50' :
                      isCurrent ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/50 animate-pulse' :
                      'bg-slate-700/50 border border-slate-600/50'
                    }`}>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-2 sm:mr-3 ${
                          isComplete ? 'bg-green-400' :
                          isCurrent ? 'bg-blue-400 animate-pulse' :
                          'bg-gray-500'
                        }`}></div>
                        <span className={`text-xs sm:text-sm font-medium ${
                          isComplete ? 'text-green-300' :
                          isCurrent ? 'text-blue-300' :
                          'text-gray-400'
                        }`}>{angle.name}</span>
                      </div>
                      {isComplete && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
                      {isCurrent && !isComplete && <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Captured Images Preview */}
            {/* Captured Images */}
            {capturedImages.length > 0 && (
              <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-400/30">
                <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-3 sm:mb-4 flex items-center">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="hidden sm:inline">Captured Images ({capturedImages.length}/5)</span>
                  <span className="sm:hidden">Images {capturedImages.length}/5</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                  {capturedImages.map((capture, index) => (
                    <div key={index} className="relative group">
                      <div className="relative overflow-hidden rounded-lg sm:rounded-xl border border-green-400/50 sm:border-2 shadow-lg">
                        <img 
                          src={capture.image} 
                          alt={capture.angle}
                          className="w-full h-16 sm:h-20 object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 text-white text-xs font-medium p-1 sm:p-2 text-center">
                          {capture.angle.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 bg-black/50 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicBiometricCapture;