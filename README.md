# SmartVision AI Pro

Advanced AI-powered camera system with facial recognition, biometric analysis, and real-time monitoring.

## Features

- **Real-time Face Recognition** using DeepFace
- **Biometric Analysis** with iris pattern extraction
- **Activity Monitoring** with AI behavior detection
- **VideoDB Integration** for security clips
- **MongoDB Atlas** for data storage
- **Docker Deployment** ready

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Aditya888151/SmartVision-AI-Pro.git
cd SmartVision-AI-Pro
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your API keys and MongoDB URI
```

### 3. Docker Deployment
```bash
docker-compose up --build
```

### 4. Access Application
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Environment Variables

Create `.env` file with:
```
MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=your_database_name
OPENAI_API_KEY=your_openai_api_key
DEEPFACE_MODEL=VGG-Face
DEEPFACE_DETECTOR=opencv
VIDEODB_API_KEY=your_videodb_api_key
VIDEODB_COLLECTION_ID=your_collection_id
```

## Deployment

See [deploy.md](deploy.md) for detailed deployment instructions including Fly.io.

## Tech Stack

- **Backend**: FastAPI, Python, DeepFace, OpenCV
- **Frontend**: React, Tailwind CSS
- **Database**: MongoDB Atlas
- **AI/ML**: OpenAI, DeepFace, VideoDB
- **Deployment**: Docker, Fly.io