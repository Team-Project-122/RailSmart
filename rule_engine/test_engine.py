"""
Unit & Integration Tests for RailSmart Python Rule Engine
Validates IR Priority hierarchy, 3 distinct conflict resolution options,
explainability traces, weather speed caps, cascading delay propagation,
physical feasibility filtering, and loop line physical separation.
"""

from config.ir_priority import get_train_category, compare_train_priority
from config.weather_rules import evaluate_weather_speed_restriction
from engine.conflict_detector import detect_conflicts
from engine.resolution_engine import generate_resolution_options
from engine.cascading_simulator import simulate_cascading_delay

def test_priority_hierarchy():
    print("Testing Train Priority Hierarchy...")
    t_vb = {"number": "22436", "name": "Vande Bharat Express", "class": "VANDE_BHARAT"}
    t_freight = {"number": "BCN-101", "name": "Goods Container Rake", "class": "FREIGHT"}
    t_sf = {"number": "12560", "name": "Shiv Ganga SF Express", "class": "SUPERFAST"}
    
    assert compare_train_priority(t_vb, t_freight) == 1, "Vande Bharat must take precedence over Freight"
    assert compare_train_priority(t_sf, t_vb) == -1, "Superfast must yield to Vande Bharat"
    assert compare_train_priority(t_sf, t_freight) == 1, "Superfast must take precedence over Freight"
    print("✓ Priority hierarchy tests passed!")

def test_weather_speed_restrictions():
    print("Testing Weather-Driven Speed Rules...")
    # Severe Fog (< 200m)
    res_fog = evaluate_weather_speed_restriction("FOG", visibility_m=180, temp_c=12, normal_max_speed=130)
    assert res_fog["has_restriction"] is True
    assert res_fog["effective_speed_cap_kmh"] == 60, f"Expected 60 km/h for dense fog, got {res_fog['effective_speed_cap_kmh']}"
    
    # Moderate Fog (350m)
    res_mod_fog = evaluate_weather_speed_restriction("MIST", visibility_m=350, temp_c=14, normal_max_speed=130)
    assert res_mod_fog["effective_speed_cap_kmh"] == 75, f"Expected 75 km/h, got {res_mod_fog['effective_speed_cap_kmh']}"
    
    # Extreme Heat (48°C)
    res_heat = evaluate_weather_speed_restriction("CLEAR", visibility_m=5000, temp_c=48, normal_max_speed=100)
    assert res_heat["has_restriction"] is True
    assert res_heat["effective_speed_cap_kmh"] == 85, f"Expected 85 km/h, got {res_heat['effective_speed_cap_kmh']}"
    print("✓ Weather speed restriction rules passed!")

def test_conflict_detection_and_resolution():
    print("Testing Conflict Detection and 3-Way Alternate Strategies...")
    t1 = {
        "number": "22436",
        "name": "Vande Bharat Express",
        "class": "VANDE_BHARAT",
        "current_block_id": "CNB-PRYJ",
        "prev_station": "CNB",
        "next_station": "PRYJ",
        "direction": "DN",
        "speed_kmh": 120,
        "block_progress": 0.45,
        "block_length_km": 30.0,
        "live_delay_minutes": 2
    }
    t2 = {
        "number": "BCN-504",
        "name": "Coal Freight Rake",
        "class": "FREIGHT",
        "current_block_id": "CNB-PRYJ",
        "prev_station": "CNB",
        "next_station": "PRYJ",
        "direction": "DN",
        "speed_kmh": 55,
        "block_progress": 0.49,
        "block_length_km": 30.0,
        "live_delay_minutes": 15
    }

    conflicts = detect_conflicts([t1, t2])
    assert len(conflicts) > 0, "Conflict must be detected for trailing overtake in same block"
    print(f"  Detected conflict: {conflicts[0]['description']}")

    # Generate resolution options
    res = generate_resolution_options(conflicts[0], weather_info={"condition": "FOG", "visibility_m": 190, "temp_c": 14})
    assert len(res["options"]) == 3, "Must generate 3 structurally different resolution strategies for standard overtake"
    
    opt_a = res["options"][0] # Hold
    opt_b = res["options"][1] # Speed Adjust
    opt_c = res["options"][2] # Reroute

    assert opt_a["action_type"] == "HOLD"
    assert opt_b["action_type"] == "SPEED_ADJUST"
    assert opt_c["action_type"] == "REROUTE"

    assert opt_a["explainability_trace"]["step_count"] >= 3, "Option A must have a multi-step explainability trace"
    assert opt_b["speed_cap_kmh"] is not None, "Option B must specify a speed cap"
    assert opt_c["reroute_track"] is not None, "Option C must specify an alternate track"
    
    print("✓ 3-Way alternate strategy generation & explainability traces verified!")

def test_physical_feasibility_filtering():
    print("Testing Physical Feasibility Filtering (Head-On & Loop Separation)...")
    
    # 1. Head-On Single Line Conflict
    t_headon_a = {
        "number": "22436",
        "name": "Vande Bharat",
        "class": "VANDE_BHARAT",
        "current_block_id": "BLK-ALJN-TDL",
        "direction": "DN",
        "speed_kmh": 100,
        "block_progress": 0.35,
        "is_single_line": True
    }
    t_headon_b = {
        "number": "BOXN-912",
        "name": "Freight",
        "class": "FREIGHT",
        "current_block_id": "BLK-ALJN-TDL",
        "direction": "UP",
        "speed_kmh": 50,
        "block_progress": 0.65,
        "is_single_line": True
    }

    conflicts = detect_conflicts([t_headon_a, t_headon_b])
    assert len(conflicts) == 1
    assert conflicts[0]["type"] == "OPPOSING_HEADON"

    res = generate_resolution_options(conflicts[0])
    action_types = [opt["action_type"] for opt in res["options"]]
    
    assert "SPEED_ADJUST" not in action_types, "Speed adjust MUST NOT be offered for opposing head-on conflicts!"
    assert "HOLD" in action_types, "Hold must be offered for head-on"
    assert "REROUTE" in action_types, "Reroute to siding must be offered for head-on"
    assert len(res["options"]) == 2, f"Expected exactly 2 feasible options for head-on, got {len(res['options'])}"
    print("✓ Head-On physical feasibility check passed: SPEED_ADJUST correctly omitted!")

    # 2. Loop Siding Separation
    t_main = {
        "number": "22436",
        "name": "Vande Bharat",
        "class": "VANDE_BHARAT",
        "current_block_id": "BLK-CNB-PRYJ",
        "direction": "DN",
        "block_progress": 0.45
    }
    t_loop = {
        "number": "BCN-489",
        "name": "Freight on Loop",
        "class": "FREIGHT",
        "current_block_id": "BLK-CNB-PRYJ-LOOP",
        "direction": "DN",
        "block_progress": 0.45
    }

    conflicts_loop = detect_conflicts([t_main, t_loop])
    assert len(conflicts_loop) == 0, "No conflict should be detected when one train is physically on the loop track!"
    print("✓ Loop line physical separation check passed: No conflict detected between main and loop!")

def test_cascading_simulator():
    print("Testing Cascading Delay Simulator (What-If)...")
    trains = [
        {"number": "12302", "name": "Howrah Rajdhani", "class": "RAJDHANI_SHATABDI", "current_station": "CNB", "direction": "DN", "live_delay_minutes": 0},
        {"number": "12802", "name": "Purushottam Express", "class": "SUPERFAST", "current_station": "CNB", "direction": "DN", "live_delay_minutes": 5},
        {"number": "14218", "name": "Unchahar Express", "class": "MAIL_EXPRESS", "current_station": "ALJN", "direction": "DN", "live_delay_minutes": 10},
        {"number": "12423", "name": "Dibrugarh Rajdhani", "class": "RAJDHANI_SHATABDI", "current_station": "PRYJ", "direction": "UP", "live_delay_minutes": 0}
    ]

    result = simulate_cascading_delay("12302", injected_delay_mins=15, all_trains=trains)
    assert result["status"] == "SUCCESS"
    assert result["network_impact_summary"]["direct_delay_mins"] == 15
    assert result["network_impact_summary"]["affected_trains_count"] >= 2
    assert len(result["propagation_tree"]) >= 2
    print("✓ Cascading delay simulation verified!")

if __name__ == "__main__":
    test_priority_hierarchy()
    test_weather_speed_restrictions()
    test_conflict_detection_and_resolution()
    test_physical_feasibility_filtering()
    test_cascading_simulator()
    print("\nALL PYTHON RULE ENGINE TESTS (INCLUDING PHYSICAL FEASIBILITY) PASSED!")
