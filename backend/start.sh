#!/bin/bash
# Start the Pyxis FastAPI backend locally
# Run from inside the backend/ folder

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Starting Pyxis API on http://localhost:8000"
echo "Swagger docs: http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
