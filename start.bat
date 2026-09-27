@echo off
echo ===================================================
echo Starting AEGIS Autonomous Intelligence Platform...
echo ===================================================

echo [1/3] Starting Neo4j Knowledge Graph (Docker)...
docker-compose up -d neo4j

echo [2/3] Starting FastAPI Backend...
start cmd /k "cd backend && .\.venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/3] Starting React Frontend...
start cmd /k "cd frontend && npm run dev"

echo ===================================================
echo ALL SYSTEMS GO!
echo Backend API: http://localhost:8000/docs
echo Frontend UI: http://localhost:5173
echo ===================================================
