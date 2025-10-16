"""
Dashboard API - Missing endpoints
"""

from fastapi import APIRouter
from services.mongodb_service import mongodb_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats():
    """Get dashboard statistics from MongoDB and VideoDB"""
    try:
        # Get employee stats
        employees = mongodb_service.get_all_employees(active_only=False)
        total_employees = len(employees)
        
        # Get camera stats
        cameras = mongodb_service.get_all_cameras()
        total_cameras = len(cameras)
        active_cameras = sum(1 for cam in cameras if cam.get('is_active', False))
        
        # Get VideoDB stats
        from services.videodb_integration import videodb_service
        videodb_clips = videodb_service.search_clips(limit=1000)
        total_videodb = len(videodb_clips)
        
        # Get behavior events (activity alerts from today)
        # For now, return 0 as we don't have persistent storage for alerts
        behavior_events = 0
        
        return {
            "employees": {"total": total_employees},
            "cameras": {"total": total_cameras, "active": active_cameras},
            "videodb": {"total": total_videodb},
            "events": {"today": behavior_events}
        }
    except Exception as e:
        return {
            "employees": {"total": 0},
            "cameras": {"total": 0, "active": 0},
            "videodb": {"total": 0},
            "events": {"today": 0}
        }
