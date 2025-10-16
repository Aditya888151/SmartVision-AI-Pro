import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import MainDashboard from './components/Dashboard/MainDashboard';
import SecurityClips from './pages/SecurityClips';
import Attendance from './pages/Attendance';
import { Home, Video, Calendar } from 'lucide-react';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState('main');
  
  useEffect(() => {
    const path = location.pathname;
    if (path === '/attendance') setCurrentView('attendance');
    else if (path === '/security-clips') setCurrentView('clips');
    else setCurrentView('main');
  }, [location]);

  const handleNavigation = (id) => {
    setCurrentView(id);
    if (id === 'attendance') navigate('/attendance');
    else if (id === 'clips') navigate('/security-clips');
    else navigate('/');
  };

  const NavButton = ({ id, icon: Icon, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center px-4 py-2 rounded font-medium transition-colors ${
        isActive 
          ? 'bg-[#1a1a1a] text-[#d4d4d4] border border-[#007acc]' 
          : 'bg-[#0a0a0a] text-[#cccccc] hover:bg-[#1a1a1a] border border-[#1a1a1a]'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  const renderView = () => {
    switch (currentView) {
      case 'main': return <MainDashboard />;
      case 'clips': return <SecurityClips />;
      case 'attendance': return <Attendance />;
      default: return <MainDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-4 right-4 z-[100] flex gap-2">
        <NavButton 
          id="main" 
          icon={Home} 
          label="Dashboard" 
          isActive={currentView === 'main'} 
          onClick={handleNavigation} 
        />
        <NavButton 
          id="clips" 
          icon={Video} 
          label="Security Clips" 
          isActive={currentView === 'clips'} 
          onClick={handleNavigation} 
        />
        <NavButton 
          id="attendance" 
          icon={Calendar} 
          label="Attendance" 
          isActive={currentView === 'attendance'} 
          onClick={handleNavigation} 
        />
      </div>
      
      <Routes>
        <Route path="/" element={<MainDashboard />} />
        <Route path="/security-clips" element={<SecurityClips />} />
        <Route path="/attendance" element={<Attendance />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
