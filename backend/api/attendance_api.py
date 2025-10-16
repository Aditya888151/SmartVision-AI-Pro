"""
Attendance API
View and manage employee attendance records
"""
from fastapi import APIRouter
from datetime import datetime
from services.mongodb_service import mongodb_service

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

@router.get("/{employee_id}/today")
async def get_today_attendance(employee_id: str):
    """Get today's attendance for employee"""
    today = datetime.now().strftime('%Y-%m-%d')
    attendance = mongodb_service.get_attendance(employee_id, today)
    return attendance or {"message": "No attendance record for today"}

@router.get("/{employee_id}/month/{year}/{month}")
async def get_monthly_attendance(employee_id: str, year: int, month: int):
    """Get monthly attendance summary"""
    records = mongodb_service.get_monthly_attendance(employee_id, year, month)
    
    # Calculate summary
    total_days = len(records)
    total_entries = sum(r.get('total_entries', 0) for r in records)
    total_exits = sum(r.get('total_exits', 0) for r in records)
    
    return {
        "employee_id": employee_id,
        "year": year,
        "month": month,
        "total_days_present": total_days,
        "total_entries": total_entries,
        "total_exits": total_exits,
        "records": records
    }

@router.get("/all/today")
async def get_all_today_attendance():
    """Get today's attendance for all employees"""
    today = datetime.now().strftime('%Y-%m-%d')
    employees = mongodb_service.get_all_employees()
    
    results = []
    for emp in employees:
        attendance = mongodb_service.get_attendance(emp['employee_id'], today)
        if attendance:
            results.append({
                "employee_id": emp['employee_id'],
                "name": emp['name'],
                "status": attendance.get('status', 'absent'),
                "first_entry": attendance.get('first_entry'),
                "last_exit": attendance.get('last_exit'),
                "total_entries": attendance.get('total_entries', 0),
                "total_exits": attendance.get('total_exits', 0)
            })
        else:
            results.append({
                "employee_id": emp['employee_id'],
                "name": emp['name'],
                "status": "absent",
                "first_entry": None,
                "last_exit": None,
                "total_entries": 0,
                "total_exits": 0
            })
    
    return {"date": today, "attendance": results}
