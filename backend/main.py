from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
import uvicorn

# Load environment variables FIRST
load_dotenv()

# Initialize services after env vars loaded
from services.ai_analysis_service import get_ai_service
get_ai_service()  # Initialize with loaded env vars

# Routers
from api.employee_api import router as employee_router
from optimized_camera_system import router as camera_router
from api.videodb_api import router as videodb_router
from api.dashboard_api import router as dashboard_router
from api.attendance_api import router as attendance_router
from services.videodb_integration import videodb_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("SmartVision AI Pro starting...")
    yield


app = FastAPI(
    title="SmartVision AI Pro",
    description="Enterprise Employee Monitoring System",
    version="1.0.0",
    lifespan=lifespan
)

# ---------------------- CORS ----------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://smartvision-frontend.onrender.com", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------- API Routes ----------------------
app.include_router(employee_router)
app.include_router(camera_router)
app.include_router(videodb_router)
app.include_router(dashboard_router)
app.include_router(attendance_router)

@app.get("/")
async def root():
    return {"message": "SmartVision AI Pro Backend", "status": "running", "docs": "/docs"}

@app.get("/api/")
async def backend_root():
    return {"message": "SmartVision AI Pro Backend", "status": "running"}


# ---------------------- Run ----------------------
if __name__ == "__main__":
    print("Starting SmartVision AI Pro Server...")
    print("Frontend: http://localhost:3000")
    print("API Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
