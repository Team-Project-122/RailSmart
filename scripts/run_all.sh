#!/usr/bin/env bash

# RailSmart All-in-One Startup Script
# Boots Python Rule Engine (Port 8000), Node.js Backend (Port 5001), and React Frontend (Port 5173)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "================================================================="
echo "        🚂 STARTING RAILSMART DECISION SUPPORT SYSTEM           "
echo "================================================================="

# Trap to kill all child background processes on CTRL+C
trap 'echo "Stopping RailSmart services..."; kill $(jobs -p) 2>/dev/null; exit 0' SIGINT SIGTERM EXIT

# 1. Start Python FastAPI Rule Engine
echo "[1/3] Launching Python Rule Engine on port 8000..."
cd "$PROJECT_ROOT/rule_engine"
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 &
PID_RULE=$!

# 2. Seed & Start Node.js Backend
echo "[2/3] Initializing DB & Launching Node.js Backend on port 5001..."
cd "$PROJECT_ROOT/backend"
node src/db/seed.js
node src/index.js &
PID_BACKEND=$!

# 3. Start React Frontend Dev Server
echo "[3/3] Launching React Dashboard on port 5173..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- --host 127.0.0.1 --port 5173 &
PID_FRONTEND=$!

echo ""
echo "================================================================="
echo "   RAILSMART ALL SERVICES ARE RUNNING!                          "
echo "   - Frontend Dashboard:   http://localhost:5173                "
echo "   - Node.js API:          http://localhost:5001/api            "
echo "   - Python Rule Engine:   http://localhost:8000/docs           "
echo "================================================================="
echo "Press CTRL+C to stop all services."
echo ""

# Wait for background processes
wait
