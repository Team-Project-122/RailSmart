"""
Conflict Detection Engine for RailSmart
Evaluates live/simulated train positions, projected block traversals, and station platform arrivals
to identify track conflicts, headway violations, and platform bottlenecks.
"""

from typing import List, Dict, Any
from config.ir_priority import get_train_category, compare_train_priority, SAFETY_HEADWAY_KM, PLATFORM_OCCUPANCY_BUFFER_MIN

def detect_conflicts(trains: List[Dict[str, Any]], block_sections: List[Dict[str, Any]] = None, platforms: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Scans active trains and identifies spatial-temporal conflicts.
    Takes into account loop/siding physical separation.
    """
    conflicts = []
    num_trains = len(trains)

    # 1. Block Section & Same-Track Headway Conflicts
    for i in range(num_trains):
        for j in range(i + 1, num_trains):
            t_a = trains[i]
            t_b = trains[j]

            block_a = t_a.get("current_block_id") or f"{t_a.get('prev_station', '')}-{t_a.get('next_station', '')}"
            block_b = t_b.get("current_block_id") or f"{t_b.get('prev_station', '')}-{t_b.get('next_station', '')}"
            
            # If either train is diverted to a loop line (ends with -LOOP), they are on physically separate tracks!
            if block_a.endswith("-LOOP") or block_b.endswith("-LOOP"):
                # If one is on loop and one on mainline, no collision conflict exists on that block!
                if block_a != block_b:
                    continue

            # Check for identical block section occupancy
            if block_a and block_b and block_a == block_b:
                prog_a = float(t_a.get("block_progress", 0.5))
                prog_b = float(t_b.get("block_progress", 0.5))
                dir_a = t_a.get("direction", "UP")
                dir_b = t_b.get("direction", "UP")
                
                block_len = float(t_a.get("block_length_km", 25.0))
                dist_diff_km = abs(prog_a - prog_b) * block_len

                # Check if single line opposing conflict (Head-on)
                is_single_line = bool(t_a.get("is_single_line", False))
                if (is_single_line or "SINGLE" in block_a.upper()) and dir_a != dir_b:
                    conflicts.append({
                        "conflict_id": f"CONF-HEADON-{t_a['number']}-{t_b['number']}",
                        "type": "OPPOSING_HEADON",
                        "severity": "CRITICAL",
                        "train_a": t_a,
                        "train_b": t_b,
                        "location": block_a,
                        "location_label": f"Single Line Section {block_a}",
                        "distance_gap_km": round(dist_diff_km, 2),
                        "time_to_conflict_mins": max(1, round(dist_diff_km / max(20, (t_a.get('speed_kmh', 60) + t_b.get('speed_kmh', 60)) / 2) * 60)),
                        "description": f"Critical Opposing Traffic: Train {t_a['number']} ({t_a.get('name')}) and Train {t_b['number']} ({t_b.get('name')}) entering single line block {block_a} from opposite directions."
                    })
                # Same direction overtake / headway compression
                elif dir_a == dir_b:
                    if dist_diff_km < SAFETY_HEADWAY_KM or (prog_b < prog_a and t_b.get("speed_kmh", 80) > t_a.get("speed_kmh", 60) and dist_diff_km < 8.0) or (prog_a < prog_b and t_a.get("speed_kmh", 80) > t_b.get("speed_kmh", 60) and dist_diff_km < 8.0):
                        speed_diff = abs(float(t_a.get("speed_kmh", 70)) - float(t_b.get("speed_kmh", 70)))
                        lead_train = t_a if prog_a > prog_b else t_b
                        trail_train = t_b if prog_a > prog_b else t_a
                        
                        conflicts.append({
                            "conflict_id": f"CONF-OVERTAKE-{t_a['number']}-{t_b['number']}",
                            "type": "SAME_BLOCK_OVERTAKE",
                            "severity": "HIGH" if dist_diff_km < 3.0 else "MEDIUM",
                            "train_a": lead_train,
                            "train_b": trail_train,
                            "location": block_a,
                            "location_label": f"Block Section {block_a} ({lead_train.get('prev_station', '')} → {lead_train.get('next_station', '')})",
                            "distance_gap_km": round(dist_diff_km, 2),
                            "time_to_conflict_mins": max(2, round(dist_diff_km / max(10, speed_diff or 20) * 60)) if speed_diff > 0 else 5,
                            "description": f"Overtake / Headway Compression: Faster train {trail_train['number']} ({trail_train.get('name')}) catching up to {lead_train['number']} ({lead_train.get('name')}) with {round(dist_diff_km, 1)} km gap."
                        })

            # 2. Station Platform / Arrival Convergence Conflicts
            next_stn_a = t_a.get("next_station")
            next_stn_b = t_b.get("next_station")
            if next_stn_a and next_stn_b and next_stn_a == next_stn_b:
                eta_a = float(t_a.get("eta_next_station_mins", 10))
                eta_b = float(t_b.get("eta_next_station_mins", 12))
                plat_a = t_a.get("simulated_platform")
                plat_b = t_b.get("simulated_platform")

                time_diff = abs(eta_a - eta_b)
                if (plat_a and plat_b and plat_a == plat_b and time_diff < PLATFORM_OCCUPANCY_BUFFER_MIN) or (time_diff < 3.0 and not plat_a):
                    conflicts.append({
                        "conflict_id": f"CONF-PLAT-{t_a['number']}-{t_b['number']}-{next_stn_a}",
                        "type": "PLATFORM_BOTTLENECK",
                        "severity": "HIGH" if time_diff < 2.0 else "MEDIUM",
                        "train_a": t_a,
                        "train_b": t_b,
                        "location": next_stn_a,
                        "location_label": f"Station {next_stn_a} (Platform {plat_a or '1'})",
                        "distance_gap_km": round(abs(float(t_a.get("distance_to_next_km", 10)) - float(t_b.get("distance_to_next_km", 12))), 2),
                        "time_to_conflict_mins": round(min(eta_a, eta_b), 1),
                        "description": f"Platform Bottleneck at {next_stn_a}: Both Train {t_a['number']} and Train {t_b['number']} scheduled for arrival within {round(time_diff, 1)} min window."
                    })

    return conflicts
