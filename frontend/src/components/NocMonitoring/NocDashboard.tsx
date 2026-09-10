import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  LayoutDashboard, 
  TrendingUp, 
  ShieldAlert, 
  Layers, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Server,
  Network,
  BellRing,
  Terminal,
  Award
} from 'lucide-react';
import { NocOverview } from './NocOverview';
import { NocTopology } from './NocTopology';
import { NocBandwidth } from './NocBandwidth';
import { NocProblems } from './NocProblems';
import { NocDeviceMatrix } from './NocDeviceMatrix';
import { NocDeviceDetailModal } from './NocDeviceDetailModal';
import { NocDiagnostics } from './NocDiagnostics';
import { SlaReportManager } from '../SlaReportManager';
import type { NocSummaryKPI, NocProblem, NocBandwidthData, NocDevice } from '../../types/noc';
import { BACKEND_URL } from '../../App';

interface Props {
  token?: string;
  currentUserRole?: string;
  currentUserName?: string;
}

export const NocDashboard: React.FC<Props> = ({
  token,
  currentUserRole = 'Teknisi',
  currentUserName = 'Teknisi NOC',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'topology' | 'bandwidth' | 'problems' | 'matrix' | 'diagnostics' | 'sla'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10000); // 10s default
  const [currentTime, setCurrentTime] = useState<string>('');
  const [zabbixConnected, setZabbixConnected] = useState<boolean>(true);
  const [selectedDeviceForDetail, setSelectedDeviceForDetail] = useState<NocDevice | null>(null);

  // Audio Buzzer State
  const [buzzerActive, setBuzzerActive] = useState<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Data States
  const [kpi, setKpi] = useState<NocSummaryKPI | null>(null);
  const [problems, setProblems] = useState<NocProblem[]>([]);
  const [bandwidth, setBandwidth] = useState<NocBandwidthData | null>(null);
  const [devices, setDevices] = useState<NocDevice[]>([]);

  // Update Live Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio Synthesizer Beep for Critical Alarm
  const playAlarmBeep = (force = false) => {
    if (!buzzerActive && !force) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio context might require user interaction first
    }
  };

  // Fetch all NOC monitoring data from backend
  const fetchMonitoringData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [summaryRes, problemsRes, bwRes, devRes, statusRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/monitoring/summary`, { headers }),
        fetch(`${BACKEND_URL}/api/monitoring/problems`, { headers }),
        fetch(`${BACKEND_URL}/api/monitoring/bandwidth`, { headers }),
        fetch(`${BACKEND_URL}/api/monitoring/devices`, { headers }),
        fetch(`${BACKEND_URL}/api/monitoring/status`, { headers }).catch(() => null),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setKpi(summaryData);
      }

      if (problemsRes.ok) {
        const probData: NocProblem[] = await problemsRes.json();
        setProblems(probData);

        // If there are unacknowledged disaster alarms, beep!
        const hasUnackedDisaster = probData.some((p) => p.severity >= 4 && !p.acknowledged);
        if (hasUnackedDisaster) {
          playAlarmBeep();
        }
      }

      if (bwRes.ok) {
        const bwData = await bwRes.json();
        setBandwidth(bwData);
      }

      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData);
      }

      if (statusRes && statusRes.ok) {
        const statData = await statusRes.json();
        setZabbixConnected(statData.connected ?? true);
      }
    } catch (err) {
      console.error('Failed to fetch NOC monitoring data:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Polling effect
  useEffect(() => {
    fetchMonitoringData();

    if (autoRefreshInterval > 0) {
      const poller = setInterval(() => {
        fetchMonitoringData();
      }, autoRefreshInterval);
      return () => clearInterval(poller);
    }
  }, [autoRefreshInterval]);

  // Acknowledge problem handler
  const handleAcknowledgeProblem = async (eventId: string, technicianName: string, note: string): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/problems/${eventId}/ack`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ technicianName, note }),
      });

      if (res.ok) {
        // Optimistic UI update
        setProblems((prev) =>
          prev.map((p) =>
            p.eventId === eventId
              ? { ...p, acknowledged: true, acknowledgedBy: technicianName, acknowledgedMessage: note }
              : p
          )
        );
        fetchMonitoringData();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to acknowledge problem:', err);
      return false;
    }
  };

  const handleOpenAcknowledgeFromOverview = (_prob: NocProblem) => {
    setActiveTab('problems');
  };

  return (
    <div className="noc-dashboard-root">
      {/* 1. TOP COMMAND BAR */}
      <header className="noc-header-bar glass-panel">
        <div className="noc-header-left">
          <div className="noc-brand-badge">
            <div className="brand-dot animate-pulse"></div>
            <Activity size={22} className="text-cyan-400" />
            <div className="noc-brand-titles">
              <h2>NOC COMMAND CENTER</h2>
              <span className="text-xs text-slate-400">Next-Gen Zabbix Network Operations Monitoring</span>
            </div>
          </div>
        </div>

        <div className="noc-header-center">
          {/* Global Network Health Uptime */}
          <div className="noc-health-pill">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>Health Status:</span>
            <strong className="text-emerald-400">{kpi?.overallUptimePercent || 99.8}%</strong>
          </div>

          {/* Zabbix Sync Connection Badge */}
          <div className={`noc-zabbix-badge ${zabbixConnected ? 'connected' : 'standalone'}`}>
            <Server size={14} />
            <span>{zabbixConnected ? 'Zabbix JSON-RPC: Live' : 'NOC Telemetry: Active'}</span>
          </div>

          {/* Clock */}
          <div className="noc-clock-pill">
            <Clock size={14} className="text-cyan-300" />
            <span>{currentTime || '00:00:00'}</span>
          </div>
        </div>

        <div className="noc-header-right">
          {/* Test Siren Alarm Button */}
          <button
            className="noc-icon-btn btn-test-alarm"
            onClick={() => playAlarmBeep(true)}
            title="Test Bunyi Sirine Alarm (Audio Check)"
          >
            <BellRing size={18} className="text-rose-400 animate-pulse" />
          </button>

          {/* Audio Buzzer Toggle */}
          <button
            className={`noc-icon-btn ${buzzerActive ? 'btn-sound-on' : 'btn-sound-off'}`}
            onClick={() => setBuzzerActive(!buzzerActive)}
            title={buzzerActive ? 'Mute Alert Sound' : 'Enable Alert Sound'}
          >
            {buzzerActive ? <Volume2 size={18} className="text-amber-400" /> : <VolumeX size={18} className="text-slate-500" />}
          </button>

          {/* Auto Refresh Interval */}
          <div className="noc-refresh-selector">
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="noc-select select-compact"
            >
              <option value={5000}>Auto: 5s</option>
              <option value={10000}>Auto: 10s</option>
              <option value={30000}>Auto: 30s</option>
              <option value={0}>Auto: Pause</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            className={`noc-icon-btn btn-refresh ${refreshing ? 'rotating' : ''}`}
            onClick={() => fetchMonitoringData(true)}
            title="Refresh Monitoring Data Now"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="noc-subnav-tabs">
        <button
          className={`noc-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={17} />
          <span>Overview</span>
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'topology' ? 'active' : ''}`}
          onClick={() => setActiveTab('topology')}
        >
          <Network size={17} />
          <span>Network Topology Map</span>
          <span className="tab-pill-metric">{devices.length > 0 ? `${devices.length + 1} Nodes` : 'Live Map'}</span>
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'bandwidth' ? 'active' : ''}`}
          onClick={() => setActiveTab('bandwidth')}
        >
          <TrendingUp size={17} />
          <span>Bandwidth Analytics</span>
          <span className="tab-pill-metric">
            {kpi?.totalBandwidthGbps ? `${kpi.totalBandwidthGbps}G` : '3.4G'}
          </span>
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
          onClick={() => setActiveTab('problems')}
        >
          <ShieldAlert size={17} />
          <span>Problem & Alarm Console</span>
          {problems.length > 0 && (
            <span className={`tab-pill-alarm ${problems.some((p) => p.severity >= 4) ? 'alarm-critical' : ''}`}>
              {problems.length}
            </span>
          )}
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <Layers size={17} />
          <span>Device Matrix</span>
          <span className="tab-pill-metric">{devices.length} Nodes</span>
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Terminal size={17} />
          <span>Diagnostic Tools</span>
          <span className="tab-pill-metric">Ping/Trace/BTest</span>
        </button>

        <button
          className={`noc-tab-btn ${activeTab === 'sla' ? 'active' : ''}`}
          onClick={() => setActiveTab('sla')}
          style={{
            borderColor: activeTab === 'sla' ? '#38bdf8' : 'rgba(56,189,248,0.3)',
            background: activeTab === 'sla' ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.05)'
          }}
        >
          <Award size={17} className="text-cyan-400" />
          <span className="font-semibold text-cyan-300">SLA &amp; Downtime Report</span>
          <span className="tab-pill-metric bg-cyan-500/20 text-cyan-300">PDF/Excel</span>
        </button>
      </div>

      {/* 3. ACTIVE TAB VIEW */}
      <main className="noc-main-content">
        {loading && !kpi ? (
          <div className="noc-loading-state">
            <RefreshCw size={36} className="animate-spin text-cyan-400 mb-3" />
            <p className="text-slate-300 font-semibold">Synchronizing with Network Telemetry & Zabbix...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <NocOverview
                kpi={kpi}
                problems={problems}
                bandwidth={bandwidth}
                devices={devices}
                onAcknowledgeProblem={handleOpenAcknowledgeFromOverview}
                onNavigateTab={setActiveTab}
                onSelectDevice={(dev) => setSelectedDeviceForDetail(dev)}
              />
            )}

            {activeTab === 'topology' && (
              <NocTopology
                devices={devices}
                onSelectDevice={(dev) => setSelectedDeviceForDetail(dev)}
                isFullView={true}
              />
            )}

            {activeTab === 'bandwidth' && (
              <NocBandwidth bandwidth={bandwidth} token={token} />
            )}

            {activeTab === 'problems' && (
              <NocProblems
                problems={problems}
                onAcknowledge={handleAcknowledgeProblem}
                buzzerActive={buzzerActive}
                onToggleBuzzer={() => setBuzzerActive(!buzzerActive)}
                onTestAlarm={() => playAlarmBeep(true)}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
              />
            )}

            {activeTab === 'matrix' && (
              <NocDeviceMatrix
                devices={devices}
                onSelectDevice={(dev) => setSelectedDeviceForDetail(dev)}
              />
            )}

            {activeTab === 'diagnostics' && (
              <NocDiagnostics token={token} />
            )}

            {activeTab === 'sla' && (
              <SlaReportManager
                token={token}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
              />
            )}

            {/* Granular Device Detail Modal */}
            {selectedDeviceForDetail && (
              <NocDeviceDetailModal
                device={selectedDeviceForDetail}
                onClose={() => setSelectedDeviceForDetail(null)}
                token={token}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};
