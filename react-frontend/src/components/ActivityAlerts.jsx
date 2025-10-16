import React, { useState, useEffect } from 'react';
import { AlertTriangle, Activity, UserX, Navigation } from 'lucide-react';
const API_BASE_URL = 'http://localhost:8000';

const ActivityAlerts = ({ cameraId }) => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/cameras/${cameraId}/alerts`);
        const data = await response.json();
        
        if (data.alert) {
          setAlerts(prev => [data.alert, ...prev.slice(0, 9)]);
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [cameraId]);

  const getAlertIcon = (type) => {
    switch(type) {
      case 'IDLE': return <Activity className="w-5 h-5" />;
      case 'WANDERING': return <Navigation className="w-5 h-5" />;
      case 'ABSENT': return <UserX className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getAlertColor = (type) => {
    switch(type) {
      case 'IDLE': return 'bg-yellow-600';
      case 'WANDERING': return 'bg-orange-600';
      case 'ABSENT': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 w-80 space-y-2 max-h-96 overflow-y-auto">
      {alerts.map((alert, index) => (
        <div 
          key={index}
          className={`${getAlertColor(alert.type)} text-white p-3 rounded-lg shadow-lg animate-slide-in`}
        >
          <div className="flex items-center gap-2 mb-1">
            {getAlertIcon(alert.type)}
            <span className="font-bold">{alert.type}</span>
            <span className="text-xs opacity-75 ml-auto">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm opacity-90">
            {Object.entries(alert.details).map(([key, value]) => (
              <div key={key}>
                {key}: {value}
              </div>
            ))}
          </div>
          <div className="text-xs opacity-75 mt-1">
            Confidence: {(alert.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityAlerts;
