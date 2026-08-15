/**
 * Socket.io Real-Time Handler (socket/socketHandler.js)
 * Manages bi-directional WebSocket communication between dashboard clients and backend services.
 * Features comprehensive error handling so no operations fail silently.
 */

const simulator = require('../services/simulator');
const ruleEngine = require('../services/ruleEngineClient');
const { query } = require('../db');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Dashboard client connected (${socket.id})`);

    // Client joins the primary train dispatch control room
    socket.on('join_control_room', () => {
      try {
        socket.join('control_room');
        console.log(`[Socket] Client ${socket.id} joined control room`);

        const currentTrains = query(`
          SELECT tr.*, t.number, t.name, t.class, t.priority_rank, bs.length_km as block_length_km
          FROM train_runs tr
          JOIN trains t ON tr.train_id = t.train_id
          LEFT JOIN block_sections bs ON tr.current_block_id = bs.block_id
        `);

        socket.emit('initial_state', {
          trains: currentTrains,
          conflicts: simulator.activeConflicts,
          resolutions: simulator.activeResolutions,
          is_simulation_paused: simulator.isManualPaused || simulator.isPausedForConflict,
          speed_multiplier: simulator.speedMultiplier
        });
      } catch (err) {
        console.error('[Socket] join_control_room error:', err);
        socket.emit('error_notification', { message: `Initialization failed: ${err.message}` });
      }
    });

    // Operator submits decision on conflict option (Option A, B, or C)
    socket.on('operator_decision', (data) => {
      try {
        const { conflictId, selectedOption, notes } = data;
        if (!conflictId || !selectedOption) {
          socket.emit('decision_ack', { status: 'ERROR', message: 'Missing conflictId or selectedOption' });
          return;
        }
        const result = simulator.applyOperatorDecision(conflictId, selectedOption, notes);
        socket.emit('decision_ack', result);
      } catch (err) {
        console.error('[Socket] operator_decision error:', err);
        socket.emit('decision_ack', { status: 'ERROR', message: `Execution failed: ${err.message}` });
      }
    });

    // Operator triggers a What-If simulation test
    socket.on('run_what_if', async (data) => {
      try {
        const { targetTrainNumber, injectedDelayMins } = data;
        const allTrains = query(`
          SELECT tr.*, t.number, t.name, t.class, t.priority_rank
          FROM train_runs tr
          JOIN trains t ON tr.train_id = t.train_id
        `);

        const whatIfResult = await ruleEngine.runWhatIfSimulation(
          targetTrainNumber,
          injectedDelayMins,
          allTrains
        );

        socket.emit('what_if_result', whatIfResult);
      } catch (err) {
        console.error('[Socket] run_what_if error:', err);
        socket.emit('what_if_result', { status: 'ERROR', message: err.message });
      }
    });

    // Operator injects a demo scenario
    socket.on('inject_scenario', (scenarioType) => {
      try {
        const result = simulator.injectScenario(scenarioType);
        io.emit('scenario_injected', result);
      } catch (err) {
        console.error('[Socket] inject_scenario error:', err);
        socket.emit('scenario_injected', { status: 'ERROR', message: err.message });
      }
    });

    // Simulation playback controls
    socket.on('toggle_simulation_pause', () => {
      try {
        const isPaused = simulator.togglePause();
        io.emit('simulation_pause_state_changed', { is_paused: isPaused });
      } catch (err) {
        console.error('[Socket] toggle_simulation_pause error:', err);
      }
    });

    socket.on('set_simulation_speed', (speedMult) => {
      try {
        simulator.setSpeedMultiplier(speedMult);
        io.emit('simulation_speed_changed', { speed_multiplier: simulator.speedMultiplier });
      } catch (err) {
        console.error('[Socket] set_simulation_speed error:', err);
      }
    });

    socket.on('step_simulation_once', async () => {
      try {
        await simulator.stepOnce();
      } catch (err) {
        console.error('[Socket] step_simulation_once error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected (${socket.id})`);
    });
  });
}

module.exports = { setupSocketHandlers };
