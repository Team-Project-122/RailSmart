import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  Activity, AlertTriangle, ShieldCheck, Zap, 
  Layers, CloudSun, Radio, BarChart3, RotateCcw, 
  Volume2, VolumeX, Info, GitBranch
} from 'lucide-react';

export const Header = ({ activeTab, setActiveTab }) => {
  const { 
    connectionStatus, conflicts, trustScoreData, 
    lastTickTime, engineSource, audioEnabled, 
    setAudioEnabled, injectScenario, activeScenario 
  } = useSocket();

  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showHonestyModal, setShowHonestyModal] = useState(false);

  const activeConflictsCount = conflicts.length;

  return (
    <header style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand & System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #FF6B1A, #FF8C42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px var(--accent-orange-glow)'
          }}>
            <Zap size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                RAIL<span style={{ color: 'var(--accent-orange)' }}>SMART</span>
              </h1>
              <span className="simulated-badge">SIH Edition</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              AI-Assisted Train Traffic Control & Decision Support
            </p>
          </div>
        </div>

        {/* Live Link Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: connectionStatus === 'ONLINE' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            border: `1px solid ${connectionStatus === 'ONLINE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            <div className={connectionStatus === 'ONLINE' ? 'success-dot' : 'danger-pulse-dot'} />
            <span style={{ color: connectionStatus === 'ONLINE' ? 'var(--status-success)' : 'var(--status-danger)' }}>
              {connectionStatus === 'ONLINE' ? 'TELEMETRY LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: 'rgba(255, 107, 26, 0.1)',
            border: '1px solid rgba(255, 107, 26, 0.25)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--accent-orange-light)',
            fontWeight: '500'
          }}>
            <Radio size={13} />
            <span>Rule & Risk Engine: <strong style={{ color: '#FFF' }}>IR-G&SR Rules</strong></span>
          </div>

          <button 
            onClick={() => setShowHonestyModal(!showHonestyModal)}
            style={{
              background: 'transparent',
              border: '1px dashed var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="View Data Integrity & Scope Disclosure"
          >
            <Info size={12} />
            <span>Data Transparency Note</span>
          </button>
        </div>
      </div>

      {/* Navigation View Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        {[
          { id: 'corridor', label: 'Corridor Topology', icon: Activity },
          { id: 'whatif', label: 'Cascading What-If', icon: GitBranch },
          { id: 'platforms', label: 'Platform Bays [Sim]', icon: Layers },
          { id: 'weather', label: 'Weather & Speed Caps', icon: CloudSun },
          { id: 'analytics', label: 'Trust & Analytics', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isActive ? 'var(--bg-card-elevated)' : 'transparent',
                color: isActive ? 'var(--accent-orange)' : 'var(--text-muted)',
                fontWeight: isActive ? '600' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Action Controls & Metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Conflict Warning Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: activeConflictsCount > 0 ? 'var(--status-danger-bg)' : 'var(--status-success-bg)',
          border: `1px solid ${activeConflictsCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: 'var(--radius-md)'
        }}>
          {activeConflictsCount > 0 ? (
            <div className="danger-pulse-dot" />
          ) : (
            <ShieldCheck size={16} color="var(--status-success)" />
          )}
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: activeConflictsCount > 0 ? 'var(--status-danger)' : 'var(--status-success)'
          }}>
            {activeConflictsCount > 0 ? `${activeConflictsCount} ACTIVE CONFLICT${activeConflictsCount > 1 ? 'S' : ''}` : 'CORRIDOR CLEAR'}
          </span>
        </div>

        {/* Operator Trust Score */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-card-elevated)',
          border: '1px solid var(--border-subtle)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trust Score:</span>
          <span className="mono" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--status-success)' }}>
            {trustScoreData.trust_score_percent}%
          </span>
        </div>

        {/* 1-Click Interactive Demo Scenarios */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-primary"
            onClick={() => setShowScenarioMenu(!showScenarioMenu)}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Zap size={14} />
            <span>Demo Scenarios</span>
          </button>

          {showScenarioMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '260px',
              background: 'var(--bg-card-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 200
            }}>
              <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                INJECT TEST SCENARIO
              </div>
              <button 
                onClick={() => { injectScenario('SCENARIO_OVERTAKE'); setShowScenarioMenu(false); }}
                style={scenarioItemStyle}
              >
                <strong>⚡ Scenario 1: Overtake</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vande Bharat overtakes Freight in Kanpur Outer</span>
              </button>
              <button 
                onClick={() => { injectScenario('SCENARIO_FOG_NCR'); setShowScenarioMenu(false); }}
                style={scenarioItemStyle}
              >
                <strong>🌫️ Scenario 2: Dense Fog</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Visibility 150m (Ghaziabad-Aligarh speed cap)</span>
              </button>
              <button 
                onClick={() => { injectScenario('SCENARIO_PLATFORM_BOTTLENECK'); setShowScenarioMenu(false); }}
                style={scenarioItemStyle}
              >
                <strong>🚉 Scenario 3: Platform Bottleneck</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Simultaneous arrival on same platform at Kanpur</span>
              </button>
              <button 
                onClick={() => { injectScenario('SCENARIO_HEADON_SINGLE_LINE'); setShowScenarioMenu(false); }}
                style={scenarioItemStyle}
              >
                <strong>⚡ Scenario 4: Head-On Single Line</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Opposing traffic on single track (Forces Hold/Siding)</span>
              </button>
              <button 
                onClick={() => { injectScenario('SCENARIO_CASCADING_FREIGHT_BACKUP'); setShowScenarioMenu(false); }}
                style={scenarioItemStyle}
              >
                <strong>🚂 Scenario 5: Cascading Freight Backup</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Multi-block queue for What-If cascade testing</span>
              </button>
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
              <button 
                onClick={() => { injectScenario('RESET'); setShowScenarioMenu(false); }}
                style={{ ...scenarioItemStyle, color: 'var(--accent-orange-light)' }}
              >
                <RotateCcw size={12} />
                <span>Reset Simulation to Baseline</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Data Transparency & Scope Modal */}
      {showHonestyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300
        }}>
          <div className="card-panel-elevated" style={{ maxWidth: '560px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--accent-orange)" />
              <span>RailSmart Data Architecture & Integrity Statement</span>
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
              To maintain complete technical honesty, Indian Railways does not expose public APIs for internal signaling circuits or real-time interlocking platform states.
            </p>
            <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--status-success)' }}>✓ Real & Live Ingested:</strong> Train schedules, current GPS coordinates, live running delays via RailRadar, and live atmospheric visibility & temperatures via OpenWeatherMap.
              </div>
              <div>
                <strong style={{ color: 'var(--accent-orange)' }}>⚠ Explicitly Simulated Subsystems:</strong> Block section track graphs, signal aspects (derived from train headways), and station platform allocations (LRU heuristic).
              </div>
            </div>
            <button className="btn-primary" onClick={() => setShowHonestyModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
              Understood
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

const scenarioItemStyle = {
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '8px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  transition: 'background 0.15s ease'
};
