import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Layers, Clock, Train, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MAJOR_STATIONS = [
  { code: 'NDLS', name: 'New Delhi', platforms: 16 },
  { code: 'CNB', name: 'Kanpur Central', platforms: 10 },
  { code: 'PRYJ', name: 'Prayagraj Jn', platforms: 10 },
  { code: 'HWH', name: 'Howrah Jn', platforms: 23 },
  { code: 'GZB', name: 'Ghaziabad Jn', platforms: 6 },
  { code: 'ALJN', name: 'Aligarh Jn', platforms: 7 },
  { code: 'TDL', name: 'Tundla Jn', platforms: 5 },
  { code: 'DDU', name: 'Pt DD Upadhyaya', platforms: 8 },
  { code: 'PNBE', name: 'Patna Jn', platforms: 10 }
];

export const PlatformAllocationBoard = () => {
  const { fetchPlatformStatus } = useSocket();
  const [selectedStation, setSelectedStation] = useState('NDLS');
  const [platformData, setPlatformData] = useState({ platforms: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStationPlatforms(selectedStation);
  }, [selectedStation]);

  const loadStationPlatforms = async (code) => {
    setLoading(true);
    const data = await fetchPlatformStatus(code);
    setPlatformData(data);
    setLoading(false);
  };

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      {/* Header & Honesty Disclosure */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Station Platform Allocation Bays
            </h2>
            <span className="simulated-badge simulated-badge-orange">Heuristic LRU Allocator [Simulated]</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time bay occupancy and clearance schedules derived via Round-Robin & Train Priority heuristics.
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 107, 26, 0.08)',
          border: '1px dashed rgba(255, 107, 26, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 12px',
          fontSize: '11px',
          color: 'var(--accent-orange-light)',
          maxWidth: '380px'
        }}>
          <strong>Transparency Notice:</strong> Public APIs in India do not publish live platform assignments. This subsystem models realistic station dwell physics and platform counts.
        </div>
      </div>

      {/* Station Selector Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        {MAJOR_STATIONS.map((stn) => (
          <button
            key={stn.code}
            onClick={() => setSelectedStation(stn.code)}
            style={{
              background: selectedStation === stn.code ? 'var(--accent-orange)' : 'var(--bg-card-elevated)',
              color: selectedStation === stn.code ? '#FFF' : 'var(--text-secondary)',
              border: `1px solid ${selectedStation === stn.code ? 'var(--accent-orange)' : 'var(--border-strong)'}`,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{stn.name}</span>
            <span className="mono" style={{ fontSize: '10px', opacity: 0.8 }}>({stn.platforms}P)</span>
          </button>
        ))}
      </div>

      {/* Platform Bays Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {platformData.platforms?.map((plat) => {
          const isOccupied = plat.status === 'OCCUPIED';
          const isReserved = plat.status === 'RESERVED';
          const isVacant = plat.status === 'VACANT';

          const statusColor = isOccupied ? 'var(--status-danger)' : (isReserved ? 'var(--status-warning)' : 'var(--status-success)');
          const statusBg = isOccupied ? 'var(--status-danger-bg)' : (isReserved ? 'var(--status-warning-bg)' : 'var(--status-success-bg)');

          return (
            <div
              key={plat.platform_number}
              style={{
                background: 'var(--bg-card-elevated)',
                border: `1px solid ${isOccupied ? 'rgba(239,68,68,0.3)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '130px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="mono" style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Platform {plat.platform_number}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: statusBg,
                    color: statusColor
                  }}>
                    {plat.status}
                  </span>
                </div>

                {plat.occupied_by ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <Train size={14} color="var(--accent-orange)" />
                      <strong className="mono" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        {plat.occupied_by.train_number}
                      </strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {plat.occupied_by.train_name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Class: {plat.occupied_by.train_class}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    Track Bay Clear & Available
                  </div>
                )}
              </div>

              {plat.occupied_by && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  color: 'var(--text-dim)',
                  marginTop: '10px',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px'
                }}>
                  <Clock size={12} />
                  <span>Departure Clearance in ~{plat.occupied_by.departure_in_mins || 15}m</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
