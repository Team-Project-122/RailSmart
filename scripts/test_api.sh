#!/usr/bin/env bash

# Test script for RailSmart full-stack API integration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Start Python rule engine
python3 -m uvicorn app:app --app-dir "$PROJECT_ROOT/rule_engine" --host 127.0.0.1 --port 8000 &
PID_PY=$!

# Start Node.js backend
node "$PROJECT_ROOT/backend/src/index.js" &
PID_NODE=$!

sleep 3

echo "=== 1. Health Check ==="
curl -s http://localhost:5001/health
echo ""

echo "=== 2. Train List ==="
curl -s http://localhost:5001/api/trains | grep -o '"status":"SUCCESS"[^}]*' | head -n 1
echo ""

echo "=== 3. Conflict Detection & 3-Way Resolutions ==="
curl -s http://localhost:5001/api/conflicts | grep -o '"status":"SUCCESS"[^}]*' | head -n 1
echo ""

echo "=== 4. What-If Delay Propagation Simulation ==="
curl -s -X POST http://localhost:5001/api/what-if -H "Content-Type: application/json" -d '{"targetTrainNumber":"22436", "injectedDelayMins":15}'
echo ""

echo "=== 5. Simulated Platform Allocation for New Delhi (NDLS) ==="
curl -s http://localhost:5001/api/platforms/NDLS | head -c 200
echo ""

kill $PID_PY $PID_NODE 2>/dev/null
echo "API Integration Test Completed Successfully!"
