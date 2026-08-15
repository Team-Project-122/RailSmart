"""
Indian Railways Weather-Driven Speed Restriction Rules
Explicit, configurable threshold tables simulating IR Safety Operating circulars:
- Fog / Visibility Thresholds (Fog Pass Device & Maximum Visibility Speed Limits)
- Heavy Rain & Cyclone alerts
- Extreme Summer Temperatures (Rail Expansion caution)
"""

WEATHER_SPEED_RULES = [
    {
        "id": "WEATHER_FOG_SEVERE",
        "condition_name": "Dense Fog / Low Visibility (<200m)",
        "condition_match": lambda cond, vis, temp: vis is not None and vis < 200,
        "speed_cap_kmh": 60,
        "speed_cap_factor": None,
        "severity": "HIGH",
        "reason": "IR Safety Circular: Severe fog restriction. Absolute maximum 60 km/h permitted with fog safety detonator / FOGSAFE device active."
    },
    {
        "id": "WEATHER_FOG_MODERATE",
        "condition_name": "Moderate Fog / Mist (<500m)",
        "condition_match": lambda cond, vis, temp: vis is not None and 200 <= vis < 500,
        "speed_cap_kmh": 75,
        "speed_cap_factor": None,
        "severity": "MEDIUM",
        "reason": "IR Safety Circular: Moderate fog/mist restriction. Speed capped at 75 km/h to maintain safe braking distance."
    },
    {
        "id": "WEATHER_HEAVY_PRECIPITATION",
        "condition_name": "Heavy Rain / Thunderstorm",
        "condition_match": lambda cond, vis, temp: (cond or "").upper() in ["RAIN", "THUNDERSTORM", "TORNADO", "HEAVY_RAIN"],
        "speed_cap_kmh": None,
        "speed_cap_factor": 0.80, # 80% of sectional/scheduled speed
        "severity": "MEDIUM",
        "reason": "IR Safety Protocol: Reduced track adhesion & wiper clearing constraints. Speed capped to 80% of sectional maximum."
    },
    {
        "id": "WEATHER_EXTREME_HEAT",
        "condition_name": "Extreme Heat / Rail Expansion (>45°C)",
        "condition_match": lambda cond, vis, temp: temp is not None and temp > 45.0,
        "speed_cap_kmh": None,
        "speed_cap_factor": 0.85, # 85% of normal speed
        "severity": "LOW",
        "reason": "IR Permanent Way Rule: High ambient temperature (>45°C) increases rail buckling risk on continuous welded rails (CWR). Speed capped to 85%."
    }
]

def evaluate_weather_speed_restriction(condition: str, visibility_m: float, temp_c: float, normal_max_speed: float = 130) -> dict:
    """
    Evaluates weather conditions and returns applicable speed caps and explainability traces.
    """
    applicable_restrictions = []
    effective_speed_cap = normal_max_speed
    active_severity = "NONE"
    
    for rule in WEATHER_SPEED_RULES:
        try:
            if rule["condition_match"](condition, visibility_m, temp_c):
                cap = rule["speed_cap_kmh"]
                if cap is None and rule["speed_cap_factor"] is not None:
                    cap = round(normal_max_speed * rule["speed_cap_factor"])
                    
                applicable_restrictions.append({
                    "rule_id": rule["id"],
                    "condition_name": rule["condition_name"],
                    "cap_kmh": cap,
                    "reason": rule["reason"],
                    "severity": rule["severity"]
                })
                
                if cap < effective_speed_cap:
                    effective_speed_cap = cap
                    active_severity = rule["severity"]
        except Exception:
            continue
            
    has_restriction = len(applicable_restrictions) > 0
    return {
        "has_restriction": has_restriction,
        "effective_speed_cap_kmh": effective_speed_cap if has_restriction else normal_max_speed,
        "active_severity": active_severity if has_restriction else "CLEAR",
        "restrictions": applicable_restrictions,
        "summary": " | ".join([r["condition_name"] for r in applicable_restrictions]) if applicable_restrictions else "Clear weather, standard track speed allowed"
    }
