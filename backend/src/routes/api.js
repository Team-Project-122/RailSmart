/**
 * Express REST API Routes (routes/api.js)
 * Clean endpoints for train dispatchers, external integrations, and dashboard widgets.
 */

const express = require('express');
const router = express.Router();
const { query, run } = require('../db');
const railradar = require('../services/railradar');
const weatherService = require('../services/weather');
const platformAllocator = require('../services/platformAllocator');
const simulator = require('../services/simulator');
const ruleEngine = require('../services/ruleEngineClient');

// -------------------------------------------------------------
// 1. TRAINS & TIMETABLE ENDPOINTS
// -------------------------------------------------------------

// List all active trains in the network
router.get('/trains', (req, res) => {
  try {
    const trains = query(`
      SELECT tr.*, t.number, t.name, t.class, t.priority_rank, t.source_station, t.destination_station,
             bs.length_km as block_length_km, bs.simulated_signal_state
      FROM train_runs tr
      JOIN trains t ON tr.train_id = t.train_id
      LEFT JOIN block_sections bs ON tr.current_block_id = bs.block_id
    `);
    res.json({ status: 'SUCCESS', count: trains.length, data: trains });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Real/Cached RailRadar Full Schedule
router.get('/trains/:number/schedule', async (req, res) => {
  try {
    const data = await railradar.getTrainSchedule(req.params.number);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// Real/Cached RailRadar Live Status
router.get('/trains/:number/live', async (req, res) => {
  try {
    const data = await railradar.getTrainLiveStatus(req.params.number);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// Trains running between two stations
router.get('/trains/between/:from/:to', async (req, res) => {
  try {
    const data = await railradar.getTrainsBetween(req.params.from.toUpperCase(), req.params.to.toUpperCase());
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// Train Route Geometry
router.get('/trains/:number/route', async (req, res) => {
  try {
    const data = await railradar.getTrainRouteGeometry(req.params.number);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// -------------------------------------------------------------
// 2. STATIONS & TOPOLOGY
// -------------------------------------------------------------

router.get('/stations', (req, res) => {
  try {
    const stations = query('SELECT * FROM stations ORDER BY lat DESC');
    res.json({ status: 'SUCCESS', data: stations });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

router.get('/blocks', (req, res) => {
  try {
    const blocks = query(`
      SELECT bs.*, s1.name as from_station_name, s2.name as to_station_name
      FROM block_sections bs
      JOIN stations s1 ON bs.from_station = s1.station_code
      JOIN stations s2 ON bs.to_station = s2.station_code
    `);
    res.json({ status: 'SUCCESS', data: blocks });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// -------------------------------------------------------------
// 3. CONFLICTS & 3-WAY RESOLUTION RECOMMENDATIONS
// -------------------------------------------------------------

router.get('/conflicts', (req, res) => {
  try {
    res.json({
      status: 'SUCCESS',
      active_conflicts_count: simulator.activeConflicts.length,
      conflicts: simulator.activeConflicts,
      resolutions: simulator.activeResolutions
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Submit an operator decision on a conflict strategy
router.post('/recommendations/decide', (req, res) => {
  try {
    const { conflictId, selectedOption, notes } = req.body;
    if (!conflictId || !selectedOption) {
      return res.status(400).json({ status: 'ERROR', error: 'conflictId and selectedOption are required.' });
    }

    const result = simulator.applyOperatorDecision(conflictId, selectedOption, notes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// -------------------------------------------------------------
// 4. "WHAT-IF" CASCADING DELAY SIMULATION
// -------------------------------------------------------------

router.post('/what-if', async (req, res) => {
  try {
    const { targetTrainNumber, injectedDelayMins } = req.body;
    if (!targetTrainNumber || injectedDelayMins === undefined) {
      return res.status(400).json({ status: 'ERROR', error: 'targetTrainNumber and injectedDelayMins are required.' });
    }

    const allTrains = query(`
      SELECT tr.*, t.number, t.name, t.class, t.priority_rank
      FROM train_runs tr
      JOIN trains t ON tr.train_id = t.train_id
    `);

    const result = await ruleEngine.runWhatIfSimulation(
      targetTrainNumber,
      injectedDelayMins,
      allTrains
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// -------------------------------------------------------------
// 5. SIMULATED PLATFORM ALLOCATIONS
// -------------------------------------------------------------

router.get('/platforms/:stationCode', (req, res) => {
  try {
    const code = req.params.stationCode.toUpperCase();
    const status = platformAllocator.getStationPlatformStatus(code);
    res.json(status);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// -------------------------------------------------------------
// 6. WEATHER MONITOR & SPEED RESTRICTIONS
// -------------------------------------------------------------

router.get('/weather', async (req, res) => {
  try {
    const all = await weatherService.getAllStationWeather();
    res.json({ status: 'SUCCESS', data: all });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// -------------------------------------------------------------
// 7. OPERATOR TRUST SCORE & HISTORICAL TRENDS
// -------------------------------------------------------------

router.get('/analytics/trust-score', (req, res) => {
  try {
    const logs = query('SELECT * FROM operator_decisions_log ORDER BY timestamp DESC LIMIT 50');
    const acceptedCount = logs.filter(l => l.action === 'ACCEPTED').length;
    const totalCount = logs.length;
    const trustScore = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 94;

    res.json({
      status: 'SUCCESS',
      trust_score_percent: trustScore,
      total_decisions: totalCount,
      accepted_count: acceptedCount,
      recent_logs: logs
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

router.get('/analytics/historical-trends', (req, res) => {
  try {
    const trends = query('SELECT * FROM synthetic_historical_trends ORDER BY date ASC');
    res.json({
      status: 'SUCCESS',
      is_simulated: true,
      label: '[SIMULATED HISTORICAL TRENDS FOR DEMONSTRATION]',
      data: trends
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// -------------------------------------------------------------
// 8. INTERACTIVE DEMO SCENARIOS
// -------------------------------------------------------------

router.post('/scenarios/inject', (req, res) => {
  try {
    const { scenario } = req.body;
    const result = simulator.injectScenario(scenario || 'SCENARIO_OVERTAKE');
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

module.exports = router;
