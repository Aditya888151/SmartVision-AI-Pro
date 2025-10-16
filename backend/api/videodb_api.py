"""
VideoDB API Endpoints
Search and retrieve security clips
"""

from fastapi import APIRouter, HTTPException
from services.videodb_integration import videodb_service
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/videodb", tags=["videodb"])

@router.get("/clips")
async def search_clips(
    camera_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
):
    """Search security clips (max 100)"""
    clips = videodb_service.search_clips(
        camera_id=camera_id,
        event_type=event_type,
        limit=100
    )
    
    return {
        "total": len(clips),
        "clips": clips
    }

@router.post("/clips/delete")
async def delete_clips(data: dict):
    """Delete multiple video clips from VideoDB"""
    try:
        if not videodb_service.enabled:
            raise HTTPException(status_code=503, detail="VideoDB not available")
        
        video_ids = data.get("video_ids", [])
        deleted = []
        
        for video_id in video_ids:
            try:
                video = videodb_service.collection.get_video(video_id)
                video.delete()
                deleted.append(video_id)
            except:
                pass
        
        return {"success": True, "deleted": deleted, "count": len(deleted)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clips/{video_id}")
async def get_clip(video_id: str):
    """Get specific clip details"""
    url = videodb_service.get_video_url(video_id)
    
    if not url:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {
        "video_id": video_id,
        "stream_url": url
    }

@router.post("/clips/{video_id}/scene-index")
async def generate_scene_index(video_id: str):
    """Generate AI scene index for video"""
    if not videodb_service.enabled:
        raise HTTPException(status_code=503, detail="VideoDB not available")
    
    success = videodb_service.generate_scene_index(video_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to generate scene index")
    
    return {"success": True, "message": "Scene index generated"}

@router.get("/search")
async def semantic_search(query: str, limit: int = 10):
    """Semantic search across all videos"""
    if not videodb_service.enabled:
        raise HTTPException(status_code=503, detail="VideoDB not available")
    
    results = videodb_service.search_semantic(query, limit)
    return {
        "query": query,
        "total": len(results),
        "results": results
    }

@router.post("/clips/{video_id}/highlights")
async def extract_highlights(video_id: str, duration: int = 30):
    """Extract video highlights using AI"""
    if not videodb_service.enabled:
        raise HTTPException(status_code=503, detail="VideoDB not available")
    
    highlights_url = videodb_service.extract_highlights(video_id, duration)
    if not highlights_url:
        raise HTTPException(status_code=500, detail="Failed to extract highlights")
    
    return {
        "video_id": video_id,
        "highlights_url": highlights_url,
        "duration": duration
    }

@router.post("/clips/{video_id}/summary")
async def generate_summary(video_id: str):
    """Generate AI summary of video content"""
    if not videodb_service.enabled:
        raise HTTPException(status_code=503, detail="VideoDB not available")
    
    summary = videodb_service.generate_summary(video_id)
    if not summary:
        raise HTTPException(status_code=500, detail="Failed to generate summary")
    
    return {
        "video_id": video_id,
        "summary": summary
    }

@router.get("/status")
async def videodb_status():
    """Check VideoDB connection status"""
    return {
        "enabled": videodb_service.enabled,
        "collection": videodb_service.collection_id if videodb_service.enabled else None,
        "status": "connected" if videodb_service.enabled else "disconnected",
        "features": [
            "video_upload",
            "scene_indexing", 
            "semantic_search",
            "highlights_extraction",
            "ai_summary",
            "auto_cleanup"
        ] if videodb_service.enabled else []
    }
