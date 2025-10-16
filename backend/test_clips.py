import os
from dotenv import load_dotenv
load_dotenv()

from videodb import connect

api_key = os.getenv('VIDEODB_API_KEY')
collection_id = os.getenv('VIDEODB_COLLECTION_ID')

print(f"Collection ID: {collection_id}")

videodb = connect(api_key=api_key)
collection = videodb.get_collection(collection_id=collection_id)

try:
    videos = collection.get_videos()
    print(f"Found {len(videos)} videos:")
    
    for video in videos:
        print(f"- Name: {video.name}")
        print(f"  ID: {video.id}")
        print(f"  Stream URL: {getattr(video, 'stream_url', 'N/A')}")
        print()
        
except Exception as e:
    print(f"Error getting videos: {e}")
    
# Test saving a new clip
print("Testing clip generation...")
import cv2
import numpy as np

# Create test frames
test_frames = []
for i in range(30):  # 1 second at 30fps
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(frame, f"Test Frame {i}", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    test_frames.append(frame)

from services.videodb_integration import videodb_service
clip_id = videodb_service.save_security_clip(
    frames=test_frames,
    camera_id="test_cam",
    event_type="test_unauthorized",
    metadata={"test": True}
)

print(f"Test clip saved: {clip_id}")