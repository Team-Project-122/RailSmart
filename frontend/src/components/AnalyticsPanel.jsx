import React from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  BarChart3, TrendingUp, CheckCircle2, XCircle, 
  ShieldCheck, Clock, FileText, AlertTriangle 
} from 'lucide-react';

export const AnalyticsPanel = () => {
  const { trustScoreData, historicalTrends } = useSocket();

  const trustScore = trustScoreData?.trust_score_percent || 94;
  const totalDecisions = trustScoreData?.total_decisions || 12;
  const acceptedCount = trustScoreData?.accepted_count || 11;
  const rejectedCount = totalDecisions - acceptedCount;

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Operator Trust Score & Corridor Analytics
            </h2>
            <span className="simulated-badge">Operator Telemetry & Synthetic Trends [Simulated]</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time compliance tracking, operator decision audit trails, and historical punctuality modeling.
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="card-panel-elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>System Trust Score</span>
            <ShieldCheck size={18} color="var(--status-success)" />
          </div>
          <div className="mono" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--status-success)', marginTop: '6px' }}>
            {trustScore}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            % Recommendations Accepted
          </div>
        </div>

        <div className="card-panel-elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Decisions Accepted</span>
            <CheckCircle2 size={18} color="var(--status-success)" />
          </div>
          <div className="mono" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px' }}>
            {acceptedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Rule engine resolutions applied
          </div>
        </div>

        <div className="card-panel-elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manual Overrides / Rejections</span>
            <XCircle size={18} color="var(--status-warning)" />
          </div>
          <div className="mono" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--status-warning)', marginTop: '6px' }}>
            {rejectedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Dispatcher custom overrides
          </div>
        </div>

        <div className="card-panel-elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Corridor Delay</span>
            <Clock size={18} color="var(--accent-orange)" />
          </div>
          <div className="mono" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--accent-orange-light)', marginTop: '6px' }}>
            11.8 min
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Across 9 Corridor Stations
          </div>
        </div>
      </div>

      {/* Synthetic Historical Trend Chart (Clearly Labeled) */}
      <div style={{
        background: 'var(--bg-card-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              7-Day Corridor Punctuality & Conflict Resolution History
            </h3>
            <span className="simulated-badge">Simulated Historical Trend for Demonstration</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>NCR Mainline Golden Corridor</span>
        </div>

        {/* Bar Chart Visualization */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '140px', paddingTop: '10px' }}>
          {historicalTrends.map((t) => {
            const barHeight = Math.max(20, Math.round((t.avg_punctuality_percent - 60) * 3));
            return (
              <div key={t.trend_id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {t.avg_punctuality_percent}%
                </div>
                <div
                  style={{
                    width: '100%',
                    height: `${barHeight}px`,
                    background: t.avg_punctuality_percent > 90 ? 'var(--status-success)' : (t.avg_punctuality_percent > 80 ? 'var(--accent-orange)' : 'var(--status-danger)'),
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }}
                  title={`${t.date}: ${t.avg_punctuality_percent}% Punctuality, ${t.conflicts_resolved_count} conflicts resolved`}
                />
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {t.date.substring(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Audit Trail Log */}
      <div style={{
        background: 'var(--bg-main)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} color="var(--accent-orange)" />
          <span>Recent Dispatcher Decision Audit Trail</span>
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>Timestamp</th>
                <th style={{ padding: '8px' }}>Conflict Reference</th>
                <th style={{ padding: '8px' }}>Strategy Selected</th>
                <th style={{ padding: '8px' }}>Operator Action</th>
                <th style={{ padding: '8px' }}>Instruction / Operational Note</th>
              </tr>
            </thead>
            <tbody>
              {trustScoreData.recent_logs?.length > 0 ? (
                trustScoreData.recent_logs.map((log) => (
                  <tr key={log.log_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono" style={{ padding: '8px', color: 'var(--text-dim)', fontSize: '11px' }}>
                      {log.timestamp?.substring(11, 19) || 'Just now'}
                    </td>
                    <td className="mono" style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                      {log.conflict_id}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--accent-orange-light)', fontWeight: '600' }}>
                      {log.selected_option_id}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: log.action === 'ACCEPTED' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                        color: log.action === 'ACCEPTED' ? 'var(--status-success)' : 'var(--status-warning)',
                        fontSize: '10px',
                        fontWeight: '700'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {log.notes || 'Executed without operator notes'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No decisions logged yet in this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
