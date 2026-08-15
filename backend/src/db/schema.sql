-- RailSmart Database Schema
-- Implements the 8 core tables with explicit simulated labeling for non-public data attributes

-- 1. Trains Table
CREATE TABLE IF NOT EXISTS trains (
  train_id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  priority_rank INTEGER NOT NULL,
  source_station TEXT NOT NULL,
  destination_station TEXT NOT NULL,
  max_speed_kmh REAL DEFAULT 110.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stations Table
CREATE TABLE IF NOT EXISTS stations (
  station_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform_count INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  zone TEXT DEFAULT 'NR',
  is_junction BOOLEAN DEFAULT FALSE
);

-- 3. Block Sections Table (Simulated Block Graph)
CREATE TABLE IF NOT EXISTS block_sections (
  block_id TEXT PRIMARY KEY,
  from_station TEXT NOT NULL,
  to_station TEXT NOT NULL,
  length_km REAL NOT NULL,
  is_single_line BOOLEAN DEFAULT FALSE,
  max_speed_kmh REAL DEFAULT 130.0,
  current_occupancy_train_id TEXT,
  simulated_signal_state TEXT DEFAULT 'GREEN', -- GREEN / YELLOW / RED (SIMULATED)
  FOREIGN KEY (from_station) REFERENCES stations(station_code),
  FOREIGN KEY (to_station) REFERENCES stations(station_code)
);

-- 4. Train Runs (Live & Simulated Telemetry)
CREATE TABLE IF NOT EXISTS train_runs (
  run_id TEXT PRIMARY KEY,
  train_id TEXT NOT NULL,
  date TEXT NOT NULL,
  current_station TEXT,
  next_station TEXT,
  prev_station TEXT,
  live_delay_minutes INTEGER DEFAULT 0,
  live_lat REAL,
  live_lng REAL,
  speed_kmh REAL DEFAULT 75.0,
  direction TEXT DEFAULT 'DN', -- DN (NDLS->HWH) or UP (HWH->NDLS)
  current_block_id TEXT,
  block_progress REAL DEFAULT 0.5, -- 0.0 to 1.0 along the block section
  simulated_platform INTEGER,
  eta_next_station_mins REAL DEFAULT 10.0,
  distance_to_next_km REAL DEFAULT 15.0,
  status TEXT DEFAULT 'RUNNING',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (train_id) REFERENCES trains(train_id),
  FOREIGN KEY (current_block_id) REFERENCES block_sections(block_id)
);

-- 5. Weather Snapshots Table (Live from OpenWeatherMap + Fallback Cache)
CREATE TABLE IF NOT EXISTS weather_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  station_code TEXT NOT NULL,
  condition TEXT NOT NULL, -- CLEAR, FOG, MIST, RAIN, THUNDERSTORM, HEAT
  visibility_m REAL DEFAULT 1000.0,
  temp_c REAL DEFAULT 28.0,
  wind_speed_kmh REAL DEFAULT 12.0,
  is_cached BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_code) REFERENCES stations(station_code)
);

-- 6. Conflict Events Table
CREATE TABLE IF NOT EXISTS conflict_events (
  conflict_id TEXT PRIMARY KEY,
  train_a TEXT NOT NULL,
  train_b TEXT NOT NULL,
  conflict_type TEXT NOT NULL, -- SAME_BLOCK_OVERTAKE, OPPOSING_HEADON, PLATFORM_BOTTLENECK
  location_id TEXT NOT NULL, -- block_id or station_code
  location_label TEXT NOT NULL,
  severity TEXT NOT NULL, -- CRITICAL, HIGH, MEDIUM, RESOLVED
  distance_gap_km REAL,
  time_to_conflict_mins REAL,
  description TEXT,
  resolution_action TEXT,
  selected_option_id TEXT,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE / RESOLVED / DISMISSED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Recommendations Table (With 3-Way Alternate Strategies & Explainability)
CREATE TABLE IF NOT EXISTS recommendations (
  rec_id TEXT PRIMARY KEY,
  conflict_id TEXT NOT NULL,
  train_id TEXT NOT NULL,
  run_id TEXT,
  type TEXT NOT NULL, -- HOLD / SPEED_ADJUST / REROUTE
  value TEXT,
  reasoning_text TEXT NOT NULL,
  explainability_trace_json TEXT,
  trade_off_summary TEXT,
  risk_level TEXT NOT NULL,
  operator_decision TEXT DEFAULT 'pending', -- pending / accepted / rejected / overridden
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP,
  FOREIGN KEY (conflict_id) REFERENCES conflict_events(conflict_id)
);

-- 8. Simulated Platform Assignments (Explicitly Named Simulated)
CREATE TABLE IF NOT EXISTS simulated_platform_assignments (
  assignment_id TEXT PRIMARY KEY,
  station_code TEXT NOT NULL,
  train_id TEXT NOT NULL,
  platform_number INTEGER NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expected_departure_mins REAL DEFAULT 15.0,
  status TEXT DEFAULT 'OCCUPIED', -- OCCUPIED / RESERVED / CLEARED
  FOREIGN KEY (station_code) REFERENCES stations(station_code),
  FOREIGN KEY (train_id) REFERENCES trains(train_id)
);

-- 9. Operator Audit & Trust Score Log
CREATE TABLE IF NOT EXISTS operator_decisions_log (
  log_id TEXT PRIMARY KEY,
  rec_id TEXT NOT NULL,
  conflict_id TEXT NOT NULL,
  selected_option_id TEXT NOT NULL,
  action TEXT NOT NULL, -- ACCEPTED / REJECTED / MANUAL_OVERRIDE
  operator_id TEXT DEFAULT 'DISPATCHER_NORTH_01',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- 10. Synthetic Historical Delay Trends (Clearly Tagged Simulated in UI)
CREATE TABLE IF NOT EXISTS synthetic_historical_trends (
  trend_id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  corridor_name TEXT NOT NULL,
  avg_punctuality_percent REAL NOT NULL,
  avg_delay_mins REAL NOT NULL,
  weather_disruption_factor REAL NOT NULL,
  conflicts_resolved_count INTEGER NOT NULL,
  system_trust_score_percent REAL NOT NULL
);
