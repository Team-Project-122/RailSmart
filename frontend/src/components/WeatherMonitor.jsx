import React from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  CloudSun, Eye, Thermometer, Wind, AlertTriangle, 
  ShieldCheck, ShieldAlert, Zap, Compass, RefreshCw
} from 'lucide-react';

export const WeatherMonitor = () => {
  const { weatherData, fetchWeather } = useSocket();

  // Evaluate IR Safety Rule for a given weather snapshot
  const getSafetyRegulation = (w) => {
    const vis = w.visibility_m || 5000;
    const temp = w.temp_c || 28;
    const cond = (w.condition || 'CLEAR').toUpperCase();

    if (vis < 200) {
      return {
        ruleId: 'IR-WX-FOG-01',
        name: 'Severe Fog Safety Cap',
        speedCap: '60 km/h',
        severity: 'HIGH',
        reason: 'Visibility < 200m: Mandatory FOGSAFE device speed restriction to prevent signal overrun.'
      };
    }
    if (vis < 500) {
      return {
        ruleId: 'IR-WX-FOG-02',
        name: 'Moderate Fog/Mist Speed Restriction',
        speedCap: '75 km/h',
        severity: 'MEDIUM',
        reason: 'Visibility 200m–500m: Reduced speed to maintain extended emergency braking distance.'
      };
    }
    if (cond === 'RAIN' || cond === 'THUNDERSTORM' || cond === 'TORNADO') {
      return {
        ruleId: 'IR-WX-PRECIP-01',
        name: 'Heavy Rain / Hydroplaning Caution',
        speedCap: '80% Max Speed',
        severity: 'MEDIUM',
        reason: 'Wet rail friction loss: Speed capped to 80% of sectional limit.'
      };
    }
    if (temp > 45) {
      return {
        ruleId: 'IR-WX-HEAT-01',
        name: 'Continuous Welded Rail Heat Caution',
        speedCap: '85% Max Speed',
        severity: 'LOW',
        reason: 'Ambient Temp > 45°C: High risk of thermal rail expansion and track buckling.'
      };
    }

    return {
      ruleId: 'IR-WX-NOMINAL',
      name: 'Normal Track Conditions',
      speedCap: 'No Restriction',
      severity: 'NONE',
      reason: 'Standard line speed permissible per locomotive class limits.'
    };
  };

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Corridor Weather & Indian Railways Speed Regulations
            </h2>
            <span className="simulated-badge">OpenWeatherMap Live + IR Safety Circulars</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time atmospheric observations dynamically driving locomotive speed caps along the corridor.
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => fetchWeather()}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <RefreshCw size={13} />
          <span>Refresh Weather</span>
        </button>
      </div>

      {/* Safety Circular Rules Reference Bar */}
      <div style={{
        background: 'var(--bg-main)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        fontSize: '11px'
      }}>
        <div style={{ borderLeft: '3px solid var(--status-danger)', paddingLeft: '8px' }}>
          <strong style={{ color: 'var(--status-danger)' }}>Dense Fog (&lt;200m):</strong> Cap at 60 km/h
        </div>
        <div style={{ borderLeft: '3px solid var(--status-warning)', paddingLeft: '8px' }}>
          <strong style={{ color: 'var(--status-warning)' }}>Moderate Mist (&lt;500m):</strong> Cap at 75 km/h
        </div>
        <div style={{ borderLeft: '3px solid var(--status-info)', paddingLeft: '8px' }}>
          <strong style={{ color: 'var(--status-info)' }}>Heavy Rain:</strong> 80% Sectional Speed
        </div>
        <div style={{ borderLeft: '3px solid var(--accent-orange)', paddingLeft: '8px' }}>
          <strong style={{ color: 'var(--accent-orange)' }}>Heat (&gt;45°C):</strong> 85% (Rail Expansion)
        </div>
      </div>

      {/* Station Weather Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {weatherData.map((w) => {
          const reg = getSafetyRegulation(w);
          const hasRestriction = reg.severity !== 'NONE';

          return (
            <div
              key={w.station_code}
              className="card-panel-elevated"
              style={{
                borderLeft: `4px solid ${hasRestriction ? (reg.severity === 'HIGH' ? 'var(--status-danger)' : 'var(--status-warning)') : 'var(--status-success)'}`,
                padding: '16px'
              }}
            >
              {/* Station & Condition */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 className="mono" style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {w.station_code}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.station_name}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {w.condition} — {w.description}
                  </span>
                </div>

                <span style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '10px',
                  fontWeight: '700',
                  background: hasRestriction ? (reg.severity === 'HIGH' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)') : 'var(--status-success-bg)',
                  color: hasRestriction ? (reg.severity === 'HIGH' ? 'var(--status-danger)' : 'var(--status-warning)') : 'var(--status-success)'
                }}>
                  {hasRestriction ? `${reg.speedCap}` : 'NORMAL'}
                </span>
              </div>

              {/* Atmospheric Metrics Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'var(--bg-main)',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '12px',
                fontSize: '11px'
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={12} /> Vis
                  </div>
                  <strong className="mono" style={{ color: w.visibility_m < 500 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                    {w.visibility_m}m
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Thermometer size={12} /> Temp
                  </div>
                  <strong className="mono" style={{ color: w.temp_c > 45 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                    {w.temp_c}°C
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Wind size={12} /> Wind
                  </div>
                  <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                    {w.wind_speed_kmh}k/h
                  </strong>
                </div>
              </div>

              {/* Active Rule Enforcement Explanation */}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <strong style={{ color: hasRestriction ? 'var(--accent-orange)' : 'var(--status-success)' }}>
                  [{reg.ruleId}] {reg.name}:
                </strong>{' '}
                {reg.reason}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
