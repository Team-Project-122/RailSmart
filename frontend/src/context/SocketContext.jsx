import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const BACKEND_URL = 'http://localhost:5001';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [trains, setTrains] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [trustScoreData, setTrustScoreData] = useState({ trust_score_percent: 94, total_decisions: 12, accepted_count: 11, recent_logs: [] });
  const [historicalTrends, setHistoricalTrends] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [activeScenario, setActiveScenario] = useState('NORMAL');
  const [lastTickTime, setLastTickTime] = useState(null);
  const [engineSource, setEngineSource] = useState('Python FastAPI Rule Engine');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Simulation playback state
  const [isSimulationPaused, setIsSimulationPaused] = useState(false);
  const [isPausedForConflict, setIsPausedForConflict] = useState(false);
  const [speedMultiplier, setSpeedMultiplierState] = useState(2);

  // Initialize Socket.io connection & initial API fetches
  useEffect(() => {
    const s = io(BACKEND_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      console.log('[Socket] Connected to RailSmart Backend:', s.id);
      setConnectionStatus('ONLINE');
      s.emit('join_control_room');
    });

    s.on('disconnect', () => {
      console.log('[Socket] Disconnected from backend');
      setConnectionStatus('OFFLINE');
    });

    s.on('initial_state', (data) => {
      if (data.trains) setTrains(data.trains);
      if (data.conflicts) setConflicts(data.conflicts);
      if (data.resolutions) setResolutions(data.resolutions);
      if (data.is_simulation_paused !== undefined) setIsSimulationPaused(data.is_simulation_paused);
      if (data.speed_multiplier !== undefined) setSpeedMultiplierState(data.speed_multiplier);
    });

    s.on('telemetry_tick', (data) => {
      setLastTickTime(data.timestamp);
      if (data.trains) setTrains(data.trains);
      if (data.conflicts) setConflicts(data.conflicts);
      if (data.resolutions) setResolutions(data.resolutions);
      if (data.engine_source) setEngineSource(data.engine_source);
      if (data.is_simulation_paused !== undefined) setIsSimulationPaused(data.is_simulation_paused);
      if (data.is_paused_for_conflict !== undefined) setIsPausedForConflict(data.is_paused_for_conflict);
      if (data.speed_multiplier !== undefined) setSpeedMultiplierState(data.speed_multiplier);
    });

    s.on('operator_decision_confirmed', (data) => {
      console.log('[Socket] Operator decision confirmed:', data);
      setIsPausedForConflict(false);
      fetchTrustScore();
    });

    s.on('conflict_status_update', (data) => {
      console.log('[Socket] Conflict status update:', data);
      setConflicts(prev => prev.map(c => c.conflict_id === data.conflict_id ? { ...c, status: data.status, resolution_progress: data.progress } : c));
    });

    s.on('scenario_injected', (data) => {
      setActiveScenario(data.scenario);
      setIsPausedForConflict(false);
    });

    s.on('simulation_pause_state_changed', (data) => {
      setIsSimulationPaused(data.is_paused);
    });

    s.on('simulation_speed_changed', (data) => {
      setSpeedMultiplierState(data.speed_multiplier);
    });

    setSocket(s);

    fetchWeather();
    fetchTrustScore();
    fetchHistoricalTrends();

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchWeather();
      fetchTrustScore();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/weather`);
      const data = await res.json();
      if (data.data) setWeatherData(data.data);
    } catch (e) {
      console.warn('Weather fetch error:', e);
    }
  };

  const fetchTrustScore = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/trust-score`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setTrustScoreData(data);
    } catch (e) {
      console.warn('Trust score fetch error:', e);
    }
  };

  const fetchHistoricalTrends = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/historical-trends`);
      const data = await res.json();
      if (data.data) setHistoricalTrends(data.data);
    } catch (e) {
      console.warn('Historical trends fetch error:', e);
    }
  };

  // Submit an operator resolution selection
  const submitDecision = async (conflictId, selectedOption, notes = '') => {
    try {
      if (socket) {
        socket.emit('operator_decision', { conflictId, selectedOption, notes });
      } else {
        await fetch(`${BACKEND_URL}/api/recommendations/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conflictId, selectedOption, notes })
        });
      }
      setIsPausedForConflict(false);
      fetchTrustScore();
    } catch (err) {
      console.error('Error submitting decision:', err);
    }
  };

  // Simulation controls
  const toggleSimulationPause = () => {
    if (socket) socket.emit('toggle_simulation_pause');
  };

  const setSimulationSpeed = (speedMult) => {
    if (socket) socket.emit('set_simulation_speed', speedMult);
  };

  const stepSimulationOnce = () => {
    if (socket) socket.emit('step_simulation_once');
  };

  // Run What-If delay propagation simulation
  const runWhatIf = async (targetTrainNumber, injectedDelayMins) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/what-if`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTrainNumber, injectedDelayMins })
      });
      return await res.json();
    } catch (err) {
      console.error('What-If execution error:', err);
      return { status: 'ERROR', message: err.message };
    }
  };

  // Inject a demo scenario
  const injectScenario = async (scenarioType) => {
    try {
      if (socket) {
        socket.emit('inject_scenario', scenarioType);
      } else {
        await fetch(`${BACKEND_URL}/api/scenarios/inject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: scenarioType })
        });
      }
      setActiveScenario(scenarioType);
      setIsPausedForConflict(false);
    } catch (err) {
      console.error('Scenario injection error:', err);
    }
  };

  // Fetch simulated platform assignments for a station
  const fetchPlatformStatus = async (stationCode) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/platforms/${stationCode}`);
      return await res.json();
    } catch (e) {
      return { platforms: [] };
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      connectionStatus,
      trains,
      conflicts,
      resolutions,
      weatherData,
      trustScoreData,
      historicalTrends,
      selectedTrain,
      setSelectedTrain,
      activeScenario,
      lastTickTime,
      engineSource,
      audioEnabled,
      setAudioEnabled,
      isSimulationPaused,
      isPausedForConflict,
      speedMultiplier,
      toggleSimulationPause,
      setSimulationSpeed,
      stepSimulationOnce,
      submitDecision,
      runWhatIf,
      injectScenario,
      fetchPlatformStatus,
      fetchWeather
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
