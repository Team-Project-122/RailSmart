import React, { useState } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Header } from './components/Header';
import { TrackNetwork } from './components/TrackNetwork';
import { ConflictResolutionDrawer } from './components/ConflictResolutionDrawer';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { PlatformAllocationBoard } from './components/PlatformAllocationBoard';
import { WeatherMonitor } from './components/WeatherMonitor';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ShieldCheck, Info, Terminal, Activity } from 'lucide-react';

const DashboardContent = () => {
  const [activeTab, setActiveTab] = useState('corridor');
  const [whatIfTarget, setWhatIfTarget] = useState({ trainNumber: null, delay: 10 });
  const { lastTickTime, engineSource } = useSocket();

  const handleOpenWhatIfFromConflict = (trainNumber, delay) => {
    setWhatIfTarget({ trainNumber, delay });
    setActiveTab('whatif');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Header with status & navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '20px 24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'corridor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Centerpiece Track Network Schematic */}
            <TrackNetwork />

            {/* Conflict Resolution Drawer with 3-Way Alternate Strategies & Explainability Traces */}
            <ConflictResolutionDrawer onOpenWhatIf={handleOpenWhatIfFromConflict} />
          </div>
        )}

        {activeTab === 'whatif' && (
          <WhatIfSimulator 
            initialTrainNumber={whatIfTarget.trainNumber} 
            initialDelay={whatIfTarget.delay} 
          />
        )}

        {activeTab === 'platforms' && (
          <PlatformAllocationBoard />
        )}

        {activeTab === 'weather' && (
          <WeatherMonitor />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPanel />
        )}
      </main>

      {/* Control Room Footer */}
      <footer style={{
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} color="var(--accent-orange)" />
            <span>Telemetry Engine: <strong style={{ color: 'var(--text-primary)' }}>{engineSource}</strong></span>
          </div>
          <span>•</span>
          <div>
            Last Server Sync: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{lastTickTime ? new Date(lastTickTime).toLocaleTimeString() : 'Active'}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="simulated-badge">Deterministic Rule Heuristics — No Fabricated ML</span>
          <span>Indian Railways G&SR Operating Rules v2026</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <SocketProvider>
      <DashboardContent />
    </SocketProvider>
  );
}
