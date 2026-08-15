/**
 * Train Traffic Simulation & Progression Engine (services/simulator.js)
 * Manages live train progression along block sections, derives simulated signal aspects,
 * orchestrates periodic conflict scans with the Rule Engine, and executes conflict lifecycle transitions.
 * 
 * Features:
 * - Smooth real-time train movement interpolation.
 * - Auto-Pause on Active Conflict: Automatically freezes train motion when an active conflict is detected
 *   so the dispatcher can inspect and choose a resolution option.
 * - Interactive Resolution Execution: Clicking "Select & Apply" applies the strategy (Hold, Speed Cap, Loop Reroute),
 *   unfreezes the simulation, and visibly routes the trains accordingly.
 * - Manual Play/Pause, Step, and Speed Multipliers (1x, 2x, 5x).
 */

const { query, run, db } = require('../db');
const ruleEngine = require('./ruleEngineClient');
const weatherService = require('./weather');
const platformAllocator = require('./platformAllocator');
const config = require('../config');

class SimulatorService {
  constructor() {
    this.io = null;
    this.timer = null;
    this.isRunning = false;
    
    // Playback and pause controls
    this.isManualPaused = false;
    this.isPausedForConflict = false;
    this.autoPauseOnConflict = true;
    this.speedMultiplier = 2; // Default 2x for visible interactive demo progression
    
    // Conflict Lifecycle State Registry
    // Key: conflict_id -> Value: { conflict_id, status, conflict, selectedOption, resolutionProgress, clearedTicks }
    this.conflictState = new Map();
    
    this.activeConflicts = [];
    this.activeResolutions = [];
    this.speedOverrides = new Map(); // trainNumber -> speedCapKmh
    this.holdTimers = new Map();      // trainNumber -> { remainingMins, totalMins, reason }
    this.loopDiversions = new Map();  // trainNumber -> { originalBlockId, loopBlockId, turnoutSpeed }
  }

  init(io) {
    this.io = io;
    this.startSimulationLoop();
  }

  startSimulationLoop() {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = true;
    console.log(`[Simulator] Live train progression ticker started (Interval: ${config.TICK_INTERVAL_MS}ms, Speed: ${this.speedMultiplier}x)`);

    this.timer = setInterval(async () => {
      try {
        await this.step();
      } catch (err) {
        console.error('[Simulator] Tick error:', err);
      }
    }, config.TICK_INTERVAL_MS);
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = Math.max(1, Math.min(10, parseInt(multiplier, 10) || 1));
    console.log(`[Simulator] Simulation speed multiplier set to ${this.speedMultiplier}x`);
  }

  togglePause() {
    this.isManualPaused = !this.isManualPaused;
    console.log(`[Simulator] Simulation manual paused: ${this.isManualPaused}`);
    return this.isManualPaused;
  }

  stepOnce() {
    return this.step(true);
  }

  async step(forceStep = false) {
    // 1. Fetch current active train runs
    const trainRuns = query(`
      SELECT tr.*, t.number, t.name, t.class, t.priority_rank, t.max_speed_kmh as normal_max_speed,
             bs.length_km as block_length_km, bs.is_single_line
      FROM train_runs tr
      JOIN trains t ON tr.train_id = t.train_id
      LEFT JOIN block_sections bs ON tr.current_block_id = bs.block_id
      WHERE tr.status = 'RUNNING'
    `);

    // 2. Fetch corridor weather snapshots
    const weatherSnapshots = await weatherService.getAllStationWeather();

    // Check if simulation should advance train positions
    const isPaused = (this.isManualPaused || this.isPausedForConflict) && !forceStep;

    // 3. Update train positions and apply in-flight physical resolutions
    for (const train of trainRuns) {
      const tNum = String(train.number);

      // Check if train is currently in a HOLD state from an operator decision
      const holdState = this.holdTimers.get(tNum);
      if (holdState && holdState.remainingMins > 0) {
        if (!isPaused) {
          // Decrement hold timer during active progression
          holdState.remainingMins = Math.max(0, Math.round((holdState.remainingMins - (0.05 * this.speedMultiplier)) * 100) / 100);
        }
        train.speed_kmh = 0;
        train.is_held = true;
        train.hold_remaining_mins = holdState.remainingMins;
        train.hold_total_mins = holdState.totalMins;
        train.hold_reason = holdState.reason;
      } else if (holdState && holdState.remainingMins <= 0) {
        this.holdTimers.delete(tNum);
        train.is_held = false;
        train.hold_remaining_mins = 0;
      }

      // Check if train is on a loop diversion
      const loopState = this.loopDiversions.get(tNum);
      if (loopState) {
        train.is_on_loop = true;
        train.loop_block_id = loopState.loopBlockId;
      } else {
        train.is_on_loop = (train.current_block_id && train.current_block_id.endsWith('-LOOP'));
      }

      // Calculate speed: Hold > Speed Override > Weather Cap > Normal Max
      let targetSpeed = train.normal_max_speed || 100;
      if (train.is_held) {
        targetSpeed = 0;
      } else if (loopState || train.is_on_loop) {
        targetSpeed = Math.min(30, targetSpeed); // Turnout speed limit
        train.speed_capped = true;
        train.active_speed_cap = 30;
      } else if (this.speedOverrides.has(tNum)) {
        targetSpeed = this.speedOverrides.get(tNum);
        train.speed_capped = true;
        train.active_speed_cap = targetSpeed;
      } else {
        train.speed_capped = false;
      }

      // Apply weather speed restriction if active at current station
      const stnWeather = weatherSnapshots.find(w => w.station_code === train.prev_station || w.station_code === train.next_station);
      if (stnWeather && !train.is_held) {
        if (stnWeather.visibility_m < 200) targetSpeed = Math.min(targetSpeed, 60);
        else if (stnWeather.visibility_m < 500) targetSpeed = Math.min(targetSpeed, 75);
        else if (stnWeather.condition === 'RAIN' || stnWeather.condition === 'THUNDERSTORM') targetSpeed = Math.min(targetSpeed, targetSpeed * 0.80);
      }

      train.speed_kmh = targetSpeed;

      // Advance block progress if moving and not paused
      if (train.speed_kmh > 0 && !isPaused) {
        const blockLen = train.block_length_km || 50.0;
        // Calculation: hours elapsed per tick * speed * multiplier
        const hoursPerTick = (config.TICK_INTERVAL_MS / 1000) / 3600 * (10 * this.speedMultiplier);
        const distanceCoveredKm = train.speed_kmh * hoursPerTick;
        const progressDelta = distanceCoveredKm / blockLen;

        let newProgress = (train.block_progress || 0.1) + progressDelta;
        if (newProgress >= 1.0) {
          newProgress = 0.05;
          this._transitionToNextBlock(train);
        } else {
          train.block_progress = Math.min(0.99, newProgress);
        }

        // Update ETA & Distance
        train.distance_to_next_km = Math.max(1.0, Math.round((1.0 - train.block_progress) * blockLen * 10) / 10);
        train.eta_next_station_mins = Math.max(1.0, Math.round((train.distance_to_next_km / Math.max(20, train.speed_kmh)) * 60));

        // Persist progress to DB
        run(`
          UPDATE train_runs
          SET block_progress = ?, speed_kmh = ?, distance_to_next_km = ?, eta_next_station_mins = ?, last_updated = CURRENT_TIMESTAMP
          WHERE run_id = ?
        `, [train.block_progress, train.speed_kmh, train.distance_to_next_km, train.eta_next_station_mins, train.run_id]);
      }
    }

    // 4. Update In-Flight Resolving Conflicts & Check Physical Clearance
    this._updateResolvingConflicts(trainRuns);

    // 5. Evaluate Fresh Conflicts for pairs that are not already Resolving/Cleared
    await this._evaluateFreshConflicts(trainRuns, weatherSnapshots);

    // Auto-Pause check: If any active conflict exists and autoPauseOnConflict is enabled
    const hasActiveConflict = Array.from(this.conflictState.values()).some(cs => cs.status === 'ACTIVE');
    if (hasActiveConflict && this.autoPauseOnConflict) {
      if (!this.isPausedForConflict) {
        console.log('[Simulator] Auto-pausing simulation: Active conflict requires operator decision.');
        this.isPausedForConflict = true;
      }
    } else {
      if (this.isPausedForConflict && !hasActiveConflict) {
        console.log('[Simulator] Resuming simulation: No active unhandled conflicts.');
        this.isPausedForConflict = false;
      }
    }

    // 6. Derive Simulated Signal States for each block section
    this._updateSimulatedSignalStates(trainRuns);

    // Compile active conflicts list from conflictState map
    this.activeConflicts = Array.from(this.conflictState.values()).map(cs => ({
      ...cs.conflict,
      status: cs.status,
      selected_option: cs.selectedOption,
      resolution_progress: cs.resolutionProgress,
      failure_reason: cs.failureReason
    }));

    // 7. Broadcast Real-Time Updates via Socket.io
    if (this.io) {
      this.io.emit('telemetry_tick', {
        timestamp: new Date().toISOString(),
        trains: trainRuns,
        conflicts: this.activeConflicts,
        resolutions: this.activeResolutions,
        engine_source: 'RailSmart Rule & Risk Engine (Deterministic)',
        is_simulation_paused: this.isManualPaused || this.isPausedForConflict,
        is_paused_for_conflict: this.isPausedForConflict,
        is_manual_paused: this.isManualPaused,
        speed_multiplier: this.speedMultiplier
      });
    }
  }

  _updateResolvingConflicts(trainRuns) {
    const trainMap = new Map(trainRuns.map(t => [String(t.number), t]));

    for (const [confId, cs] of this.conflictState.entries()) {
      if (cs.status === 'RESOLVING') {
        const trainA = trainMap.get(String(cs.conflict.train_a?.number));
        const trainB = trainMap.get(String(cs.conflict.train_b?.number));

        if (!trainA || !trainB) {
          cs.status = 'CLEARED';
          cs.clearedTicks = 3;
          continue;
        }

        const opt = cs.selectedOption;
        const actionType = opt?.action_type;

        // Calculate live spatial gap
        let liveDistGap = 0;
        const sameBlock = (trainA.current_block_id === trainB.current_block_id);
        if (sameBlock) {
          const progA = trainA.block_progress || 0.5;
          const progB = trainB.block_progress || 0.5;
          const blockLen = trainA.block_length_km || 25.0;
          liveDistGap = Math.abs(progA - progB) * blockLen;
        } else {
          liveDistGap = 15.0; // In separate blocks
        }

        let isPhysicallyCleared = false;

        if (actionType === 'HOLD') {
          const hold = this.holdTimers.get(String(opt.target_train_number));
          const remaining = hold ? hold.remainingMins : 0;
          cs.resolutionProgress = {
            statusText: remaining > 0 
              ? `Hold in progress at ${opt.hold_location || 'Outer Signal'}: ${remaining.toFixed(1)} min remaining`
              : `Hold completed — safe headway restored (${liveDistGap.toFixed(1)} km gap)`,
            holdRemainingMins: remaining,
            currentGapKm: liveDistGap
          };

          // Cleared if hold finished or leading train moved far ahead
          if (remaining <= 0 || !sameBlock || liveDistGap >= 3.5) {
            isPhysicallyCleared = true;
          }
        } else if (actionType === 'SPEED_ADJUST') {
          cs.resolutionProgress = {
            statusText: `Speed regulation active (${opt.speed_cap_kmh} km/h) — gap expanding: ${liveDistGap.toFixed(1)} km`,
            currentGapKm: liveDistGap,
            targetSpeedKmh: opt.speed_cap_kmh
          };

          // Cleared if safe headway >= 3.0 km or different blocks
          if (!sameBlock || liveDistGap >= 3.0) {
            isPhysicallyCleared = true;
            this.speedOverrides.delete(String(opt.target_train_number));
          }
        } else if (actionType === 'REROUTE') {
          const isYieldingOnLoop = (trainB.current_block_id && trainB.current_block_id.endsWith('-LOOP')) ||
                                   (trainA.current_block_id && trainA.current_block_id.endsWith('-LOOP'));
          cs.resolutionProgress = {
            statusText: isYieldingOnLoop 
              ? `Train safely switched into ${opt.reroute_track || 'Loop Siding'} — mainline cleared for priority pass`
              : `Platform re-allocation active`,
            currentGapKm: liveDistGap,
            isOnLoop: isYieldingOnLoop
          };

          // Cleared once trains are on separate lines or passing has occurred
          if (isYieldingOnLoop || !sameBlock || liveDistGap >= 2.5) {
            isPhysicallyCleared = true;
          }
        }

        if (isPhysicallyCleared) {
          console.log(`[Simulator] Conflict ${confId} physically CLEARED.`);
          cs.status = 'CLEARED';
          cs.clearedTicks = 3;

          if (this.io) {
            this.io.emit('conflict_status_update', {
              conflict_id: confId,
              status: 'CLEARED',
              message: `Conflict physically resolved: safe headway restored.`
            });
          }
        } else {
          if (this.io) {
            this.io.emit('conflict_status_update', {
              conflict_id: confId,
              status: 'RESOLVING',
              progress: cs.resolutionProgress
            });
          }
        }
      } else if (cs.status === 'CLEARED') {
        cs.clearedTicks = (cs.clearedTicks || 1) - 1;
        if (cs.clearedTicks <= 0) {
          this.conflictState.delete(confId);
          this.activeResolutions = this.activeResolutions.filter(r => r.conflict_id !== confId);
        }
      }
    }
  }

  async _evaluateFreshConflicts(trainRuns, weatherSnapshots) {
    const evalResult = await ruleEngine.evaluateConflicts(trainRuns, weatherSnapshots);
    const freshConflicts = evalResult.conflicts || [];
    const freshResolutions = evalResult.resolutions || [];

    for (const conf of freshConflicts) {
      const confId = conf.conflict_id;
      // If already tracked in conflictState, do not overwrite if resolving or cleared
      if (this.conflictState.has(confId)) {
        const existing = this.conflictState.get(confId);
        if (existing.status === 'RESOLVING' || existing.status === 'CLEARED') {
          continue; // Maintain in-flight resolution
        }
      }

      // New active conflict
      this.conflictState.set(confId, {
        conflict_id: confId,
        status: 'ACTIVE',
        conflict: conf,
        selectedOption: null,
        resolutionProgress: null,
        failureReason: null
      });

      // Update resolution in activeResolutions
      const res = freshResolutions.find(r => r.conflict_id === confId);
      if (res) {
        this.activeResolutions = this.activeResolutions.filter(r => r.conflict_id !== confId);
        this.activeResolutions.push(res);
      }
    }
  }

  _transitionToNextBlock(train) {
    const corridor = ['NDLS', 'GZB', 'ALJN', 'TDL', 'CNB', 'PRYJ', 'DDU', 'PNBE', 'HWH'];
    const curIdx = corridor.indexOf(train.next_station);
    if (curIdx !== -1 && curIdx < corridor.length - 1) {
      const newPrev = corridor[curIdx];
      const newNext = corridor[curIdx + 1];
      const newBlockId = `BLK-${newPrev}-${newNext}`;

      // Clean up loop diversion if train was on loop
      if (this.loopDiversions.has(String(train.number))) {
        this.loopDiversions.delete(String(train.number));
      }

      run(`
        UPDATE train_runs
        SET prev_station = ?, next_station = ?, current_station = ?, current_block_id = ?, block_progress = 0.05
        WHERE run_id = ?
      `, [newPrev, newNext, newPrev, newBlockId, train.run_id]);

      train.prev_station = newPrev;
      train.next_station = newNext;
      train.current_block_id = newBlockId;
      train.block_progress = 0.05;
    }
  }

  _updateSimulatedSignalStates(trainRuns) {
    const blocks = query('SELECT * FROM block_sections');
    for (const b of blocks) {
      const occupying = trainRuns.filter(t => t.current_block_id === b.block_id || t.current_block_id === `${b.block_id}-LOOP`);
      let signalState = 'GREEN';

      if (occupying.length >= 2) {
        // Check if one train is resolving / on loop line / held
        const hasHeld = occupying.some(t => t.is_held);
        const hasLoop = occupying.some(t => t.is_on_loop || (t.current_block_id && t.current_block_id.endsWith('-LOOP')));
        
        if (hasHeld || hasLoop) {
          signalState = 'YELLOW'; // Caution / safe clearance in progress
        } else {
          signalState = 'RED'; // Multiple moving trains in same unmanaged block
        }
      } else if (occupying.length === 1) {
        signalState = occupying[0].block_progress > 0.7 ? 'YELLOW' : 'RED';
      }

      run(`
        UPDATE block_sections
        SET simulated_signal_state = ?, current_occupancy_train_id = ?
        WHERE block_id = ?
      `, [signalState, occupying.length > 0 ? occupying[0].train_id : null, b.block_id]);
    }
  }

  /**
   * Applies an operator decision on a conflict strategy (Option A: Hold, Option B: Speed Adjust, Option C: Reroute)
   * Transitions conflict to RESOLVING state and unfreezes the simulation.
   */
  applyOperatorDecision(conflictId, selectedOption, operatorNotes = '') {
    try {
      const optionId = selectedOption.option_id;
      const targetTrainNo = String(selectedOption.target_train_number);
      const actionType = selectedOption.action_type;

      console.log(`[Simulator] Applying ${actionType} on Train ${targetTrainNo} for Conflict ${conflictId}`);

      // Verify physical applicability at time of execution
      const train = query(`SELECT * FROM train_runs tr JOIN trains t ON tr.train_id = t.train_id WHERE t.number = ?`, [targetTrainNo])[0];
      if (!train) {
        throw new Error(`Target train ${targetTrainNo} not found in active running registry.`);
      }

      if (actionType === 'HOLD') {
        const holdDuration = selectedOption.hold_duration_mins || 4;
        this.holdTimers.set(targetTrainNo, {
          remainingMins: holdDuration,
          totalMins: holdDuration,
          reason: `Operator accepted Pre-emptive Hold (${holdDuration} min)`
        });
        run(`
          UPDATE train_runs
          SET live_delay_minutes = live_delay_minutes + ?, speed_kmh = 0
          WHERE train_id = ?
        `, [holdDuration, train.train_id]);
      } else if (actionType === 'SPEED_ADJUST') {
        const speedCap = selectedOption.speed_cap_kmh || 45;
        this.speedOverrides.set(targetTrainNo, speedCap);
        run(`
          UPDATE train_runs
          SET speed_kmh = ?, live_delay_minutes = live_delay_minutes + 2
          WHERE train_id = ?
        `, [speedCap, train.train_id]);
      } else if (actionType === 'REROUTE') {
        // Physical Consequence: Divert train to loop line block via turnout
        const currentBlock = train.current_block_id || 'BLK-CNB-PRYJ';
        const loopBlock = currentBlock.endsWith('-LOOP') ? currentBlock : `${currentBlock}-LOOP`;
        
        this.loopDiversions.set(targetTrainNo, {
          originalBlockId: currentBlock,
          loopBlockId: loopBlock,
          turnoutSpeed: 30
        });

        run(`
          UPDATE train_runs
          SET current_block_id = ?, speed_kmh = 30, simulated_platform = 3, live_delay_minutes = live_delay_minutes + 2
          WHERE train_id = ?
        `, [loopBlock, train.train_id]);
      }

      // Log decision in DB
      const logId = `LOG-${Date.now()}`;
      run(`
        INSERT INTO operator_decisions_log (log_id, rec_id, conflict_id, selected_option_id, action, notes)
        VALUES (?, ?, ?, ?, 'ACCEPTED', ?)
      `, [logId, selectedOption.option_id, conflictId, optionId, operatorNotes || selectedOption.instruction]);

      // Transition conflict to RESOLVING state in state machine
      if (this.conflictState.has(conflictId)) {
        const cs = this.conflictState.get(conflictId);
        cs.status = 'RESOLVING';
        cs.selectedOption = selectedOption;
        cs.resolutionProgress = {
          statusText: `Resolution in progress: ${selectedOption.title}`,
          appliedAt: new Date().toISOString()
        };
      } else {
        this.conflictState.set(conflictId, {
          conflict_id: conflictId,
          status: 'RESOLVING',
          conflict: { conflict_id: conflictId, train_a: { number: targetTrainNo }, train_b: {} },
          selectedOption: selectedOption,
          resolutionProgress: {
            statusText: `Resolution in progress: ${selectedOption.title}`,
            appliedAt: new Date().toISOString()
          }
        });
      }

      // Unfreeze simulation automatically if it was paused for this conflict
      this.isPausedForConflict = false;

      // Broadcast resolution confirmation
      if (this.io) {
        this.io.emit('operator_decision_confirmed', {
          conflict_id: conflictId,
          selected_option: selectedOption,
          action: actionType,
          status: 'RESOLVING',
          applied_at: new Date().toISOString()
        });
      }

      return {
        status: 'SUCCESS',
        message: `Resolution ${selectedOption.title} successfully executed on Train ${targetTrainNo}. Simulation resumed.`,
        conflict_status: 'RESOLVING',
        action: actionType
      };
    } catch (err) {
      console.error('[Simulator] applyOperatorDecision error:', err);
      if (this.conflictState.has(conflictId)) {
        const cs = this.conflictState.get(conflictId);
        cs.status = 'FAILED';
        cs.failureReason = err.message;
      }
      return {
        status: 'ERROR',
        message: `Failed to execute resolution: ${err.message}`
      };
    }
  }

  /**
   * Injects pre-configured demo scenarios for live presentations.
   */
  injectScenario(scenarioType) {
    try {
      console.log(`[Simulator] Injecting scenario: ${scenarioType}`);
      this.holdTimers.clear();
      this.speedOverrides.clear();
      this.loopDiversions.clear();
      this.conflictState.clear();
      this.activeResolutions = [];
      this.isPausedForConflict = false;

      if (scenarioType === 'SCENARIO_OVERTAKE') {
        // Vande Bharat (22436) catching up to Coal Freight (BCN-489) in Kanpur-Prayagraj block
        db.exec(`
          UPDATE train_runs
          SET current_block_id = 'BLK-CNB-PRYJ', prev_station = 'CNB', next_station = 'PRYJ',
              block_progress = 0.38, speed_kmh = 125, live_delay_minutes = 2, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '22436');

          UPDATE train_runs
          SET current_block_id = 'BLK-CNB-PRYJ', prev_station = 'CNB', next_station = 'PRYJ',
              block_progress = 0.42, speed_kmh = 55, live_delay_minutes = 18, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = 'BCN-489');
        `);
      } else if (scenarioType === 'SCENARIO_FOG_NCR') {
        // Severe fog in Aligarh / Ghaziabad section (Vis: 150m)
        db.exec(`
          UPDATE weather_snapshots SET condition = 'FOG', visibility_m = 150, temp_c = 14 WHERE station_code = 'ALJN';
          UPDATE weather_snapshots SET condition = 'FOG', visibility_m = 180, temp_c = 15 WHERE station_code = 'GZB';
        `);
      } else if (scenarioType === 'SCENARIO_PLATFORM_BOTTLENECK') {
        // Shatabdi and Shiv Ganga arriving concurrently at Kanpur Central
        db.exec(`
          UPDATE train_runs
          SET current_block_id = 'BLK-TDL-CNB', prev_station = 'TDL', next_station = 'CNB',
              block_progress = 0.85, eta_next_station_mins = 6, simulated_platform = 1, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '12004');

          UPDATE train_runs
          SET current_block_id = 'BLK-TDL-CNB', prev_station = 'TDL', next_station = 'CNB',
              block_progress = 0.82, eta_next_station_mins = 8, simulated_platform = 1, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '12560');
        `);
      } else if (scenarioType === 'SCENARIO_HEADON_SINGLE_LINE') {
        // Head-On conflict on single-line section: Vande Bharat (22436) DN vs Freight (BOXN-912) UP on ALJN-TDL single line
        db.exec(`
          UPDATE block_sections SET is_single_line = 1 WHERE block_id = 'BLK-ALJN-TDL';

          UPDATE train_runs
          SET current_block_id = 'BLK-ALJN-TDL', prev_station = 'ALJN', next_station = 'TDL',
              block_progress = 0.35, speed_kmh = 110, direction = 'DN', live_delay_minutes = 0
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '22436');

          UPDATE train_runs
          SET current_block_id = 'BLK-ALJN-TDL', prev_station = 'TDL', next_station = 'ALJN',
              block_progress = 0.65, speed_kmh = 50, direction = 'UP', live_delay_minutes = 15
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = 'BOXN-912');
        `);
      } else if (scenarioType === 'SCENARIO_CASCADING_FREIGHT_BACKUP') {
        // Slow delayed freight causing cascading backlog for Rajdhani and Superfast behind it
        db.exec(`
          UPDATE train_runs
          SET current_block_id = 'BLK-GZB-ALJN', prev_station = 'GZB', next_station = 'ALJN',
              block_progress = 0.70, speed_kmh = 35, live_delay_minutes = 38, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = 'BCN-489');

          UPDATE train_runs
          SET current_block_id = 'BLK-GZB-ALJN', prev_station = 'GZB', next_station = 'ALJN',
              block_progress = 0.40, speed_kmh = 100, live_delay_minutes = 4, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '12302');

          UPDATE train_runs
          SET current_block_id = 'BLK-NDLS-GZB', prev_station = 'NDLS', next_station = 'GZB',
              block_progress = 0.85, speed_kmh = 95, live_delay_minutes = 2, direction = 'DN'
          WHERE train_id IN (SELECT train_id FROM trains WHERE number = '12560');
        `);
      } else if (scenarioType === 'RESET') {
        const { seedDatabase } = require('../db/seed');
        seedDatabase();
      }

      return {
        status: 'SUCCESS',
        scenario: scenarioType,
        message: `Scenario ${scenarioType} successfully loaded into simulation.`
      };
    } catch (err) {
      console.error('[Simulator] injectScenario error:', err);
      return {
        status: 'ERROR',
        scenario: scenarioType,
        message: `Failed to inject scenario: ${err.message}`
      };
    }
  }
}

module.exports = new SimulatorService();
