#!/usr/bin/env python3

import os
from dotenv import load_dotenv
load_dotenv()

try:
    from videodb import connect
    
    api_key = os.getenv('VIDEODB_API_KEY', '')
    collection_id = os.getenv('VIDEODB_COLLECTION_ID', 'default_collection')
    
    print(f"API Key: {api_key[:10]}..." if api_key else "No API Key")
    print(f"Collection ID: {collection_id}")
    
    # Test connection
    videodb = connect(api_key=api_key)
    print("Connected to VideoDB")
    
    # List collections
    collections = videodb.get_collections()
    print(f"Found {len(collections)} collections:")
    for col in collections:
        print(f"  - {col.name} (ID: {col.id})")
        
        # List videos in collection
        try:
            videos_data = col._connection.get(
                path='video',
                params={'collection_id': col.id}
            )
            videos = videos_data.get('videos', [])
            print(f"    {len(videos)} videos")
            for video in videos[:3]:  # Show first 3
                print(f"      - {video.get('name', 'Unnamed')} ({video.get('id', 'No ID')})")
        except Exception as e:
            print(f"    Error listing videos: {e}")
    
except Exception as e:
    print(f"Error: {e}")