import React, { useState, useEffect } from 'react';
import './EmployeeList.css';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/employees/');
      const data = await response.json();
      setEmployees(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'active') return matchesSearch && emp.is_active;
    if (filter === 'inactive') return matchesSearch && !emp.is_active;
    
    return matchesSearch;
  });

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  return (
    <div className="employee-list-container">
      <div className="employee-header">
        <h2>Employee Directory</h2>
        <div className="employee-controls">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Employees</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <div className="employee-grid">
        {filteredEmployees.map(employee => (
          <div key={employee.employee_id} className="employee-card">
            <div className="employee-image">
              {employee.images && employee.images.length > 0 ? (
                <img 
                  src={`/images/${employee.images[0].path}`} 
                  alt={employee.name}
                  onError={(e) => {
                    e.target.src = '/default-avatar.png';
                  }}
                />
              ) : (
                <div className="no-image">
                  <span>{employee.name.charAt(0)}</span>
                </div>
              )}
            </div>
            
            <div className="employee-info">
              <h3>{employee.name}</h3>
              <p className="employee-id">ID: {employee.employee_id}</p>
              <p className="department">{employee.department}</p>
              <p className="role">{employee.role}</p>
              
              {employee.shift_start && employee.shift_end && (
                <p className="shift">
                  Shift: {employee.shift_start} - {employee.shift_end}
                </p>
              )}
              
              <div className={`status ${employee.is_active ? 'active' : 'inactive'}`}>
                {employee.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="no-employees">
          <p>No employees found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
