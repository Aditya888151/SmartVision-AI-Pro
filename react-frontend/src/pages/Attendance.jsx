import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, ArrowRight, ArrowLeft } from 'lucide-react';
const API_BASE_URL = 'http://localhost:8000';

const Attendance = () => {
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadTodayAttendance();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeData();
      loadMonthlyAttendance();
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const loadEmployeeData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/employees/');
      const employees = await response.json();
      const emp = employees.find(e => e.employee_id === selectedEmployee);
      setSelectedEmployeeData(emp);
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/attendance/all/today');
      const data = await response.json();
      setTodayAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadMonthlyAttendance = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/attendance/${selectedEmployee}/month/${selectedYear}/${selectedMonth}`
      );
      const data = await response.json();
      setMonthlyData(data);
    } catch (error) {
      console.error('Error loading monthly attendance:', error);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatShiftTime = (timeString) => {
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

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#0a0a0a] p-6 rounded border border-[#1a1a1a] mb-6">
          <h1 className="text-2xl font-semibold text-[#d4d4d4] flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-[#007acc]" />
            Attendance Management
          </h1>
          <p className="text-[#858585] text-sm mt-2">
            Automatic attendance tracking via door cameras
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Attendance */}
          <div className="bg-[#0a0a0a] p-6 rounded border border-[#1a1a1a]">
            <h2 className="text-lg font-semibold text-[#d4d4d4] mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-[#4ec9b0]" />
              Today's Attendance
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {todayAttendance.length === 0 ? (
                <p className="text-[#858585]">No attendance records for today</p>
              ) : (
                todayAttendance.map((att) => (
                  <div
                    key={att.employee_id}
                    onClick={() => setSelectedEmployee(att.employee_id)}
                    className="bg-[#0f0f0f] p-4 rounded border border-[#1a1a1a] cursor-pointer hover:border-[#007acc] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-[#d4d4d4] font-medium">{att.name}</h3>
                        <p className="text-[#858585] text-xs">{att.employee_id}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          att.status === 'present'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {att.status.toUpperCase()}
                      </span>
                    </div>
                    {att.status === 'present' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[#858585]">First Entry:</span>
                          <div className="text-[#4ec9b0] font-medium flex items-center">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            {formatTime(att.first_entry)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[#858585]">Last Exit:</span>
                          <div className="text-[#f48771] font-medium flex items-center">
                            <ArrowLeft className="w-3 h-3 mr-1" />
                            {formatTime(att.last_exit)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[#858585]">Entries:</span>
                          <div className="text-[#d4d4d4]">{att.total_entries}</div>
                        </div>
                        <div>
                          <span className="text-[#858585]">Exits:</span>
                          <div className="text-[#d4d4d4]">{att.total_exits}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Monthly Attendance */}
          <div className="bg-[#0a0a0a] p-6 rounded border border-[#1a1a1a]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#d4d4d4] flex items-center">
                <Users className="w-5 h-5 mr-2 text-[#4ec9b0]" />
                Monthly Report
              </h2>
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-[#1a1a1a] text-[#cccccc] px-3 py-1 rounded text-sm border border-[#1a1a1a] focus:border-[#007acc] focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-[#1a1a1a] text-[#cccccc] px-3 py-1 rounded text-sm border border-[#1a1a1a] focus:border-[#007acc] focus:outline-none"
                >
                  {[2024, 2025].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedEmployee ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-[#3e3e42] mx-auto mb-3" />
                <p className="text-[#858585]">Select an employee to view monthly report</p>
              </div>
            ) : monthlyData ? (
              <div>
                {selectedEmployeeData && (
                  <div className="bg-[#0f0f0f] p-3 rounded border border-[#1a1a1a] mb-4">
                    <div className="text-[#d4d4d4] font-medium mb-2">{selectedEmployeeData.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#858585]">
                      <div>
                        <span className="text-[#4ec9b0]">⏰</span> Shift: {formatShiftTime(selectedEmployeeData.shift_start)} - {formatShiftTime(selectedEmployeeData.shift_end)}
                      </div>
                      <div>
                        <span className="text-[#f48771]">🍽️</span> Lunch: {formatShiftTime(selectedEmployeeData.lunch_start || '13:30')} - {formatShiftTime(selectedEmployeeData.lunch_end || '14:30')}
                      </div>
                    </div>
                  </div>
                )}

              <div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#0f0f0f] p-3 rounded border border-[#1a1a1a]">
                    <div className="text-[#858585] text-xs mb-1">Days Present</div>
                    <div className="text-2xl font-semibold text-[#4ec9b0]">
                      {monthlyData.total_days_present}
                    </div>
                  </div>
                  <div className="bg-[#0f0f0f] p-3 rounded border border-[#1a1a1a]">
                    <div className="text-[#858585] text-xs mb-1">Total Entries</div>
                    <div className="text-2xl font-semibold text-[#007acc]">
                      {monthlyData.total_entries}
                    </div>
                  </div>
                  <div className="bg-[#0f0f0f] p-3 rounded border border-[#1a1a1a]">
                    <div className="text-[#858585] text-xs mb-1">Total Exits</div>
                    <div className="text-2xl font-semibold text-[#f48771]">
                      {monthlyData.total_exits}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {monthlyData.records.map((record) => (
                    <div
                      key={record.date}
                      className="bg-[#0f0f0f] p-3 rounded border border-[#1a1a1a]"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-[#d4d4d4] font-medium">
                          {formatDate(record.date)}
                        </div>
                        <div className="text-xs text-[#858585]">
                          {record.total_entries} entries / {record.total_exits} exits
                        </div>
                      </div>
                      <div className="space-y-1">
                        {record.entries?.map((entry, idx) => (
                          <div
                            key={idx}
                            className="flex items-center text-xs text-[#cccccc]"
                          >
                            {entry.type === 'entry' ? (
                              <ArrowRight className="w-3 h-3 mr-2 text-[#4ec9b0]" />
                            ) : (
                              <ArrowLeft className="w-3 h-3 mr-2 text-[#f48771]" />
                            )}
                            <span className="capitalize">{entry.type}</span>
                            <span className="mx-2">•</span>
                            <span>{formatTime(entry.time)}</span>
                            <span className="mx-2">•</span>
                            <span className="text-[#858585]">{entry.camera_id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#858585]">Loading...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
