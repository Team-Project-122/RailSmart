# RailSmart: AI-Assisted Train Traffic Control & Decision Support System

> **Built for Smart India Hackathon (SIH)**  
> An intelligent decision-support tool for Indian Railways train traffic controllers (dispatchers) that ingests live train data, applies transparent rule-based intelligence, detects track conflicts, and provides 3 actionable resolution strategies with complete explainability traces.

---

## 1. Core Engineering Honesty & Data Classification

In real-world Indian Railways operations, public APIs **do not expose** real-time interlocking signal states, internal block section occupancy, or dynamic platform allocations. Many hackathon submissions fake these as "live API endpoints." **RailSmart is built with absolute engineering honesty**, explicitly categorizing all data streams into:

### 🟢 Real, Live Data Streams
| Data Field | Source | Description / Endpoint |
|---|---|---|
| **Train Number & Name** | RailRadar API | Official train identity & classification |
| **Live Train Position & Delay** | RailRadar API | `GET /v1/trains/{number}/live` (live delay in minutes) |
| **Scheduled Timetable** | RailRadar API | `GET /v1/trains/{number}` (station arrivals & departures) |
| **Route Geometry** | RailRadar API | `GET /v1/trains/{number}/route` (inter-station distances) |
| **Station Weather & Visibility** | OpenWeatherMap API | Live visibility (meters), temperature (°C), weather conditions |

> **Resilience & Demo Safety Layer:** RailRadar and OpenWeatherMap clients feature automatic in-memory and disk fallback caching (`services/railradar.js`). If external APIs rate-limit or go down during a live presentation, the system continues operating with zero crashes and clearly flags `[CACHED / FALLBACK MODE]` in the telemetry banner.

### 🟡 Simulated / Rule-Derived Subsystems (`[SIMULATED]` in UI)
| Subsystem | Methodology | Why it is Simulated |
|---|---|---|
| **Platform Allocation** | Least-Recently-Used (LRU) / Round-Robin `PlatformAllocator` against real platform counts (NDLS: 16, CNB: 10, PRYJ: 10, HWH: 23). | Dynamic platform interlocking is internal to Indian Railways station master consoles. |
| **Block Section Topology** | Linear multi-track graph dividing inter-station segments into monitored block sections. | Block circuit telemetry is proprietary to IR signaling divisions. |
| **Signal Aspect State** | Derived automatically from train headways: `RED` if block occupied ahead, `YELLOW` if caution/overlap, `GREEN` if clear. | Derived from safe headway distance physics ($\ge 2.5\text{ km}$). |
| **Train Priority Ranking** | Standard Indian Railways General & Subsidiary Rules (G&SR) Operating Manual hierarchy. | Domain configuration file (`rule_engine/config/ir_priority.py`). |
| **Historical Delay Trends** | Synthetic 7-day trend generator modeling weather disruptions and conflict counts. | Labeled `[SIMULATED FOR DEMONSTRATION]` directly on charts. |

---

## 2. Five Distinguishing Architectural Pillars

1. **Conflict Resolution Engine (Not just conflict detection):**
   - When two trains contest a block section or platform window, the system evaluates the Indian Railways precedence hierarchy:
     $$\text{Vande Bharat / Rajdhani / Shatabdi (Rank 1)} > \text{Superfast (Rank 2)} > \text{Mail/Express (Rank 3)} > \text{Passenger (Rank 4)} > \text{Freight (Rank 5)}$$
   - Outputs concrete operational instructions, e.g.:  
     `"Hold Train BCN-489 (Freight) at Kanpur Outer Loop Line for 4 min to let Train 22436 (Vande Bharat) clear Mainline at 125 km/h."`

2. **Step-by-Step Explainability Trace on Every Recommendation:**
   - Every recommendation renders a transparent reasoning chain:
     $$\text{[Spatial Conflict IR-OCC-01]} \rightarrow \text{[Priority Hierarchy IR-PR-01]} \rightarrow \text{[Weather Braking Envelope IR-WX]} \rightarrow \text{[Physics Headway Calculation]}$$
   - No black-box percentages; train controllers can verify exactly *why* a decision was proposed.

3. **Multiple Alternate Resolution Strategies (Operator Driven):**
   - For every conflict, the Rule Engine computes **3 structurally distinct strategies**:
     - **Option A — Pre-emptive Hold (Zero Risk):** Holds lower-priority train at outer signal / loop line; calculates exact delay ($+N\text{ min}$) for zero risk.
     - **Option B — Dynamic Speed Regulation (Flow Optimization):** Regulates speed (e.g. caps to $45\text{ km/h}$) to dynamically expand headway to $>3.5\text{ km}$ without stopping.
     - **Option C — Track / Platform Diversion (Throughput Preservation):** Switches train onto passing loop siding or alternate platform track.
   - Dispatcher picks one via UI $\rightarrow$ immediately updates live map, train ETAs, and audit log.

4. **Cascading Delay Propagation Simulation ("What-If" Mode):**
   - Operator can test injecting $+1$ to $+45\text{ min}$ delay onto any train.
   - Deterministic graph propagation algorithm evaluates downstream stations and calculates knock-on delays across all affected trains sharing track sections.

5. **Weather-Driven Speed-Restriction Rule Engine:**
   - Real-time weather ingestion mapped into Indian Railways safety circular standards:
     - **Dense Fog ($<200\text{m}$ visibility):** Speed capped to $60\text{ km/h}$ (FOGSAFE detonator rule).
     - **Moderate Fog / Mist ($<500\text{m}$ visibility):** Speed capped to $75\text{ km/h}$.
     - **Heavy Rain / Thunderstorm:** Capped to $80\%$ of sectional speed.
     - **Extreme Summer Heat ($>45^\circ\text{C}$):** Capped to $85\%$ of speed to prevent thermal rail buckling on Continuous Welded Rails (CWR).

---

## 3. System Architecture Diagram

```
                        ┌───────────────────────────────────────────────┐
                        │             EXTERNAL LIVE APIS                │
                        │  RailRadar API        OpenWeatherMap API      │
                        └───────┬───────────────────────┬───────────────┘
                                │                       │
                                ▼                       ▼
                        ┌───────────────────────────────────────────────┐
                        │         RESILIENT BACKEND SERVICES            │
                        │  • services/railradar.js (with offline cache) │
                        │  • services/weather.js (with station coords)  │
                        │  • services/platformAllocator.js [SIMULATED]  │
                        │  • services/simulator.js (progression ticker) │
                        └───────┬───────────────────────▲───────────────┘
                                │                       │
                                │ REST / JSON           │ Updates & Actions
                                ▼                       │
                        ┌───────────────────────────────┴───────────────┐
                        │     PYTHON RULE & DECISION ENGINE (FastAPI)   │
                        │  • IR Priority Hierarchy Precedence           │
                        │  • 3-Way Alternate Conflict Resolution Engine │
                        │  • Explainability Trace Generator             │
                        │  • Cascading Delay Graph Propagator (What-If) │
                        │  • Weather Speed Restriction Circulars        │
                        └───────────────────────┬───────────────────────┘
                                                │
                                                ▼ Socket.io (Port 5001)
                        ┌───────────────────────────────────────────────┐
                        │         REACT DASHBOARD UI (Port 5173)        │
                        │  • Interactive Track Network Schematic (SVG)  │
                        │  • 3-Way Strategy Selector & Reasoning Trace  │
                        │  • Cascading "What-If" Propagation Simulator  │
                        │  • Simulated Platform Allocation Bays         │
                        │  • Station Weather & Safety Regulations       │
                        │  • Operator Trust Score & Audit Analytics     │
                        │  • 1-Click Interactive Demo Scenarios         │
                        └───────────────────────────────────────────────┘
```

---

## 4. Quick Start & Local Setup

### Prerequisites
- Node.js (v18+) and npm
- Python (3.10+)

### 1-Command Startup
From the project root:
```bash
./scripts/run_all.sh
```

Or start services individually:

#### Terminal 1 — Python Rule Engine
```bash
cd rule_engine
python3 -m pip install -r requirements.txt
python3 app.py
# Runs on http://127.0.0.1:8000 (Swagger docs at /docs)
```

#### Terminal 2 — Node.js Backend & Database
```bash
cd backend
npm install
node src/db/seed.js   # Seeds Delhi-Howrah Golden Corridor
npm start
# Runs on http://localhost:5001 (Socket.io & REST API)
```

#### Terminal 3 — React Dashboard
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173 in browser
```

---

## 5. Judge Q&A Defense Guide (Crucial for SIH)

### Q1: "Is this using real Machine Learning for collision prediction?"
> **Answer:** *"No, and that is an intentional design choice based on domain safety. In train traffic control, safety-critical conflict resolution cannot rely on black-box ML predictions with hallucination risks. Indian Railways operations follow strict, deterministic General & Subsidiary Rules (G&SR). RailSmart implements transparent, deterministic rule-based intelligence with complete explainability traces so human dispatchers can verify the exact reasoning chain behind every recommendation."*

### Q2: "Where do you get signaling and platform data if it's not public?"
> **Answer:** *"We are completely honest about this: Indian Railways does not provide public APIs for signaling circuits or dynamic platform interlocking. In RailSmart, we ingest real live train GPS, schedules, and delays from RailRadar, and real live atmospheric visibility from OpenWeatherMap. Track block occupancy and platform allocations are modeled through simulated heuristic subsystems clearly labeled with `[SIMULATED]` badges across the UI and codebase."*

### Q3: "Why did you build 3 alternate strategies instead of just 1 recommendation?"
> **Answer:** *"In actual control rooms, the optimal decision depends on contextual trade-offs: Option A (Hold) guarantees zero collision risk at the expense of a known delay; Option B (Speed Regulation) maintains continuous flow and avoids energy spikes from restarting heavy rakes; Option C (Reroute) preserves corridor throughput by leveraging loop lines. Providing 3 distinct strategies keeps the human controller in command while AI provides structured options with trade-off matrices."*

### Q4: "What happens if RailRadar or OpenWeatherMap API goes down during a live demo?"
> **Answer:** *"We built a resilient offline caching layer into `services/railradar.js` and `services/weather.js`. If an external API experiences rate limits or network drops, RailSmart automatically switches to last-known-good cached data and flags `[CACHED FALLBACK MODE]` in the telemetry status without any service interruption."*

---

## 6. Project Directory Structure

```
RailSmart/
├── backend/
│   ├── src/
│   │   ├── config/index.js           # Server & API configuration
│   │   ├── db/
│   │   │   ├── index.js              # better-sqlite3 database connector
│   │   │   ├── schema.sql            # 8 core SQL tables with simulated tags
│   │   │   └── seed.js               # Golden Corridor seed dataset
│   │   ├── services/
│   │   │   ├── railradar.js          # RailRadar API client + resilience cache
│   │   │   ├── weather.js            # OpenWeatherMap client + cache
│   │   │   ├── platformAllocator.js  # Heuristic LRU platform manager
│   │   │   ├── simulator.js          # Live progression ticker & signal logic
│   │   │   └── ruleEngineClient.js   # Python rule engine client with JS fallback
│   │   ├── socket/socketHandler.js   # Real-time WebSocket broadcasting
│   │   ├── routes/api.js             # REST API routes
│   │   └── index.js                  # Express & Socket.io server
│   └── package.json
├── rule_engine/
│   ├── app.py                        # FastAPI entry point
│   ├── config/
│   │   ├── ir_priority.py            # Indian Railways priority hierarchy
│   │   └── weather_rules.py          # Visibility & heat speed restriction rules
│   ├── engine/
│   │   ├── conflict_detector.py      # Spatial & headway conflict detector
│   │   ├── resolution_engine.py      # 3-way strategy generator
│   │   ├── explainability.py         # Reasoning trace builder
│   │   └── cascading_simulator.py    # Graph delay propagation model
│   ├── test_engine.py                # Python test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx            # Control room status & scenario selector
│   │   │   ├── TrackNetwork.jsx      # Centerpiece interactive schematic
│   │   │   ├── ConflictResolutionDrawer.jsx # 3-way strategy cards & traces
│   │   │   ├── WhatIfSimulator.jsx   # Cascading delay propagation playground
│   │   │   ├── PlatformAllocationBoard.jsx # Simulated platform bays
│   │   │   ├── WeatherMonitor.jsx    # Real-time weather & speed restrictions
│   │   │   └── AnalyticsPanel.jsx    # Trust score & synthetic historical trends
│   │   ├── context/SocketContext.jsx # Real-time Socket.io state provider
│   │   ├── styles/index.css          # Dark slate & Rail Orange design system
│   │   ├── App.jsx                   # Main layout container
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── scripts/
│   └── run_all.sh                    # 1-click startup script
└── README.md                         # Complete project documentation
```
