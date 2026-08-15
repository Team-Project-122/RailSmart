"""
RailSmart Python Rule & Decision Support Engine (FastAPI Service)
Transparent, deterministic heuristics & Indian Railways G&SR rule execution.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from config.ir_priority import get_train_category, compare_train_priority, IR_PRIORITY_HIERARCHY
from config.weather_rules import evaluate_weather_speed_restriction, WEATHER_SPEED_RULES
from engine.conflict_detector import detect_conflicts
from engine.resolution_engine import generate_resolution_options
from engine.cascading_simulator import simulate_cascading_delay

app = FastAPI(
    title="RailSmart Rule & Risk Engine",
    description="Deterministic Decision-Support & Conflict Resolution Engine for Indian Railways",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Pydantic Models -----------------
class TrainModel(BaseModel):
    number: str
    name: Optional[str] = ""
    train_class: Optional[str] = Field(default="", alias="class")
    current_station: Optional[str] = None
    next_station: Optional[str] = None
    prev_station: Optional[str] = None
    direction: Optional[str] = "DN"
    live_delay_minutes: Optional[int] = 0
    speed_kmh: Optional[float] = 75.0
    current_block_id: Optional[str] = None
    block_progress: Optional[float] = 0.5
    block_length_km: Optional[float] = 25.0
    is_single_line: Optional[bool] = False
    eta_next_station_mins: Optional[float] = 10.0
    distance_to_next_km: Optional[float] = 12.0
    simulated_platform: Optional[int] = None
    scheduled_stops: Optional[List[str]] = None

    class Config:
        populate_by_name = True

class WeatherSnapshot(BaseModel):
    station_code: str
    condition: Optional[str] = "CLEAR"
    visibility_m: Optional[float] = 1000.0
    temp_c: Optional[float] = 28.0
    wind_speed_kmh: Optional[float] = 10.0

class EvaluateRequest(BaseModel):
    trains: List[TrainModel]
    weather_snapshots: Optional[List[WeatherSnapshot]] = None

class WhatIfRequest(BaseModel):
    target_train_number: str
    injected_delay_mins: int
    trains: List[TrainModel]
    corridor_stations: Optional[List[str]] = None

class WeatherEvalRequest(BaseModel):
    station_code: str
    condition: str
    visibility_m: float
    temp_c: float
    normal_max_speed: Optional[float] = 130.0

# ----------------- Routes -----------------

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "RailSmart Rule & Risk Engine",
        "engine_type": "Deterministic Rule-Based / IR G&SR Domain Heuristics",
        "ml_status": "Transparent Rules (No fabricated ML)"
    }

@app.get("/api/rules/priority-hierarchy")
def get_priority_hierarchy():
    """Returns the configured Indian Railways train class priority table."""
    return {
        "hierarchy": IR_PRIORITY_HIERARCHY,
        "note": "Documented as simulated domain configuration based on IR operating manual precedence."
    }

@app.post("/api/rules/evaluate")
def evaluate_network_conflicts(payload: EvaluateRequest):
    """
    Evaluates current train states, detects conflicts, and generates
    3 distinct resolution options for each conflict along with explainability traces.
    """
    trains_dict = [t.model_dump(by_alias=True) for t in payload.trains]
    weather_map = {w.station_code: w.model_dump() for w in (payload.weather_snapshots or [])}

    # 1. Detect conflicts
    conflicts = detect_conflicts(trains_dict)
    
    # 2. For each conflict, generate 3-way resolution options
    resolutions = []
    for conf in conflicts:
        loc = conf.get("location", "")
        wx = weather_map.get(loc, {})
        res = generate_resolution_options(conf, weather_info=wx)
        resolutions.append(res)

    return {
        "status": "SUCCESS",
        "conflicts_count": len(conflicts),
        "conflicts": conflicts,
        "resolutions": resolutions
    }

@app.post("/api/rules/what-if")
def run_what_if_simulation(payload: WhatIfRequest):
    """
    Simulates the cascading knock-on delay effect across downstream trains
    using the deterministic graph propagation model.
    """
    trains_dict = [t.model_dump(by_alias=True) for t in payload.trains]
    result = simulate_cascading_delay(
        target_train_number=payload.target_train_number,
        injected_delay_mins=payload.injected_delay_mins,
        all_trains=trains_dict,
        station_sequence=payload.corridor_stations
    )
    return result

@app.post("/api/rules/weather-restrictions")
def evaluate_weather(payload: WeatherEvalRequest):
    """
    Evaluates weather conditions against IR speed restriction rules.
    """
    result = evaluate_weather_speed_restriction(
        condition=payload.condition,
        visibility_m=payload.visibility_m,
        temp_c=payload.temp_c,
        normal_max_speed=payload.normal_max_speed
    )
    return {
        "station_code": payload.station_code,
        **result
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
