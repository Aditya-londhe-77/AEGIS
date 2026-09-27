Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting AEGIS Autonomous Intelligence Platform..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

Write-Host "[1/3] Starting Neo4j Knowledge Graph (Docker)..." -ForegroundColor Yellow
docker-compose up -d neo4j

Write-Host "[2/3] Starting FastAPI Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\.venv\Scripts\activate; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "[3/3] Starting React Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "===================================================" -ForegroundColor Green
Write-Host "ALL SYSTEMS GO!" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000/docs"
Write-Host "Frontend UI: http://localhost:5173"
Write-Host "===================================================" -ForegroundColor Green
