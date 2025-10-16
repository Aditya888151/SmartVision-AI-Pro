import os
from dotenv import load_dotenv
load_dotenv()

from videodb import connect

api_key = os.getenv('VIDEODB_API_KEY')
collection_id = os.getenv('VIDEODB_COLLECTION_ID', 'default_collection')

print(f"Testing with collection: {collection_id}")

videodb = connect(api_key=api_key)
collection = videodb.get_collection(collection_id=collection_id)

videos = collection.get_videos()
print(f"Found {len(videos)} videos:")

for video in videos:
    print(f"- {video.name} (ID: {video.id})")
    print(f"  Stream URL: {getattr(video, 'stream_url', 'N/A')}")
    print(f"  Length: {getattr(video, 'length', 'N/A')}")