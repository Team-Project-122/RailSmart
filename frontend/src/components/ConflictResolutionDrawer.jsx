import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  AlertTriangle, Shield, CheckCircle2, XCircle, 
  ArrowRight, Clock, Gauge, GitFork, ChevronDown, 
  ChevronUp, Sparkles, HelpCircle, FileText, Zap,
  Loader2, RefreshCw
} from 'lucide-react';

export const ConflictResolutionDrawer = ({ onOpenWhatIf }) => {
  const { conflicts, resolutions, submitDecision } = useSocket();
  const [expandedTraceId, setExpandedTraceId] = useState(null);
  const [decisionFeedback, setDecisionFeedback] = useState(null);

  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="card-panel" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'var(--status-success-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px auto'
        }}>
          <CheckCircle2 size={24} color="var(--status-success)" />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
          All Corridor Blocks & Headways Clear
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
          Rule & Risk Engine is actively monitoring live train trajectories, platform windows, and weather safety caps. No active track conflicts.
        </p>
      </div>
    );
  }

  const handleSelectOption = (conflictId, option) => {
    submitDecision(conflictId, option);
    setDecisionFeedback({
      optionTitle: option.title,
      targetTrain: option.target_train_number,
      action: option.action_type
    });
    setTimeout(() => setDecisionFeedback(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {decisionFeedback && (
        <div className="animate-fade-in" style={{
          background: 'var(--status-success-bg)',
          border: '1px solid var(--status-success)',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--status-success)',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>Applied <strong>{decisionFeedback.optionTitle}</strong> on Train {decisionFeedback.targetTrain}. Telemetry and ETAs updating live.</span>
          </div>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>Logged to Trust Analytics</span>
        </div>
      )}

      {conflicts.map((conflict) => {
        const status = conflict.status || 'ACTIVE';
        const resolution = resolutions.find(r => r.conflict_id === conflict.conflict_id) || { options: [] };
        const options = resolution.options || [];

        // 1. CLEARED Conflict Card
        if (status === 'CLEARED') {
          return (
            <div
              key={conflict.conflict_id}
              className="card-panel-elevated animate-fade-in"
              style={{
                borderLeft: '4px solid var(--status-success)',
                background: 'rgba(16, 185, 129, 0.05)',
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--status-success-bg)',
                    color: 'var(--status-success)'
                  }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--status-success)' }}>
                        Conflict Cleared & Headway Restored
                      </h4>
                      <span className="simulated-badge" style={{ color: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                        SAFE CLEARANCE VERIFIED
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {conflict.location_label || conflict.location}: Trains have safely separated or passed onto distinct line blocks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // 2. RESOLVING Conflict Card (In-flight resolution)
        if (status === 'RESOLVING') {
          const selectedOpt = conflict.selected_option || {};
          const progress = conflict.resolution_progress || {};

          return (
            <div
              key={conflict.conflict_id}
              className="card-panel-elevated animate-fade-in"
              style={{
                borderLeft: '4px solid #F59E0B',
                background: 'rgba(245, 158, 11, 0.04)',
                padding: '18px 20px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B'
                  }}>
                    <RefreshCw size={20} className="spin" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#F59E0B' }}>
                        Resolution In-Progress: {selectedOpt.title || 'Operator Strategy Applied'}
                      </h4>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#F59E0B',
                        fontSize: '10px',
                        fontWeight: '700',
                        border: '1px solid rgba(245, 158, 11, 0.4)'
                      }}>
                        RESOLVING
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {progress.statusText || selectedOpt.instruction || 'Monitoring physical train spacing until safety distance is re-established.'}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location:</div>
                  <div className="mono" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-orange-light)' }}>
                    {conflict.location_label || conflict.location}
                  </div>
                </div>
              </div>

              {/* In-Flight Status Details */}
              <div style={{
                display: 'flex',
                gap: '12px',
                background: 'var(--bg-main)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11.5px',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Train: </span>
                  <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                    Train {selectedOpt.target_train_number || conflict.train_b?.number} ({selectedOpt.target_train_name || conflict.train_b?.name})
                  </strong>
                </div>

                {progress.holdRemainingMins !== undefined && progress.holdRemainingMins > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontWeight: '700' }}>
                    <Clock size={14} />
                    <span>Hold Remaining: {progress.holdRemainingMins.toFixed(1)} min</span>
                  </div>
                )}

                {progress.currentGapKm !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-orange-light)', fontWeight: '600' }}>
                    <Gauge size={14} />
                    <span>Current Gap: {progress.currentGapKm.toFixed(1)} km / Target: ≥ 2.5 km</span>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // 3. FAILED Conflict Card
        if (status === 'FAILED') {
          return (
            <div
              key={conflict.conflict_id}
              className="card-panel-elevated animate-fade-in"
              style={{
                borderLeft: '4px solid var(--status-danger)',
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <XCircle size={24} color="var(--status-danger)" />
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--status-danger)' }}>
                    Resolution Execution Failed: {conflict.failure_reason || 'Physical track constraint violated'}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Manual interlocking override required for {conflict.location_label || conflict.location}.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        // 4. ACTIVE Conflict Card (Shows feasible options)
        return (
          <div 
            key={conflict.conflict_id}
            className="card-panel-elevated animate-fade-in"
            style={{
              borderLeft: '4px solid var(--status-danger)',
              position: 'relative'
            }}
          >
            {/* Conflict Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '6px',
                  background: 'var(--status-danger-bg)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--status-danger)'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {conflict.type === 'SAME_BLOCK_OVERTAKE' ? 'Same-Track Overtake & Headway Compression' : (
                        conflict.type === 'PLATFORM_BOTTLENECK' ? 'Station Platform Allocation Bottleneck' : 'Opposing Head-On Conflict'
                      )}
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--status-danger-bg)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--status-danger)',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      {conflict.severity || 'CRITICAL'} SEVERITY
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {conflict.description}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location:</div>
                <div className="mono" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-orange-light)' }}>
                  {conflict.location_label || conflict.location}
                </div>
              </div>
            </div>

            {/* Indian Railways Priority Precedence Bar */}
            {resolution.priority_precedence && (
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={14} color="var(--accent-orange)" />
                  <span>
                    <strong>IR Priority Engine:</strong> Train {resolution.priority_precedence.winner_train?.number} ({resolution.priority_precedence.winner_train?.category_label}, Rank {resolution.priority_precedence.winner_train?.priority_rank}) takes precedence over Train {resolution.priority_precedence.yielding_train?.number} ({resolution.priority_precedence.yielding_train?.category_label}, Rank {resolution.priority_precedence.yielding_train?.priority_rank}).
                  </span>
                </div>
                <span className="simulated-badge">Rule IR-PR-01</span>
              </div>
            )}

            {/* Render Feasible Strategies */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="var(--accent-orange)" />
                <span>Physically Feasible Resolution Strategies ({options.length} Available):</span>
              </div>

              {options.length === 0 ? (
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--status-warning)' }}>
                  No automated strategies feasible. Manual interlocking dispatcher intervention required.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {options.map((opt) => {
                    const isHold = opt.action_type === 'HOLD';
                    const isSpeed = opt.action_type === 'SPEED_ADJUST';
                    const badgeColor = isHold ? '#EF4444' : (isSpeed ? '#F59E0B' : '#06B6D4');
                    const isTraceExpanded = expandedTraceId === `${conflict.conflict_id}-${opt.option_id}`;

                    return (
                      <div
                        key={opt.option_id}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                background: `${badgeColor}20`,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}40`
                              }}>
                                {opt.action_type}
                              </span>
                              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {opt.title}
                              </h4>
                            </div>
                          </div>

                          <div style={{
                            background: 'var(--bg-main)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.4',
                            marginBottom: '10px',
                            borderLeft: `3px solid ${badgeColor}`
                          }}>
                            {opt.instruction}
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Trade-off:</strong> {opt.trade_off_summary}
                          </div>

                          {opt.explainability_trace && (
                            <div style={{ marginBottom: '12px' }}>
                              <button
                                onClick={() => setExpandedTraceId(isTraceExpanded ? null : `${conflict.conflict_id}-${opt.option_id}`)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--accent-orange-light)',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: 0
                                }}
                              >
                                <FileText size={12} />
                                <span>{isTraceExpanded ? 'Hide Reasoning Trace' : 'View Reasoning Trace (Why?)'}</span>
                                {isTraceExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>

                              {isTraceExpanded && (
                                <div style={{
                                  marginTop: '8px',
                                  background: 'var(--bg-main)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '8px 10px',
                                  fontSize: '10.5px'
                                }}>
                                  <div style={{ fontWeight: '700', color: 'var(--accent-orange)', marginBottom: '6px' }}>
                                    Deterministic Reasoning Chain:
                                  </div>
                                  {opt.explainability_trace.steps?.map((step, sIdx) => (
                                    <div key={sIdx} style={{ marginBottom: '6px', borderBottom: sIdx < opt.explainability_trace.steps.length - 1 ? '1px solid var(--border-subtle)' : 'none', paddingBottom: '4px' }}>
                                      <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                        {step.step_name} <span className="mono" style={{ color: 'var(--accent-orange-light)', fontSize: '9.5px' }}>[{step.rule_id}]</span>
                                      </div>
                                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                        {step.reasoning}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            className="btn-primary"
                            onClick={() => handleSelectOption(conflict.conflict_id, opt)}
                            style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: '11.5px' }}
                            title="Execute strategy and unfreeze train progression"
                          >
                            <CheckCircle2 size={14} />
                            <span>Select & Apply Strategy</span>
                          </button>

                          <button
                            className="btn-secondary"
                            onClick={() => onOpenWhatIf && onOpenWhatIf(opt.target_train_number, opt.hold_duration_mins || 5)}
                            style={{ padding: '8px', fontSize: '11px' }}
                            title="Simulate in What-If mode before applying"
                          >
                            <Zap size={13} color="var(--accent-orange)" />
                            <span>What-If</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
