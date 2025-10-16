import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { API_BASE_URL } from '../api/axiosConfig';

const CameraStats = ({ cameraId }) => {
  const [stats, setStats] = useState({ fps: 0, running: false });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/stats`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, [cameraId]);

  return (
    <div className="absolute top-2 right-2 bg-black/70 px-3 py-1 rounded-lg flex items-center space-x-2">
      <Activity className={`w-4 h-4 ${stats.fps > 20 ? 'text-green-400' : 'text-red-400'}`} />
      <span className="text-white text-sm font-mono">{stats.fps} FPS</span>
    </div>
  );
};

export default CameraStats;
