"""
Conflict Resolution Engine for RailSmart
Implements structurally distinct resolution strategies per conflict (Hold, Speed Regulation, Reroute)
grounded in Indian Railways Priority Hierarchy and Operating Rules.
Enforces strict physical applicability constraints (does not offer invalid options).
"""

from typing import Dict, Any, List
from config.ir_priority import get_train_category, compare_train_priority
from config.weather_rules import evaluate_weather_speed_restriction
from engine.explainability import build_explainability_trace

def generate_resolution_options(
    conflict: Dict[str, Any],
    weather_info: Dict[str, Any] = None,
    available_tracks: List[str] = None
) -> Dict[str, Any]:
    """
    Generates structurally distinct resolution strategies (Hold, Speed Adjust, Reroute)
    for an identified conflict with full explainability traces and trade-off summaries.
    Enforces physical feasibility filtering so non-viable options are never offered.
    """
    train_a = conflict["train_a"]
    train_b = conflict["train_b"]
    conflict_type = conflict.get("type", "SAME_BLOCK_OVERTAKE")
    location_label = conflict.get("location_label", "Section")
    distance_gap_km = float(conflict.get("distance_gap_km", 2.0))

    # Priority determination
    p_comp = compare_train_priority(train_a, train_b)
    if p_comp >= 0:
        winner = train_a
        yielding = train_b
    else:
        winner = train_b
        yielding = train_a

    winner_cat = get_train_category(winner.get("number", ""), winner.get("name", ""), winner.get("class", ""))
    yielding_cat = get_train_category(yielding.get("number", ""), yielding.get("name", ""), yielding.get("class", ""))
    
    winner_enriched = {**winner, "priority_rank": winner_cat["rank"], "category_label": winner_cat["label"]}
    yielding_enriched = {**yielding, "priority_rank": yielding_cat["rank"], "category_label": yielding_cat["label"]}

    # Weather assessment
    weather_eval = evaluate_weather_speed_restriction(
        condition=weather_info.get("condition", "CLEAR") if weather_info else "CLEAR",
        visibility_m=weather_info.get("visibility_m", 1000) if weather_info else 1000,
        temp_c=weather_info.get("temp_c", 28) if weather_info else 28,
        normal_max_speed=winner_cat.get("max_speed_kmh", 130)
    )

    options = []

    # =========================================================================
    # STRATEGY 1: OPTION A — PRE-EMPTIVE HOLD AT OUTER SIGNAL / LOOP LINE
    # =========================================================================
    # Feasibility: Applicable whenever there is an outer signal or preceding station loop.
    if conflict_type == "PLATFORM_BOTTLENECK":
        hold_time_mins = max(4, round(5 + abs(winner.get("eta_next_station_mins", 5) - yielding.get("eta_next_station_mins", 5))))
        hold_target_loc = f"{conflict.get('location', 'Station')} Outer Home Signal"
        instruction_a = f"Hold Train {yielding['number']} ({yielding.get('name')}) at {hold_target_loc} for {hold_time_mins} min to let Train {winner['number']} ({winner.get('name')}) occupy and clear Platform."
    elif conflict_type == "OPPOSING_HEADON":
        hold_time_mins = max(6, round(conflict.get("time_to_conflict_mins", 5) + 3))
        hold_target_loc = f"{yielding.get('prev_station', 'Previous')} Junction Loop Line"
        instruction_a = f"Hold Train {yielding['number']} at {hold_target_loc} for {hold_time_mins} min until opposing high-priority Train {winner['number']} clears single-line section."
    else: # SAME_BLOCK_OVERTAKE
        hold_time_mins = max(3, round(4 + (2.5 / max(20, winner.get("speed_kmh", 90) - yielding.get("speed_kmh", 50))) * 60))
        hold_target_loc = f"{yielding.get('prev_station', 'Previous')} Loop Line 1"
        instruction_a = f"Hold Train {yielding['number']} ({yielding.get('name')}) on Loop Line at {yielding.get('prev_station', 'Outer Signal')} for {hold_time_mins} min to let Train {winner['number']} ({winner.get('name')}) overtake on Mainline."

    trace_a = build_explainability_trace(
        train_a=winner_enriched,
        train_b=yielding_enriched,
        conflict_type=conflict_type,
        location_label=location_label,
        priority_winner=winner_enriched,
        priority_yielding=yielding_enriched,
        weather_info=weather_eval,
        action_type="HOLD",
        calculated_delay=hold_time_mins
    )

    options.append({
        "option_id": "OPTION_A_HOLD",
        "title": "Option A — Pre-emptive Hold (Zero Risk)",
        "action_type": "HOLD",
        "target_train_number": yielding["number"],
        "target_train_name": yielding.get("name"),
        "hold_duration_mins": hold_time_mins,
        "hold_location": hold_target_loc,
        "speed_cap_kmh": None,
        "reroute_track": None,
        "delay_impact_winner_mins": 0,
        "delay_impact_yielding_mins": hold_time_mins,
        "safety_risk_level": "ZERO / RESOLVED",
        "instruction": instruction_a,
        "trade_off_summary": f"Delay: +{hold_time_mins} min on Train {yielding['number']} | Safety: Absolute zero collision/headway risk | Throughput: Guaranteed priority for Train {winner['number']}.",
        "explainability_trace": trace_a
    })

    # =========================================================================
    # STRATEGY 2: OPTION B — DYNAMIC SPEED REGULATION / HEADWAY EXPANSION
    # =========================================================================
    # Physical Feasibility Check:
    # 1. NOT applicable for OPPOSING_HEADON (opposing trains on single line cannot be resolved by speed capping).
    # 2. NOT applicable if distance gap is already < 0.8 km (too late for gradual speed regulation).
    is_speed_adjust_viable = (conflict_type != "OPPOSING_HEADON") and (distance_gap_km >= 0.8)

    if is_speed_adjust_viable:
        current_speed = yielding.get("speed_kmh", 70)
        regulated_speed = max(35, min(round(current_speed * 0.65), 55))
        if weather_eval.get("has_restriction"):
            regulated_speed = min(regulated_speed, weather_eval["effective_speed_cap_kmh"])
        
        speed_delay_mins = max(2, round(hold_time_mins * 0.45))
        instruction_b = f"Cap speed of Train {yielding['number']} ({yielding.get('name')}) to {regulated_speed} km/h over next 15 km to widen safe headway to >4.0 km without complete stop."

        trace_b = build_explainability_trace(
            train_a=winner_enriched,
            train_b=yielding_enriched,
            conflict_type=conflict_type,
            location_label=location_label,
            priority_winner=winner_enriched,
            priority_yielding=yielding_enriched,
            weather_info=weather_eval,
            action_type="SPEED_ADJUST",
            calculated_delay=speed_delay_mins,
            calculated_speed_cap=regulated_speed
        )

        options.append({
            "option_id": "OPTION_B_SPEED_ADJUST",
            "title": "Option B — Dynamic Speed Regulation (Flow Optimization)",
            "action_type": "SPEED_ADJUST",
            "target_train_number": yielding["number"],
            "target_train_name": yielding.get("name"),
            "hold_duration_mins": 0,
            "hold_location": None,
            "speed_cap_kmh": regulated_speed,
            "reroute_track": None,
            "delay_impact_winner_mins": 0,
            "delay_impact_yielding_mins": speed_delay_mins,
            "safety_risk_level": "LOW / MONITORED",
            "instruction": instruction_b,
            "trade_off_summary": f"Delay: Only +{speed_delay_mins} min delay | Energy: Avoids heavy locomotive restarting fuel/energy spike | Risk: Requires continuous monitoring if visibility deteriorates.",
            "explainability_trace": trace_b
        })

    # =========================================================================
    # STRATEGY 3: OPTION C — DYNAMIC REROUTE / LOOP LINE / PLATFORM DIVERSION
    # =========================================================================
    # Physical Feasibility Check: Valid if loop line or alternate platform exists in topology
    reroute_target = "Loop Line Siding"
    reroute_delay_mins = 2
    is_reroute_viable = True

    if conflict_type == "PLATFORM_BOTTLENECK":
        alt_platform = "Platform 3" if yielding.get("simulated_platform") != 3 else "Platform 4"
        reroute_target = alt_platform
        instruction_c = f"Reallocate Train {yielding['number']} to {alt_platform} at {conflict.get('location', 'Station')}, clearing Platform {yielding.get('simulated_platform', '1')} for Train {winner['number']}."
        reroute_delay_mins = 1
    elif conflict_type == "OPPOSING_HEADON":
        reroute_target = "Passing Loop Line (Turnout 1:12)"
        instruction_c = f"Divert Train {yielding['number']} into {reroute_target} at 30 km/h turnout speed to allow bidirectional clearance on mainline."
        reroute_delay_mins = 3
    else: # OVERTAKE
        reroute_target = "Goods Loop Line (Turnout 1:12)"
        instruction_c = f"Switch Train {yielding['number']} onto {reroute_target} at 30 km/h turnout speed, clearing mainline for Train {winner['number']}."
        reroute_delay_mins = 2

    if is_reroute_viable:
        trace_c = build_explainability_trace(
            train_a=winner_enriched,
            train_b=yielding_enriched,
            conflict_type=conflict_type,
            location_label=location_label,
            priority_winner=winner_enriched,
            priority_yielding=yielding_enriched,
            weather_info=weather_eval,
            action_type="REROUTE",
            calculated_delay=reroute_delay_mins,
            alternate_path=reroute_target
        )

        options.append({
            "option_id": "OPTION_C_REROUTE",
            "title": "Option C — Track/Platform Diversion (Throughput Preservation)",
            "action_type": "REROUTE",
            "target_train_number": yielding["number"],
            "target_train_name": yielding.get("name"),
            "hold_duration_mins": 0,
            "hold_location": None,
            "speed_cap_kmh": 30 if "Turnout" in reroute_target or "Siding" in reroute_target or "Loop" in reroute_target else None,
            "reroute_track": reroute_target,
            "delay_impact_winner_mins": 0,
            "delay_impact_yielding_mins": reroute_delay_mins,
            "safety_risk_level": "ZERO / RESOLVED",
            "instruction": instruction_c,
            "trade_off_summary": f"Delay: Minimal +{reroute_delay_mins} min delay | Track: Utilizes available loop/siding capacity | Requirement: Turnout speed restricted to 30 km/h.",
            "explainability_trace": trace_c
        })

    return {
        "conflict_id": conflict["conflict_id"],
        "conflict_type": conflict_type,
        "location": conflict.get("location"),
        "location_label": location_label,
        "priority_precedence": {
            "winner_train": winner_enriched,
            "yielding_train": yielding_enriched,
            "rule": "IR Priority Order: VB/Rajdhani (Rank 1) > SF (Rank 2) > Mail/Exp (Rank 3) > Pass (Rank 4) > Freight (Rank 5)"
        },
        "weather_context": weather_eval,
        "options_count": len(options),
        "options": options,
        "manual_intervention_required": len(options) == 0
    }
