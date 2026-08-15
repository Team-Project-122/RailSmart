"""
Cascading Delay Propagation Simulator (What-If Engine)
Deterministic graph propagation model to evaluate downstream knock-on delays
when a train is held, delayed, or rerouted in the network.
Explicitly labeled as a heuristic graph propagation simulation, NOT black-box ML.
"""

from typing import Dict, Any, List
from config.ir_priority import get_train_category, compare_train_priority, PLATFORM_OCCUPANCY_BUFFER_MIN, BLOCK_CLEARANCE_BUFFER_MIN

def simulate_cascading_delay(
    target_train_number: str,
    injected_delay_mins: int,
    all_trains: List[Dict[str, Any]],
    station_sequence: List[str] = None
) -> Dict[str, Any]:
    """
    Propagates delay from a target train across downstream trains sharing blocks and stations.
    Returns:
      - direct_impact: target train delay stats
      - cascading_impacts: list of secondary and tertiary affected trains
      - total_network_delay_added: sum of all additional delays
      - propagation_tree: structured graph nodes for visualization
    """
    if not station_sequence:
        station_sequence = ["NDLS", "GZB", "ALJN", "TDL", "CNB", "PRYJ", "DDU", "PNBE", "HWH"]

    # Locate target train
    target_train = next((t for t in all_trains if str(t.get("number")) == str(target_train_number)), None)
    if not target_train:
        return {
            "status": "ERROR",
            "message": f"Train {target_train_number} not found in active train registry."
        }

    target_cat = get_train_category(target_train.get("number", ""), target_train.get("name", ""), target_train.get("class", ""))
    target_dir = target_train.get("direction", "DN") # DN: NDLS->HWH, UP: HWH->NDLS
    
    # Calculate downstream stations for target train
    curr_stn = target_train.get("current_station") or target_train.get("prev_station") or "NDLS"
    try:
        curr_idx = station_sequence.index(curr_stn)
        if target_dir == "DN":
            downstream_stns = station_sequence[curr_idx:]
        else:
            downstream_stns = station_sequence[:curr_idx + 1][::-1]
    except ValueError:
        downstream_stns = station_sequence

    propagated_trains = []
    total_cascading_delay = 0

    # Propagation tree nodes
    tree_nodes = [{
        "id": f"root-{target_train['number']}",
        "train_number": target_train["number"],
        "train_name": target_train.get("name"),
        "role": "PRIMARY_SOURCE",
        "injected_delay_mins": injected_delay_mins,
        "new_projected_delay_mins": (target_train.get("live_delay_minutes", 0) + injected_delay_mins),
        "reason": "Direct operator what-if injection / selected resolution hold",
        "affected_sections": downstream_stns[:3]
    }]

    # Scan all other trains for shared block/platform occupancy conflicts
    for other_train in all_trains:
        if str(other_train.get("number")) == str(target_train_number):
            continue

        other_cat = get_train_category(other_train.get("number", ""), other_train.get("name", ""), other_train.get("class", ""))
        other_dir = other_train.get("direction", "DN")
        other_curr_stn = other_train.get("current_station") or other_train.get("prev_station") or "NDLS"

        # Check for spatial overlap in downstream corridors
        is_same_direction = (target_dir == other_dir)
        shared_stations = [s for s in downstream_stns if s in (other_train.get("scheduled_stops") or station_sequence)]

        if not shared_stations:
            continue

        # Propagation Rule 1: Trailing train behind delayed target in same direction (Block Occupancy Congestion)
        if is_same_direction:
            # If other train is following closely behind
            priority_comparison = compare_train_priority(target_train, other_train)
            
            # Delay propagation attenuation factor (delay diminishes slightly over long distance buffer)
            attenuation = 0.75 if priority_comparison >= 0 else 0.40
            knock_on_delay = max(0, round(injected_delay_mins * attenuation))
            
            if knock_on_delay > 1:
                total_cascading_delay += knock_on_delay
                impact_record = {
                    "train_number": other_train["number"],
                    "train_name": other_train.get("name"),
                    "train_class": other_cat["label"],
                    "priority_rank": other_cat["rank"],
                    "original_delay_mins": other_train.get("live_delay_minutes", 0),
                    "knock_on_delay_mins": knock_on_delay,
                    "new_projected_delay_mins": other_train.get("live_delay_minutes", 0) + knock_on_delay,
                    "impact_type": "BLOCK_CONGESTION_TRAILING",
                    "conflict_point": shared_stations[0] if shared_stations else "Block Section",
                    "propagation_reason": f"Trailing behind delayed Train {target_train_number} along shared block section {shared_stations[0] if shared_stations else 'Corridor'}."
                }
                propagated_trains.append(impact_record)
                
                tree_nodes.append({
                    "id": f"node-{other_train['number']}",
                    "train_number": other_train["number"],
                    "train_name": other_train.get("name"),
                    "role": "CASCADING_VICTIM",
                    "injected_delay_mins": knock_on_delay,
                    "new_projected_delay_mins": other_train.get("live_delay_minutes", 0) + knock_on_delay,
                    "reason": impact_record["propagation_reason"],
                    "parent_id": f"root-{target_train['number']}"
                })

        # Propagation Rule 2: Single line block opposing traffic
        elif not is_same_direction and any(s in ["ALJN", "TDL", "CNB"] for s in shared_stations):
            # Opposing train waiting for single line clearance
            knock_on_delay = max(0, round(injected_delay_mins * 0.60))
            if knock_on_delay > 1:
                total_cascading_delay += knock_on_delay
                impact_record = {
                    "train_number": other_train["number"],
                    "train_name": other_train.get("name"),
                    "train_class": other_cat["label"],
                    "priority_rank": other_cat["rank"],
                    "original_delay_mins": other_train.get("live_delay_minutes", 0),
                    "knock_on_delay_mins": knock_on_delay,
                    "new_projected_delay_mins": other_train.get("live_delay_minutes", 0) + knock_on_delay,
                    "impact_type": "OPPOSING_LINE_CLEARANCE",
                    "conflict_point": shared_stations[0] if shared_stations else "Junction",
                    "propagation_reason": f"Held at {shared_stations[0] if shared_stations else 'Junction'} awaiting single-line block clearance from delayed Train {target_train_number}."
                }
                propagated_trains.append(impact_record)
                
                tree_nodes.append({
                    "id": f"node-{other_train['number']}",
                    "train_number": other_train["number"],
                    "train_name": other_train.get("name"),
                    "role": "CASCADING_VICTIM",
                    "injected_delay_mins": knock_on_delay,
                    "new_projected_delay_mins": other_train.get("live_delay_minutes", 0) + knock_on_delay,
                    "reason": impact_record["propagation_reason"],
                    "parent_id": f"root-{target_train['number']}"
                })

    return {
        "status": "SUCCESS",
        "simulation_type": "DETERMINISTIC_GRAPH_PROPAGATION (SIMULATED)",
        "target_train": {
            "train_number": target_train["number"],
            "train_name": target_train.get("name"),
            "train_class": target_cat["label"],
            "injected_delay_mins": injected_delay_mins,
            "original_delay_mins": target_train.get("live_delay_minutes", 0),
            "projected_total_delay_mins": target_train.get("live_delay_minutes", 0) + injected_delay_mins
        },
        "network_impact_summary": {
            "direct_delay_mins": injected_delay_mins,
            "cascading_delay_added_mins": total_cascading_delay,
            "net_total_network_delay_mins": injected_delay_mins + total_cascading_delay,
            "affected_trains_count": len(propagated_trains) + 1,
            "system_stability_index": max(10, 100 - (injected_delay_mins * 2 + total_cascading_delay * 3))
        },
        "cascading_trains": propagated_trains,
        "propagation_tree": tree_nodes
    }
