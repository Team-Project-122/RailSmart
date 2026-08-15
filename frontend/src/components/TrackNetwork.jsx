import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  Train, AlertCircle, CheckCircle2, Clock, 
  MapPin, ShieldAlert, Thermometer, Wind, Eye, 
  ChevronRight, Compass, Maximize2, Zap, Pause, Play, 
  SkipForward, GitFork, ArrowRight, ArrowLeft, RefreshCw
} from 'lucide-react';

const STATIONS = [
  { code: 'NDLS', name: 'New Delhi', x: 70, y: 180, isJunction: true, platforms: 16 },
  { code: 'GZB', name: 'Ghaziabad Jn', x: 190, y: 180, isJunction: true, platforms: 6 },
  { code: 'ALJN', name: 'Aligarh Jn', x: 320, y: 180, isJunction: true, platforms: 7 },
  { code: 'TDL', name: 'Tundla Jn', x: 440, y: 180, isJunction: true, platforms: 5 },
  { code: 'CNB', name: 'Kanpur Central', x: 570, y: 180, isJunction: true, platforms: 10 },
  { code: 'PRYJ', name: 'Prayagraj Jn', x: 710, y: 180, isJunction: true, platforms: 10 },
  { code: 'DDU', name: 'Pt DD Upadhyaya', x: 840, y: 180, isJunction: true, platforms: 8 },
  { code: 'PNBE', name: 'Patna Jn', x: 970, y: 180, isJunction: true, platforms: 10 },
  { code: 'HWH', name: 'Howrah Jn', x: 1110, y: 180, isJunction: true, platforms: 23 }
];

export const TrackNetwork = () => {
  const { 
    trains, conflicts, weatherData, selectedTrain, setSelectedTrain,
    isSimulationPaused, isPausedForConflict, speedMultiplier,
    toggleSimulationPause, setSimulationSpeed, stepSimulationOnce
  } = useSocket();

  const [hoveredTrain, setHoveredTrain] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');

  const stationMap = new Map(STATIONS.map(s => [s.code, s]));

  // Calculate interpolated X and Y on track for a given train run
  const calculateTrainCoords = (train) => {
    const prevStn = stationMap.get(train.prev_station || 'NDLS') || STATIONS[0];
    const nextStn = stationMap.get(train.next_station || 'HWH') || STATIONS[1];
    const progress = Math.max(0.02, Math.min(0.98, train.block_progress || 0.5));

    const isUp = train.direction === 'UP';
    const isOnLoop = train.is_on_loop || (train.current_block_id && train.current_block_id.endsWith('-LOOP'));

    // Position calculation
    let trackYOffset = isUp ? -24 : 24;
    if (isOnLoop) {
      trackYOffset = isUp ? -52 : 52; // Shifted onto loop siding track geometry
    }

    const x = prevStn.x + (nextStn.x - prevStn.x) * (isUp ? (1 - progress) : progress);
    const y = prevStn.y + trackYOffset;

    return { x, y, isOnLoop, isUp };
  };

  // Determine train alert severity & resolution state
  const getTrainSeverityState = (train) => {
    const relatedConflict = conflicts.find(c => 
      c.train_a?.number === train.number || c.train_b?.number === train.number
    );

    if (relatedConflict) {
      if (relatedConflict.status === 'ACTIVE') return 'DANGER'; // RED
      if (relatedConflict.status === 'RESOLVING') return 'RESOLVING'; // AMBER PULSING
      if (relatedConflict.status === 'CLEARED') return 'CLEARED'; // GREEN
    }

    if (train.is_held || (train.hold_remaining_mins && train.hold_remaining_mins > 0)) {
      return 'HELD'; // STATIONARY PAUSE
    }

    if (train.speed_capped || (train.is_on_loop)) {
      return 'SPEED_CAPPED'; // REGULATED / LOOP
    }

    return 'NORMAL'; // IN-MOTION ORANGE
  };

  // Get train class badge style
  const getTrainClassLabel = (trainClass) => {
    switch (trainClass) {
      case 'VANDE_BHARAT': return { label: 'VB', color: '#FF6B1A', bg: 'rgba(255, 107, 26, 0.2)' };
      case 'RAJDHANI_SHATABDI': return { label: 'RAJ/SHT', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' };
      case 'SUPERFAST': return { label: 'SF', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.2)' };
      case 'MAIL_EXPRESS': return { label: 'EXP', color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' };
      case 'FREIGHT': return { label: 'GOODS', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.2)' };
      default: return { label: 'PASS', color: '#64748B', bg: 'rgba(100, 116, 139, 0.2)' };
    }
  };

  const filteredTrains = trains.filter(t => {
    if (activeFilter === 'CONFLICTS') {
      return conflicts.some(c => c.train_a?.number === t.number || c.train_b?.number === t.number);
    }
    if (activeFilter === 'PREMIER') {
      return t.class === 'VANDE_BHARAT' || t.class === 'RAJDHANI_SHATABDI';
    }
    if (activeFilter === 'FREIGHT') {
      return t.class === 'FREIGHT';
    }
    return true;
  });

  return (
    <div className="card-panel" style={{ padding: '20px', minHeight: '560px', position: 'relative' }}>
      {/* Top Track Controls, Live Simulation Ticker & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Delhi - Howrah Golden Corridor Schematic
            </h2>
            <span className="simulated-badge">Simulated Block Sections & Turnout Switches</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Real-Time Train Movement Interpolation with Turnout Crossover Tracks & Automatic Conflict Pause
          </p>
        </div>

        {/* Live Simulation Playback & Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)' }}>
          {/* Play / Pause Toggle */}
          <button
            onClick={toggleSimulationPause}
            style={{
              background: isSimulationPaused ? 'var(--status-warning-bg)' : 'var(--status-success-bg)',
              color: isSimulationPaused ? 'var(--status-warning)' : 'var(--status-success)',
              border: `1px solid ${isSimulationPaused ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            {isSimulationPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
            <span>{isSimulationPaused ? 'Resume Motion' : 'Pause'}</span>
          </button>

          {/* Step Once */}
          <button
            onClick={stepSimulationOnce}
            disabled={!isSimulationPaused}
            style={{
              background: 'transparent',
              color: isSimulationPaused ? 'var(--text-primary)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              cursor: isSimulationPaused ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Step 1 Tick forward"
          >
            <SkipForward size={12} />
            <span>Step</span>
          </button>

          {/* Speed Multipliers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '8px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Speed:</span>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimulationSpeed(spd)}
                style={{
                  background: speedMultiplier === spd ? 'var(--accent-orange)' : 'var(--bg-card-elevated)',
                  color: speedMultiplier === spd ? '#FFF' : 'var(--text-muted)',
                  border: 'none',
                  padding: '3px 7px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-Paused for Conflict Banner */}
      {isPausedForConflict && (
        <div className="animate-fade-in" style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--status-danger)',
          fontSize: '12px',
          fontWeight: '700'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="danger-pulse-dot" />
            <span>⚡ SIMULATION AUTO-PAUSED: Active Conflict Detected. Trains frozen before collision. Select an option below to apply and resume.</span>
          </div>
          <span className="mono" style={{ fontSize: '11px', opacity: 0.9 }}>DISPATCHER ACTION REQUIRED</span>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'ALL', label: `All Running (${trains.length})` },
            { id: 'CONFLICTS', label: `Conflicts (${conflicts.length})`, highlight: conflicts.length > 0 },
            { id: 'PREMIER', label: 'Premier Express' },
            { id: 'FREIGHT', label: 'Freight Rakes' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(btn.id)}
              style={{
                background: activeFilter === btn.id ? 'var(--accent-orange)' : 'var(--bg-card-elevated)',
                color: activeFilter === btn.id ? '#FFF' : (btn.highlight ? 'var(--status-danger)' : 'var(--text-muted)'),
                border: `1px solid ${btn.highlight ? 'rgba(239,68,68,0.4)' : 'var(--border-strong)'}`,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowRight size={12} color="var(--accent-orange)" /> <strong>DN Line (Eastward ▶)</strong>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={12} color="#3B82F6" /> <strong>UP Line (Westward ◀)</strong>
          </span>
        </div>
      </div>

      {/* SVG Interactive Track Network Diagram */}
      <div style={{
        background: '#07090E',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 0',
        overflowX: 'auto',
        position: 'relative'
      }}>
        <svg viewBox="0 0 1180 350" style={{ width: '100%', minWidth: '950px', height: '350px' }}>
          <defs>
            <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            <filter id="glowOrange" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Track Labels */}
          <text x="45" y="126" fill="#3B82F6" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700">◀ UP MAINLINE (HWH → NDLS)</text>
          <text x="45" y="218" fill="var(--accent-orange)" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700">▶ DN MAINLINE (NDLS → HWH)</text>
          <text x="45" y="270" fill="#06B6D4" fontSize="8.5" fontFamily="JetBrains Mono">PASSING LOOP & SIDING TURNOUTS [TURNOUT 1:12 SPEED 30 KM/H]</text>

          {/* Track 1: UP Line (y=156) */}
          <line x1="60" y1="156" x2="1120" y2="156" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
          <line x1="60" y1="156" x2="1120" y2="156" stroke="#334155" strokeWidth="2" strokeDasharray="6,4" />

          {/* Track 2: DOWN Line (y=204) */}
          <line x1="60" y1="204" x2="1120" y2="204" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
          <line x1="60" y1="204" x2="1120" y2="204" stroke="#334155" strokeWidth="2" strokeDasharray="6,4" />

          {/* Turnout Crossover Switch Tracks at Stations (Connecting Mainline to Loop Sidings) */}
          {[190, 320, 440, 570, 710, 840].map((jx, idx) => {
            const hasLoopTrain = trains.some(t => 
              (t.is_on_loop || t.current_block_id?.endsWith('-LOOP')) &&
              (t.prev_station === STATIONS[idx + 1]?.code || t.next_station === STATIONS[idx + 1]?.code)
            );

            return (
              <g key={`turnout-system-${idx}`}>
                {/* Loop Line Siding Track (y=256) */}
                <path
                  d={`M ${jx - 65} 204 L ${jx - 35} 256 L ${jx + 35} 256 L ${jx + 65} 204`}
                  fill="none"
                  stroke={hasLoopTrain ? '#06B6D4' : '#1E293B'}
                  strokeWidth={hasLoopTrain ? '4' : '3.5'}
                  filter={hasLoopTrain ? 'url(#glowCyan)' : 'none'}
                />
                <path
                  d={`M ${jx - 65} 204 L ${jx - 35} 256 L ${jx + 35} 256 L ${jx + 65} 204`}
                  fill="none"
                  stroke={hasLoopTrain ? '#FFFFFF' : '#06B6D4'}
                  strokeWidth="1.5"
                  strokeDasharray={hasLoopTrain ? '4,2' : '4,4'}
                  opacity={hasLoopTrain ? '0.9' : '0.4'}
                />

                {/* Switch Frog & Points Visual Indicators */}
                <circle cx={jx - 65} cy={204} r="3" fill={hasLoopTrain ? '#06B6D4' : '#475569'} />
                <circle cx={jx + 65} cy={204} r="3" fill={hasLoopTrain ? '#06B6D4' : '#475569'} />

                {/* Turnout Label */}
                <text x={jx} y="270" fill={hasLoopTrain ? '#06B6D4' : '#64748B'} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600">
                  {hasLoopTrain ? '⚡ TURNOUT ACTIVE' : `Loop Siding ${idx + 1}`}
                </text>
              </g>
            );
          })}

          {/* Station Nodes and Vertical Platform Indicators */}
          {STATIONS.map((stn) => {
            const wx = weatherData.find(w => w.station_code === stn.code);
            const isFoggy = wx && wx.visibility_m < 500;

            return (
              <g key={stn.code}>
                {/* Station Pillar Line */}
                <line x1={stn.x} y1="110" x2={stn.x} y2="250" stroke="#1E293B" strokeWidth="2" strokeDasharray="2,2" />

                {/* Station Node Box */}
                <rect
                  x={stn.x - 28}
                  y="78"
                  width="56"
                  height="30"
                  rx="6"
                  fill="#141821"
                  stroke={isFoggy ? '#F59E0B' : '#2A3347'}
                  strokeWidth={isFoggy ? '1.5' : '1'}
                />

                <text
                  x={stn.x}
                  y="92"
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="JetBrains Mono"
                >
                  {stn.code}
                </text>

                <text
                  x={stn.x}
                  y="103"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="7.5"
                >
                  {stn.name.length > 10 ? stn.name.substring(0, 9) + '..' : stn.name}
                </text>

                {/* Platform Badge */}
                <rect
                  x={stn.x - 14}
                  y="112"
                  width="28"
                  height="12"
                  rx="3"
                  fill="rgba(148, 163, 184, 0.1)"
                  stroke="#334155"
                  strokeWidth="0.8"
                />
                <text
                  x={stn.x}
                  y="121"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="7"
                  fontWeight="600"
                  fontFamily="JetBrains Mono"
                >
                  {stn.platforms}P [S]
                </text>

                {/* Weather icon indicator */}
                {wx && (
                  <circle
                    cx={stn.x + 22}
                    cy="82"
                    r="4"
                    fill={isFoggy ? '#F59E0B' : (wx.condition === 'RAIN' ? '#06B6D4' : '#10B981')}
                  />
                )}

                {/* Simulated Signal Lamps at Stations */}
                <circle cx={stn.x - 18} cy="156" r="3.5" fill="#10B981" />
                <circle cx={stn.x + 18} cy="204" r="3.5" fill={isFoggy ? '#F59E0B' : '#10B981'} />
              </g>
            );
          })}

          {/* Render Active Trains on Tracks with Accurate Motion Interpolation and Direction Arrows */}
          {filteredTrains.map((train) => {
            const { x, y, isOnLoop, isUp } = calculateTrainCoords(train);
            const severityState = getTrainSeverityState(train);
            const classInfo = getTrainClassLabel(train.class);
            const isHovered = hoveredTrain?.number === train.number;
            const isSelected = selectedTrain?.number === train.number;

            const isDanger = severityState === 'DANGER';
            const isResolving = severityState === 'RESOLVING';
            const isHeld = severityState === 'HELD' || train.is_held;
            const isSpeedCapped = severityState === 'SPEED_CAPPED' || train.speed_capped;

            return (
              <g
                key={train.number}
                transform={`translate(${x}, ${y})`}
                style={{ 
                  cursor: 'pointer', 
                  transition: 'transform 0.9s linear',
                  willChange: 'transform'
                }}
                onMouseEnter={() => setHoveredTrain(train)}
                onMouseLeave={() => setHoveredTrain(null)}
                onClick={() => setSelectedTrain(train)}
              >
                {/* Visual State 1: Active Danger Aura (Red Pulsing) */}
                {isDanger && (
                  <circle
                    r="24"
                    fill="rgba(239, 68, 68, 0.25)"
                    stroke="#EF4444"
                    strokeWidth="1.8"
                    strokeDasharray="3,3"
                    className="danger-pulse-dot"
                    style={{ animationDuration: '1.2s' }}
                  />
                )}

                {/* Visual State 2: Resolution In-Progress Aura (Amber Pulsing) */}
                {isResolving && (
                  <circle
                    r="24"
                    fill="rgba(245, 158, 11, 0.2)"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />
                )}

                {/* Visual State 3: Held Stationary Halo (Pause Halo) */}
                {isHeld && (
                  <rect
                    x="-28"
                    y="-16"
                    width="56"
                    height="32"
                    rx="8"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                )}

                {/* Train Carriage Capsule */}
                <rect
                  x="-24"
                  y="-12"
                  width="48"
                  height="24"
                  rx="6"
                  fill={isDanger ? '#450A0A' : (isResolving ? '#451A03' : (isOnLoop ? '#083344' : (isSelected ? '#1E293B' : '#0F172A')))}
                  stroke={isDanger ? '#EF4444' : (isResolving ? '#F59E0B' : (isOnLoop ? '#06B6D4' : (isSelected ? 'var(--accent-orange)' : '#334155')))}
                  strokeWidth={isDanger || isResolving || isSelected || isOnLoop ? '2' : '1.2'}
                  filter={isDanger ? 'url(#glowRed)' : (isResolving ? 'url(#glowAmber)' : (isSelected ? 'url(#glowOrange)' : 'none'))}
                />

                {/* Train Direction Arrow Head Pointer on Front of Train */}
                {isUp ? (
                  // UP Direction: Heading Left (Westward)
                  <path
                    d="M -24 -6 L -31 0 L -24 6 Z"
                    fill={isDanger ? '#EF4444' : (isOnLoop ? '#06B6D4' : '#3B82F6')}
                  />
                ) : (
                  // DN Direction: Heading Right (Eastward)
                  <path
                    d="M 24 -6 L 31 0 L 24 6 Z"
                    fill={isDanger ? '#EF4444' : (isOnLoop ? '#06B6D4' : 'var(--accent-orange)')}
                  />
                )}

                {/* Train Category Pill */}
                <rect
                  x="-22"
                  y="-10"
                  width="18"
                  height="9"
                  rx="3"
                  fill={classInfo.bg}
                />
                <text
                  x="-13"
                  y="-3"
                  textAnchor="middle"
                  fill={classInfo.color}
                  fontSize="6.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono"
                >
                  {classInfo.label}
                </text>

                {/* Train Number */}
                <text
                  x="4"
                  y="-3"
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="7.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono"
                >
                  {train.number.substring(0, 5)}
                </text>

                {/* Dynamic Status / Speed & Direction Subtext */}
                <text
                  x="0"
                  y="8"
                  textAnchor="middle"
                  fill={isHeld ? '#F59E0B' : (isOnLoop ? '#06B6D4' : '#94A3B8')}
                  fontSize="7"
                  fontWeight="700"
                  fontFamily="JetBrains Mono"
                >
                  {isHeld 
                    ? `HOLD ${train.hold_remaining_mins ? train.hold_remaining_mins.toFixed(1) + 'm' : ''}` 
                    : (isOnLoop ? 'LOOP 30k' : (isSpeedCapped ? `CAP ${Math.round(train.speed_kmh)}k` : `${isUp ? '◀' : ''} ${Math.round(train.speed_kmh)}k ${!isUp ? '▶' : ''}`))
                  }
                </text>

                {/* Status Indicator Icon Dot */}
                <circle
                  cx="18"
                  cy="-7"
                  r="2.5"
                  fill={isDanger ? '#EF4444' : (isResolving ? '#F59E0B' : (isHeld ? '#F59E0B' : (isOnLoop ? '#06B6D4' : '#FF6B1A')))}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover / Selected Train Inspector Tooltip */}
        {(hoveredTrain || selectedTrain) && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '16px',
            background: 'var(--bg-card-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
            zIndex: 10
          }}>
            {(() => {
              const t = hoveredTrain || selectedTrain;
              const relatedConf = conflicts.find(c => c.train_a?.number === t.number || c.train_b?.number === t.number);
              const isOnLoop = t.is_on_loop || (t.current_block_id && t.current_block_id.endsWith('-LOOP'));
              const isUp = t.direction === 'UP';

              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-sm)',
                      background: relatedConf?.status === 'ACTIVE' ? 'var(--status-danger-bg)' : (isOnLoop ? 'var(--status-info-bg)' : 'rgba(255,107,26,0.15)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: relatedConf?.status === 'ACTIVE' ? 'var(--status-danger)' : (isOnLoop ? 'var(--status-info)' : 'var(--accent-orange)')
                    }}>
                      <Train size={16} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{t.number}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.name}</span>
                        <span className="simulated-badge" style={{ color: isUp ? '#3B82F6' : 'var(--accent-orange)', borderColor: isUp ? '#3B82F6' : 'var(--accent-orange)' }}>
                          {isUp ? '◀ UP (Westward)' : 'DN (Eastward) ▶'}
                        </span>
                        {isOnLoop && <span className="simulated-badge" style={{ color: 'var(--status-info)', borderColor: 'var(--status-info)' }}>ON LOOP TRACK</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Class: <strong>{t.class}</strong> (IR Rank: {t.priority_rank || 1})
                      </div>
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Current Speed / Block:</div>
                    <div className="mono" style={{ fontWeight: '700', color: t.is_held ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                      {t.is_held 
                        ? `0 km/h (HELD — ${t.hold_remaining_mins ? t.hold_remaining_mins.toFixed(1) + ' min left' : 'Signal Hold'})` 
                        : `${Math.round(t.speed_kmh)} km/h ${t.speed_capped ? '[SPEED REGULATED]' : ''}`
                      } | {t.current_block_id || 'Corridor'}
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Next Station & ETA:</div>
                    <div style={{ fontWeight: '600', color: 'var(--accent-orange-light)' }}>
                      {t.next_station} (~{t.eta_next_station_mins || 10} min / {t.distance_to_next_km || 15} km)
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Live Delay:</div>
                    <div className="mono" style={{ fontWeight: '700', color: t.live_delay_minutes > 10 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                      +{t.live_delay_minutes || 0} min
                    </div>
                  </div>

                  {relatedConf && (
                    <div style={{
                      padding: '4px 8px',
                      background: relatedConf.status === 'RESOLVING' ? 'var(--status-warning-bg)' : 'var(--status-danger-bg)',
                      border: `1px solid ${relatedConf.status === 'RESOLVING' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: relatedConf.status === 'RESOLVING' ? 'var(--status-warning)' : 'var(--status-danger)',
                      fontSize: '11px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={13} />
                      <span>{relatedConf.status === 'RESOLVING' ? 'RESOLUTION IN PROGRESS' : 'CONFLICT ACTIVE — SIMULATION FROZEN'}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Legend & Safety Standards Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-danger)' }} />
            <span>Active Conflict (Yield Required)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-warning)' }} />
            <span>Resolution In-Progress / Held</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-info)' }} />
            <span>Loop Siding Turnout Track</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-orange)' }} />
            <span>Normal Live Running</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <span>Direction: <strong>DN (▶ East) / UP (◀ West)</strong></span>
          <span>Safety Headway: <strong>≥ 2.5 km</strong></span>
          <span>Turnout Speed: <strong>30 km/h</strong></span>
        </div>
      </div>
    </div>
  );
};
