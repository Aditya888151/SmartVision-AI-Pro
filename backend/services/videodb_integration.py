"""
VideoDB Integration for Security Recording
Automatically saves clips when unknown persons detected
"""

import os
import cv2
import tempfile
import time
from datetime import datetime
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

class VideoDBService:
    def __init__(self):
        import os
        self.api_key = os.getenv('VIDEODB_API_KEY', '')
        self.collection_id = os.getenv('VIDEODB_COLLECTION_ID', 'default')
        self.videodb = None
        self.collection = None
        self.enabled = False
        self.cleanup_days = 3
        self._initialize()
        self._start_cleanup_task()
    
    def _initialize(self):
        """Initialize VideoDB connection"""
        try:
            from videodb import connect
            self.videodb = connect(api_key=self.api_key)
            
            # Get or create collection
            try:
                self.collection = self.videodb.get_collection(collection_id=self.collection_id)
            except:
                # If collection doesn't exist, get default collection
                collections = self.videodb.get_collections()
                if collections:
                    self.collection = collections[0]
                    self.collection_id = self.collection.id
                else:
                    # Create new collection
                    self.collection = self.videodb.create_collection(name="security_clips")
                    self.collection_id = self.collection.id
            
            logger.info(f"Connected to VideoDB collection: {self.collection_id}")
            self.enabled = True
            
        except ImportError:
            logger.warning("VideoDB SDK not installed. Run: pip install videodb")
            self.enabled = False
        except Exception as e:
            logger.error(f"VideoDB initialization failed: {e}")
            self.enabled = False
    
    def save_security_clip(
        self, 
        frames: list, 
        camera_id: str, 
        event_type: str = "unknown_person",
        metadata: Optional[Dict] = None
    ) -> Optional[str]:
        """
        Save security clip to VideoDB
        
        Args:
            frames: List of video frames
            camera_id: Camera identifier
            event_type: Type of security event
            metadata: Additional metadata
            
        Returns:
            video_id if successful, None otherwise
        """
        if not self.enabled or not frames:
            return None
        
        try:
            # Create temporary video file
            temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
            temp_path = temp_file.name
            temp_file.close()
            
            # Write frames to video
            height, width = frames[0].shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_path, fourcc, 10.0, (width, height))
            
            for frame in frames:
                out.write(frame)
            out.release()
            
            # Upload to VideoDB
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            video_name = f"{event_type}_{camera_id}_{timestamp}"
            
            video = self.collection.upload(
                file_path=temp_path,
                name=video_name,
                description=f"Security event: {event_type} from {camera_id}"
            )
            
            # Note: VideoDB Video object doesn't have add_metadata method
            # Metadata is stored in name and description instead
            
            # Cleanup temp file
            os.unlink(temp_path)
            
            logger.info(f"Saved security clip to VideoDB: {video.id}")
            return video.id
            
        except Exception as e:
            logger.error(f"Failed to save clip to VideoDB: {e}")
            return None
    
    def generate_scene_index(self, video_id: str) -> bool:
        """Generate scene index for video using VideoDB AI"""
        if not self.enabled:
            return False
        try:
            video = self.collection.get_video(video_id)
            video.generate_scene_index()
            logger.info(f"Generated scene index for video: {video_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to generate scene index: {e}")
            return False
    
    def search_semantic(self, query: str, limit: int = 10) -> list:
        """Semantic search across all videos"""
        if not self.enabled:
            return []
        try:
            results = self.collection.search(query=query, result_threshold=limit)
            return [{
                "video_id": result.video.id,
                "name": result.video.name,
                "stream_url": result.video.stream_url,
                "start_time": result.start,
                "end_time": result.end,
                "score": result.score,
                "text": result.text
            } for result in results]
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    def extract_highlights(self, video_id: str, duration: int = 30) -> Optional[str]:
        """Extract highlights from video"""
        if not self.enabled:
            return None
        try:
            video = self.collection.get_video(video_id)
            highlights = video.extract_highlights(duration=duration)
            logger.info(f"Extracted highlights for video: {video_id}")
            return highlights.stream_url
        except Exception as e:
            logger.error(f"Failed to extract highlights: {e}")
            return None
    
    def generate_summary(self, video_id: str) -> Optional[str]:
        """Generate AI summary of video content"""
        if not self.enabled:
            return None
        try:
            video = self.collection.get_video(video_id)
            summary = video.generate_summary()
            logger.info(f"Generated summary for video: {video_id}")
            return summary
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            return None
    
    def search_clips(
        self, 
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """Search security clips using VideoDB SDK internal connection"""
        if not self.enabled or not self.collection:
            return []
        
        try:
            # Use direct API call to get videos
            videos_data = self.collection._connection.get(
                path=f"video",
                params={'collection_id': self.collection_id}
            )
            videos = videos_data.get('videos', [])
            
            results = []
            for video in videos:
                video_name = video.get('name', '')
                
                if camera_id and camera_id not in video_name:
                    continue
                if event_type and event_type not in video_name:
                    continue
                
                # Extract timestamp from video name (format: event_camera_YYYYMMDD_HHMMSS)
                created_at = None
                try:
                    parts = video_name.split('_')
                    if len(parts) >= 4:
                        date_str = parts[-2] + parts[-1]  # YYYYMMDDHHMMSS
                        created_at = datetime.strptime(date_str, '%Y%m%d%H%M%S').isoformat()
                except:
                    pass
                
                results.append({
                    "video_id": video.get('id'),
                    "name": video_name,
                    "stream_url": video.get('stream_url', ''),
                    "player_url": video.get('player_url', ''),
                    "thumbnail_url": video.get('thumbnail_url', ''),
                    "length": str(video.get('length', 0)),
                    "created_at": created_at or datetime.now().isoformat(),
                    "description": video.get('description', ''),
                    "status": video.get('status', 'ready')
                })
                
                if len(results) >= limit:
                    break
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to search clips: {e}")
            return []
    
    def get_video_url(self, video_id: str) -> Optional[str]:
        """Get streaming URL for video"""
        if not self.enabled:
            return None
        
        try:
            video = self.collection.get_video(video_id)
            return video.stream_url
        except Exception as e:
            logger.error(f"Failed to get video URL: {e}")
            return None
    
    def _start_cleanup_task(self):
        """Start background task to delete old clips"""
        if not self.enabled:
            return
        
        import threading
        def cleanup_loop():
            while True:
                try:
                    self.delete_old_clips()
                except Exception as e:
                    logger.error(f"Cleanup task error: {e}")
                time.sleep(86400)  # Run daily
        
        thread = threading.Thread(target=cleanup_loop, daemon=True)
        thread.start()
    
    def delete_old_clips(self) -> int:
        """Delete clips older than 3 days"""
        if not self.enabled or not self.collection:
            return 0
        
        try:
            from datetime import timedelta
            cutoff_date = datetime.now() - timedelta(days=self.cleanup_days)
            
            # Get videos using direct API call
            videos_data = self.collection._connection.get(
                path="/video",
                params={'collection_id': self.collection_id}
            )
            from videodb.video import Video
            videos = [Video(self.collection._connection, video_data, self.collection_id) for video_data in videos_data]
            deleted_count = 0
            
            for video in videos:
                try:
                    # Skip deletion for now - created_at attribute issue
                    # video_date = datetime.fromisoformat(video.created_at.replace('Z', '+00:00'))
                    # if video_date < cutoff_date:
                    #     video.delete()
                    #     deleted_count += 1
                    #     logger.info(f"Deleted old clip: {video.id}")
                    pass
                except Exception as e:
                    pass  # Silently handle errors
            
            if deleted_count > 0:
                logger.info(f"Deleted {deleted_count} clips older than {self.cleanup_days} days")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to delete old clips: {e}")
            return 0

# Global instance
videodb_service = VideoDBService()
