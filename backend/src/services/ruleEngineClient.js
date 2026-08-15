/**
 * Rule Engine Client (services/ruleEngineClient.js)
 * Connects the Node.js API Gateway with the Python FastAPI Rule & Decision Support Engine.
 * 
 * Features:
 * - Direct HTTP bridge to Python FastAPI service.
 * - Built-in fallback rule evaluator in JS for 100% demo uptime in case Python process is offline.
 * - Enforces physical feasibility filtering so non-viable options are never offered.
 */

const axios = require('axios');
const config = require('../config');

class RuleEngineClient {
  constructor() {
    this.baseUrl = config.RULE_ENGINE_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 3000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async evaluateConflicts(trains, weatherSnapshots = []) {
    try {
      const res = await this.client.post('/api/rules/evaluate', {
        trains: trains.map(t => ({
          number: t.number,
          name: t.name,
          class: t.class,
          current_station: t.current_station,
          next_station: t.next_station,
          prev_station: t.prev_station,
          direction: t.direction,
          live_delay_minutes: t.live_delay_minutes || 0,
          speed_kmh: t.speed_kmh || 70,
          current_block_id: t.current_block_id,
          block_progress: t.block_progress || 0.5,
          block_length_km: t.block_length_km || 25,
          is_single_line: Boolean(t.is_single_line),
          eta_next_station_mins: t.eta_next_station_mins || 10,
          distance_to_next_km: t.distance_to_next_km || 15,
          simulated_platform: t.simulated_platform || null
        })),
        weather_snapshots: weatherSnapshots
      });

      return {
        ...res.data,
        engine_source: 'Python FastAPI Rule Engine (Live)'
      };
    } catch (err) {
      console.warn(`[RuleEngine] Python rule engine unreachable (${err.message}). Using resilient JS fallback.`);
      return this._fallbackEvaluateConflicts(trains, weatherSnapshots);
    }
  }

  async runWhatIfSimulation(targetTrainNumber, injectedDelayMins, trains, corridorStations = null) {
    try {
      const res = await this.client.post('/api/rules/what-if', {
        target_train_number: String(targetTrainNumber),
        injected_delay_mins: parseInt(injectedDelayMins, 10),
        trains: trains.map(t => ({
          number: t.number,
          name: t.name,
          class: t.class,
          current_station: t.current_station,
          next_station: t.next_station,
          prev_station: t.prev_station,
          direction: t.direction,
          live_delay_minutes: t.live_delay_minutes || 0,
          speed_kmh: t.speed_kmh || 70
        })),
        corridor_stations: corridorStations
      });

      return {
        ...res.data,
        engine_source: 'Python FastAPI Cascading Simulator (Live)'
      };
    } catch (err) {
      console.warn(`[RuleEngine] Python what-if unreachable (${err.message}). Using resilient JS fallback.`);
      return this._fallbackWhatIf(targetTrainNumber, injectedDelayMins, trains);
    }
  }

  // Fallback JS conflict & resolution evaluator with physical feasibility constraints
  _fallbackEvaluateConflicts(trains, weatherSnapshots) {
    const conflicts = [];
    const resolutions = [];

    for (let i = 0; i < trains.length; i++) {
      for (let j = i + 1; j < trains.length; j++) {
        const a = trains[i];
        const b = trains[j];

        // Check if on loop line
        if ((a.current_block_id && a.current_block_id.endsWith('-LOOP')) || 
            (b.current_block_id && b.current_block_id.endsWith('-LOOP'))) {
          if (a.current_block_id !== b.current_block_id) continue;
        }

        if (a.current_block_id && b.current_block_id && a.current_block_id === b.current_block_id) {
          const progA = a.block_progress || 0.5;
          const progB = b.block_progress || 0.5;
          const distKm = Math.abs(progA - progB) * (a.block_length_km || 25);
          const isSingle = Boolean(a.is_single_line);
          const isHeadOn = isSingle && a.direction !== b.direction;

          if (distKm < 5.0 || isHeadOn) {
            const isAWinner = (a.priority_rank || 3) <= (b.priority_rank || 3);
            const winner = isAWinner ? a : b;
            const yielding = isAWinner ? b : a;

            const conflictType = isHeadOn ? 'OPPOSING_HEADON' : 'SAME_BLOCK_OVERTAKE';
            const confId = isHeadOn ? `CONF-HEADON-${a.number}-${b.number}` : `CONF-OVERTAKE-${a.number}-${b.number}`;

            const confObj = {
              conflict_id: confId,
              type: conflictType,
              severity: (isHeadOn || distKm < 2.5) ? 'CRITICAL' : 'MEDIUM',
              train_a: winner,
              train_b: yielding,
              location: a.current_block_id,
              location_label: isHeadOn ? `Single Line Section ${a.current_block_id}` : `Block Section ${a.current_block_id}`,
              distance_gap_km: Math.round(distKm * 10) / 10,
              time_to_conflict_mins: 4,
              description: isHeadOn 
                ? `Critical Opposing Traffic: Train ${a.number} and Train ${b.number} entering single line block ${a.current_block_id} from opposite directions.`
                : `Overtake: Faster train ${winner.number} catching up to ${yielding.number} (${Math.round(distKm * 10) / 10} km gap).`
            };
            conflicts.push(confObj);

            // Generate feasible options
            const options = [];

            // Option A: HOLD (always feasible)
            options.push({
              option_id: 'OPTION_A_HOLD',
              title: 'Option A — Pre-emptive Hold (Zero Risk)',
              action_type: 'HOLD',
              target_train_number: yielding.number,
              target_train_name: yielding.name,
              hold_duration_mins: isHeadOn ? 6 : 4,
              hold_location: `${yielding.prev_station || 'Outer Signal'} Loop Line`,
              safety_risk_level: 'ZERO / RESOLVED',
              instruction: `Hold Train ${yielding.number} (${yielding.name}) on Loop Line for ${isHeadOn ? 6 : 4} min to let Train ${winner.number} pass on Mainline.`,
              trade_off_summary: `Delay: +${isHeadOn ? 6 : 4} min on Train ${yielding.number} | Safety: Zero collision/headway risk.`,
              explainability_trace: {
                steps: [
                  { step_name: '1. Detection', rule_id: 'IR-OCC-01', reasoning: `${conflictType} detected on ${a.current_block_id}.` },
                  { step_name: '2. Priority', rule_id: 'IR-PRIORITY-PRECEDENCE', reasoning: `Train ${winner.number} holds higher IR rank than ${yielding.number}.` },
                  { step_name: '3. Hold Action', rule_id: 'IR-HOLD-CALC', reasoning: 'Hold at outer signal/loop gives complete mainline clearance.' }
                ]
              }
            });

            // Option B: SPEED_ADJUST (Only feasible for same-direction and gap >= 0.8 km)
            if (!isHeadOn && distKm >= 0.8) {
              options.push({
                option_id: 'OPTION_B_SPEED_ADJUST',
                title: 'Option B — Dynamic Speed Regulation (Flow Optimization)',
                action_type: 'SPEED_ADJUST',
                target_train_number: yielding.number,
                target_train_name: yielding.name,
                speed_cap_kmh: 45,
                safety_risk_level: 'LOW / MONITORED',
                instruction: `Cap speed of Train ${yielding.number} to 45 km/h to widen safe headway to >3.5 km.`,
                trade_off_summary: `Delay: +2 min delay | Energy: Avoids locomotive restart power spike.`,
                explainability_trace: {
                  steps: [
                    { step_name: '1. Dynamic Deceleration', rule_id: 'IR-SPEED-HEADWAY', reasoning: 'Regulating speed to 45 km/h dynamically expands spacing.' }
                  ]
                }
              });
            }

            // Option C: REROUTE (Feasible via siding / loop line)
            options.push({
              option_id: 'OPTION_C_REROUTE',
              title: 'Option C — Track/Loop Diversion',
              action_type: 'REROUTE',
              target_train_number: yielding.number,
              target_train_name: yielding.name,
              reroute_track: `${yielding.prev_station || 'Section'} Loop Line (Turnout 1:12)`,
              speed_cap_kmh: 30,
              safety_risk_level: 'ZERO / RESOLVED',
              instruction: `Switch Train ${yielding.number} onto Loop Line at 30 km/h turnout speed, clearing mainline for Train ${winner.number}.`,
              trade_off_summary: `Delay: Minimal +2 min delay | Mainline preserved for Train ${winner.number}.`,
              explainability_trace: {
                steps: [
                  { step_name: '1. Loop Divert', rule_id: 'IR-REROUTE-ALLOC', reasoning: 'Diverts yielding train into siding loop to physically separate tracks.' }
                ]
              }
            });

            resolutions.push({
              conflict_id: confId,
              conflict_type: conflictType,
              location: a.current_block_id,
              location_label: isHeadOn ? `Single Line Section ${a.current_block_id}` : `Block Section ${a.current_block_id}`,
              options_count: options.length,
              options: options,
              manual_intervention_required: options.length === 0
            });
          }
        }
      }
    }

    return {
      status: 'SUCCESS',
      conflicts_count: conflicts.length,
      conflicts,
      resolutions,
      engine_source: 'Node.js Embedded Heuristics Fallback'
    };
  }

  _fallbackWhatIf(targetTrainNumber, injectedDelayMins, trains) {
    const delay = parseInt(injectedDelayMins, 10);
    const target = trains.find(t => String(t.number) === String(targetTrainNumber)) || { number: targetTrainNumber, name: 'Train', live_delay_minutes: 0 };
    const victims = trains.filter(t => String(t.number) !== String(targetTrainNumber)).slice(0, 2).map((t, idx) => {
      const knockOn = Math.round(delay * (0.6 - idx * 0.2));
      return {
        train_number: t.number,
        train_name: t.name,
        original_delay_mins: t.live_delay_minutes || 0,
        knock_on_delay_mins: knockOn,
        new_projected_delay_mins: (t.live_delay_minutes || 0) + knockOn,
        impact_type: 'TRAILING_BLOCK_CONGESTION',
        propagation_reason: `Trailing behind delayed Train ${targetTrainNumber} on corridor.`
      };
    });

    const totalCascading = victims.reduce((sum, v) => sum + v.knock_on_delay_mins, 0);

    return {
      status: 'SUCCESS',
      simulation_type: 'DETERMINISTIC_GRAPH_PROPAGATION (SIMULATED)',
      target_train: {
        train_number: target.number,
        train_name: target.name,
        injected_delay_mins: delay,
        original_delay_mins: target.live_delay_minutes || 0,
        projected_total_delay_mins: (target.live_delay_minutes || 0) + delay
      },
      network_impact_summary: {
        direct_delay_mins: delay,
        cascading_delay_added_mins: totalCascading,
        net_total_network_delay_mins: delay + totalCascading,
        affected_trains_count: victims.length + 1,
        system_stability_index: Math.max(15, 100 - (delay * 2 + totalCascading * 3))
      },
      cascading_trains: victims,
      propagation_tree: [
        {
          id: `root-${target.number}`,
          train_number: target.number,
          train_name: target.name,
          role: 'PRIMARY_SOURCE',
          injected_delay_mins: delay,
          new_projected_delay_mins: (target.live_delay_minutes || 0) + delay
        },
        ...victims.map(v => ({
          id: `node-${v.train_number}`,
          train_number: v.train_number,
          train_name: v.train_name,
          role: 'CASCADING_VICTIM',
          injected_delay_mins: v.knock_on_delay_mins,
          new_projected_delay_mins: v.new_projected_delay_mins,
          parent_id: `root-${target.number}`
        }))
      ],
      engine_source: 'Node.js Embedded Graph Simulator Fallback'
    };
  }
}

module.exports = new RuleEngineClient();
