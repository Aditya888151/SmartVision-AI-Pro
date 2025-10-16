import os
from dotenv import load_dotenv
load_dotenv()

from videodb import connect

api_key = os.getenv('VIDEODB_API_KEY')
videodb = connect(api_key=api_key)

# List all collections
try:
    collections_data = videodb.get(path="collection")
    collections = collections_data.get('collections', [])
    
    print(f"Found {len(collections)} collections:")
    for col in collections:
        print(f"- Name: {col.get('name', 'Unnamed')}")
        print(f"  ID: {col.get('id')}")
        print(f"  Description: {col.get('description', 'No description')}")
        print()
        
    if collections:
        # Use first collection
        first_col_id = collections[0]['id']
        print(f"Using collection: {first_col_id}")
        
        collection = videodb.get_collection(collection_id=first_col_id)
        videos = collection.get_videos()
        print(f"Videos in collection: {len(videos)}")
        
        for video in videos[:5]:  # Show first 5
            print(f"- {video.name} (ID: {video.id})")
            
except Exception as e:
    print(f"Error: {e}")