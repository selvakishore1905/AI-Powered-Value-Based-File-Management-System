Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "       Starting StorageIQ Demo           " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Generate test data
Write-Host "-> Generating test data..." -ForegroundColor Yellow
python generate_test_data.py
Write-Host "Test data generation complete." -ForegroundColor Green
Write-Host ""

# 2. Start Backend in a new window
Write-Host "-> Starting FastAPI Backend (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (!(Test-Path venv)) { Write-Host 'No venv found. Please ensure requirements are installed.' -ForegroundColor Yellow }; uvicorn main:app --reload --port 8000"
Write-Host "Backend launched in a new window." -ForegroundColor Green
Write-Host ""

# 3. Start Frontend in a new window
Write-Host "-> Starting React Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
Write-Host "Frontend launched in a new window." -ForegroundColor Green
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "StorageIQ is starting up!" -ForegroundColor Green
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor White
Write-Host "Backend Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "Close the newly opened windows to stop the servers." -ForegroundColor Gray
Write-Host "=========================================" -ForegroundColor Cyan
