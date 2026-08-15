import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  GitBranch, Play, Clock, AlertTriangle, ShieldCheck, 
  TrendingUp, Activity, RotateCcw, ArrowRight, CornerDownRight
} from 'lucide-react';

export const WhatIfSimulator = ({ initialTrainNumber = null, initialDelay = 10 }) => {
  const { trains, runWhatIf } = useSocket();
  const [selectedTrainNo, setSelectedTrainNo] = useState(initialTrainNumber || (trains[0]?.number || '22436'));
  const [injectedDelay, setInjectedDelay] = useState(initialDelay);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (initialTrainNumber) {
      setSelectedTrainNo(initialTrainNumber);
      setInjectedDelay(initialDelay);
      handleExecuteSimulation(initialTrainNumber, initialDelay);
    }
  }, [initialTrainNumber, initialDelay]);

  const handleExecuteSimulation = async (tNum = selectedTrainNo, delay = injectedDelay) => {
    setIsSimulating(true);
    const result = await runWhatIf(tNum, delay);
    setSimulationResult(result);
    setIsSimulating(false);
  };

  const selectedTrain = trains.find(t => String(t.number) === String(selectedTrainNo)) || trains[0];

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Cascading Delay Propagation Simulator
            </h2>
            <span className="simulated-badge">Deterministic Graph Propagation [Simulated]</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Evaluate downstream knock-on delays and track congestion impacts before committing dispatch actions.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => handleExecuteSimulation()}
          disabled={isSimulating}
          style={{ padding: '8px 16px' }}
        >
          <Play size={14} />
          <span>{isSimulating ? 'Propagating...' : 'Run What-If Simulation'}</span>
        </button>
      </div>

      {/* Control Playground Bar */}
      <div style={{
        background: 'var(--bg-card-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Train Selector */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            SELECT TARGET TRAIN TO DELAY / HOLD:
          </label>
          <select
            value={selectedTrainNo}
            onChange={(e) => setSelectedTrainNo(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {trains.map(t => (
              <option key={t.number} value={t.number}>
                {t.number} — {t.name} ({t.class})
              </option>
            ))}
          </select>
        </div>

        {/* Delay Injection Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
              INJECTED HOLD / DELAY:
            </label>
            <span className="mono" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-orange)' }}>
              +{injectedDelay} minutes
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="45"
            step="1"
            value={injectedDelay}
            onChange={(e) => setInjectedDelay(parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              accentColor: 'var(--accent-orange)',
              cursor: 'pointer'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
            <span>+1 min (Minor Turnout)</span>
            <span>+15 min (Loop Siding)</span>
            <span>+45 min (Section Block)</span>
          </div>
        </div>
      </div>

      {/* Simulation Results View */}
      {simulationResult && simulationResult.status === 'SUCCESS' && (
        <div className="animate-fade-in">
          {/* Summary Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <div style={{ background: 'var(--bg-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Direct Delay Injected</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-orange)' }}>
                +{simulationResult.network_impact_summary.direct_delay_mins} min
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Target: Train {simulationResult.target_train.train_number}</div>
            </div>

            <div style={{ background: 'var(--bg-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cascading Knock-On Added</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--status-danger)' }}>
                +{simulationResult.network_impact_summary.cascading_delay_added_mins} min
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Secondary affected trains</div>
            </div>

            <div style={{ background: 'var(--bg-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Total Network Delay</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>
                +{simulationResult.network_impact_summary.net_total_network_delay_mins} min
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Cumulative corridor loss</div>
            </div>

            <div style={{ background: 'var(--bg-card-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Network Stability Index</div>
              <div className="mono" style={{
                fontSize: '20px',
                fontWeight: '800',
                color: simulationResult.network_impact_summary.system_stability_index > 75 ? 'var(--status-success)' : 'var(--status-warning)'
              }}>
                {simulationResult.network_impact_summary.system_stability_index}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Resilience score</div>
            </div>
          </div>

          {/* Graph Propagation Tree */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '18px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={16} color="var(--accent-orange)" />
              <span>Downstream Propagation Dependency Tree</span>
            </h3>

            {/* Root Node (Injected Source) */}
            <div style={{
              background: 'var(--bg-card-elevated)',
              border: '1px solid var(--accent-orange)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: '800', color: '#FFF' }}>
                    Train {simulationResult.target_train.train_number}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{simulationResult.target_train.train_name}</span>
                  <span className="simulated-badge simulated-badge-orange">Primary Source</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Injected Hold: <strong>+{simulationResult.target_train.injected_delay_mins} min</strong> | Projected Total: <strong>+{simulationResult.target_train.projected_total_delay_mins} min</strong>
                </div>
              </div>

              <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-orange)' }}>
                +{simulationResult.target_train.injected_delay_mins} min
              </div>
            </div>

            {/* Cascading Victims */}
            {simulationResult.cascading_trains.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                ✓ No secondary knock-on delays projected on downstream corridor trains.
              </div>
            ) : (
              simulationResult.cascading_trains.map((victim) => (
                <div
                  key={victim.train_number}
                  style={{
                    marginLeft: '28px',
                    borderLeft: '2px solid var(--border-strong)',
                    paddingLeft: '16px',
                    marginBottom: '10px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    left: '-2px',
                    top: '14px',
                    width: '12px',
                    height: '2px',
                    background: 'var(--border-strong)'
                  }} />

                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          Train {victim.train_number}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{victim.train_name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>({victim.train_class})</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {victim.propagation_reason}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--status-danger)' }}>
                        +{victim.knock_on_delay_mins} min knock-on
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                        Total: +{victim.new_projected_delay_mins} min
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
