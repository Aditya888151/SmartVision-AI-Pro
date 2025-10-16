@echo off
echo Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
timeout /t 30 /nobreak
echo Building and running containers...
docker-compose up --build -d
echo Containers started!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:8000
pause