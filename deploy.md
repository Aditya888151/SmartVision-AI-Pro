# Deployment Guide

## Local Development with Docker

```bash
# Create .env file in root directory
cp backend/.env .env

# Build and run locally
docker-compose up --build

# Access:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

## Deploy to Fly.io

### 1. Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login to Fly.io
```bash
flyctl auth login
```

### 3. Deploy Backend
```bash
cd backend
flyctl launch --no-deploy
flyctl secrets set MONGODB_URI="your_mongodb_uri"
flyctl secrets set MONGODB_DATABASE="AI_Automation"
flyctl secrets set OPENAI_API_KEY="your_openai_key"
flyctl secrets set DEEPFACE_MODEL="VGG-Face"
flyctl secrets set DEEPFACE_DETECTOR="opencv"
flyctl secrets set VIDEODB_API_KEY="your_videodb_key"
flyctl secrets set VIDEODB_COLLECTION_ID="your_collection_id"
flyctl deploy
```

### 4. Deploy Frontend
```bash
cd ../react-frontend
flyctl launch --no-deploy
# Update nginx.conf to use your backend URL
flyctl deploy
```

### 5. Get URLs
```bash
flyctl status
```