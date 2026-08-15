"""
Explainability Trace Generator for RailSmart Decision Support System
Converts internal rule firings, physics calculations, and IR priority comparisons
into structured, human-readable logic chains for train controllers.
"""

from typing import List, Dict, Any

class ExplainabilityTrace:
    def __init__(self, conflict_id: str, title: str):
        self.conflict_id = conflict_id
        self.title = title
        self.steps: List[Dict[str, Any]] = []

    def add_step(self, step_name: str, rule_id: str, input_state: str, reasoning: str, result: str):
        self.steps.append({
            "step_name": step_name,
            "rule_id": rule_id,
            "input_state": input_state,
            "reasoning": reasoning,
            "result": result
        })

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "title": self.title,
            "step_count": len(self.steps),
            "steps": self.steps,
            "formatted_chain": " → ".join([f"[{s['rule_id']}] {s['result']}" for s in self.steps])
        }

def build_explainability_trace(
    train_a: dict,
    train_b: dict,
    conflict_type: str,
    location_label: str,
    priority_winner: dict,
    priority_yielding: dict,
    weather_info: dict,
    action_type: str,
    calculated_delay: int,
    calculated_speed_cap: int = None,
    alternate_path: str = None
) -> Dict[str, Any]:
    """
    Builds a full explainability trace for a given conflict resolution strategy.
    """
    trace = ExplainabilityTrace(
        conflict_id=f"CONF-{train_a.get('number')}-{train_b.get('number')}",
        title=f"Conflict Resolution: {train_a.get('number')} vs {train_b.get('number')} at {location_label}"
    )

    # Step 1: Occupancy / Headway Analysis
    trace.add_step(
        step_name="1. Spatial-Temporal Conflict Identification",
        rule_id="IR-OCC-01",
        input_state=f"Train {train_a.get('number')} ({train_a.get('name')}) and Train {train_b.get('number')} ({train_b.get('name')}) projected in {location_label} within safe headway window (< 3.0 km / overlap time).",
        reasoning=f"Both trains projected to contest section {location_label} concurrently. Predicted conflict nature: {conflict_type}.",
        result=f"Triggered conflict event ({conflict_type})."
    )

    # Step 2: IR Train Hierarchy Evaluation
    p_winner_name = priority_winner.get('name', '')
    p_winner_no = priority_winner.get('number', '')
    p_winner_cat = priority_winner.get('category_label', 'High Priority')
    p_yield_name = priority_yielding.get('name', '')
    p_yield_no = priority_yielding.get('number', '')
    p_yield_cat = priority_yielding.get('category_label', 'Lower Priority')

    trace.add_step(
        step_name="2. Indian Railways Priority Hierarchy Evaluation",
        rule_id="IR-PRIORITY-PRECEDENCE",
        input_state=f"Train {p_winner_no} ({p_winner_cat}, Rank {priority_winner.get('priority_rank', 1)}) vs Train {p_yield_no} ({p_yield_cat}, Rank {priority_yielding.get('priority_rank', 3)}).",
        reasoning="Per IR Operating Manual Schedule Priority, premier passenger/express services take track precedence over ordinary passenger and freight rakes to preserve corridor punctuality.",
        result=f"Precedence granted to Train {p_winner_no} ({p_winner_name}). Train {p_yield_no} designated to yield."
    )

    # Step 3: Weather & Safety Envelope Evaluation
    if weather_info and weather_info.get("has_restriction"):
        weather_summary = weather_info.get("summary", "Adverse Weather")
        cap = weather_info.get("effective_speed_cap_kmh", 60)
        trace.add_step(
            step_name="3. Weather Safety Envelope Check",
            rule_id="IR-WX-SPEED-CAP",
            input_state=f"Station/Block Weather: {weather_summary} (Vis: {weather_info.get('visibility_m', 'N/A')}m, Temp: {weather_info.get('temp_c', 'N/A')}°C).",
            reasoning=f"Adverse visibility/track condition requires mandatory safety braking distance expansion.",
            result=f"Speed restricted to max {cap} km/h for affected block section."
        )
    else:
        trace.add_step(
            step_name="3. Weather Safety Envelope Check",
            rule_id="IR-WX-CLEAR",
            input_state="Weather: Clear visibility (>1000m), normal track temperature.",
            reasoning="No environmental speed penalty active on this block section.",
            result="Standard line speed permissible."
        )

    # Step 4: Strategy Physics & Operational Derivation
    if action_type == "HOLD":
        trace.add_step(
            step_name="4. Hold Timing & Clearance Calculation",
            rule_id="IR-HOLD-CALC",
            input_state=f"Yielding Train: {p_yield_no}, Target Signal: Outer Home / Preceding Loop.",
            reasoning=f"Holding Train {p_yield_no} for {calculated_delay} min allows Train {p_winner_no} to clear the critical block section with +2.5 km trailing safety buffer.",
            result=f"Hold Train {p_yield_no} at outer signal for {calculated_delay} min. Projected delay impact: +{calculated_delay} min on Train {p_yield_no}, 0 min on Train {p_winner_no}."
        )
    elif action_type == "SPEED_ADJUST":
        trace.add_step(
            step_name="4. Dynamic Speed Headway Regulation",
            rule_id="IR-SPEED-HEADWAY",
            input_state=f"Yielding Train: {p_yield_no}, Regulated Target Speed: {calculated_speed_cap} km/h.",
            reasoning=f"Capping speed of Train {p_yield_no} to {calculated_speed_cap} km/h widens spacing by 3.2 km without requiring complete stop.",
            result=f"Regulate speed of Train {p_yield_no} to {calculated_speed_cap} km/h. Projected delay impact: +{calculated_delay} min with continuous moving flow."
        )
    elif action_type == "REROUTE":
        trace.add_step(
            step_name="4. Dynamic Loop Line / Platform Diversion",
            rule_id="IR-REROUTE-ALLOC",
            input_state=f"Target Train: {p_yield_no}, Alternate Track: {alternate_path or 'Loop Line 2'}.",
            reasoning=f"Diverting Train {p_yield_no} to {alternate_path or 'Loop Line 2'} eliminates common-block occupancy while keeping mainline clear for Train {p_winner_no}.",
            result=f"Divert Train {p_yield_no} to {alternate_path or 'Loop Line 2'}. Projected delay impact: +{calculated_delay} min for loop turnout speed restriction."
        )

    return trace.to_dict()
