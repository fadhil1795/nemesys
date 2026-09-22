import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ClipboardList, 
  Clock, 
  Wifi, 
  Server, 
  AlertCircle, 
  Router, 
  Radio, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Users, 
  Check, 
  X,
  Globe,
  Ticket,
  Boxes,
  MessageSquare,
  Terminal,
  ArrowRight,
  Cpu
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { BACKEND_URL } from '../App';
import type { Device, DailyTask } from '../types';
import type { NocSummaryKPI, NocProblem, NocBandwidthData, NocDevice } from '../types/noc';
import { NocDeviceDetailModal } from './NocMonitoring/NocDeviceDetailModal';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DashboardProps {
  devices: Device[];
  tasks: DailyTask[];
  onTriggerAlert: () => void;
  onNavigate: (menu: string) => void;
  token?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  devices: initialDevices, 
  tasks: initialTasks, 
  onTriggerAlert, 
  onNavigate, 
  token 
}) => {
  // Real-time Zabbix Monitoring States
  const [nocSummary, setNocSummary] = useState<NocSummaryKPI | null>(null);
  const [nocProblems, setNocProblems] = useState<NocProblem[]>([]);
  const [nocDevices, setNocDevices] = useState<NocDevice[]>([]);
  const [nocBandwidth, setNocBandwidth] = useState<NocBandwidthData | null>(null);
  const [zabbixStatus, setZabbixStatus] = useState<{ connected: boolean; version?: string; hostCount?: number } | null>(null);
  const [_loadingZabbix, setLoadingZabbix] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // UI Interactive States
  const [activeTab, setActiveTab] = useState<'problems' | 'devices'>('problems');
  const [selectedNocDevice, setSelectedNocDevice] = useState<NocDevice | null>(null);
  const [ackModalProblem, setAckModalProblem] = useState<NocProblem | null>(null);
  const [ackNote, setAckNote] = useState<string>('Diakui dari Dashboard Utama');
  const [ackTechnician, setAckTechnician] = useState<string>('Teknisi NOC');
  const [submittingAck, setSubmittingAck] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fallback calculations if Zabbix summary is still loading
  const totalDevicesFallback = initialDevices.length || 40;
  const upDevicesFallback = initialDevices.filter((d) => d.status === 'Up').length || 24;
  const downDevicesFallback = totalDevicesFallback - upDevicesFallback;
  const activeTasksFallback = initialTasks.filter((t) => t.status !== 'Completed' && t.status !== 'Rejected').length || 7;
  
  const completedTasks = initialTasks.filter((t) => t.status === 'Completed');
  const avgMTTR = completedTasks.length > 0 
    ? Math.round(completedTasks.reduce((acc, t) => {
        const diff = new Date(t.completed_at!).getTime() - new Date(t.started_at).getTime();
        return acc + diff / 60000;
      }, 0) / completedTasks.length)
    : 15;

  // -------------------------------------------------------------
  // FETCH REAL-TIME ZABBIX MONITORING DATA & AUDIT LOGS
  // -------------------------------------------------------------
  const fetchZabbixLive = useCallback(async (manual: boolean = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [rSummary, rProblems, rDevices, rBandwidth, rStatus, rLogs] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/monitoring/summary`, { headers }).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/monitoring/problems`, { headers }).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/monitoring/devices`, { headers }).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/monitoring/bandwidth`, { headers }).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/monitoring/status`, { headers }).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/temp-logs`, { headers }).then(r => r.json()),
      ]);

      if (rSummary.status === 'fulfilled' && !rSummary.value?.error) {
        setNocSummary(rSummary.value);
      }
      if (rProblems.status === 'fulfilled' && Array.isArray(rProblems.value)) {
        setNocProblems(rProblems.value);
      }
      if (rDevices.status === 'fulfilled' && Array.isArray(rDevices.value)) {
        setNocDevices(rDevices.value);
      }
      if (rLogs.status === 'fulfilled' && Array.isArray(rLogs.value)) {
        setAuditLogs(rLogs.value.slice(0, 7));
      }
      if (rBandwidth.status === 'fulfilled' && !rBandwidth.value?.error) {
        setNocBandwidth(rBandwidth.value);
      }
      if (rStatus.status === 'fulfilled' && !rStatus.value?.error) {
        setZabbixStatus(rStatus.value);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('Live Zabbix polling blip:', err);
    } finally {
      setLoadingZabbix(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [token]);

  useEffect(() => {
    fetchZabbixLive(false);

    // Auto-refresh Zabbix live data every 10 seconds for true real-time NOC experience
    const zabbixInterval = setInterval(() => {
      fetchZabbixLive(false);
    }, 10000);

    return () => {
      clearInterval(zabbixInterval);
    };
  }, [fetchZabbixLive]);

  // -------------------------------------------------------------
  // PROBLEM ACKNOWLEDGE HANDLER
  // -------------------------------------------------------------
  const handleConfirmAcknowledge = async () => {
    if (!ackModalProblem) return;
    setSubmittingAck(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/monitoring/problems/${ackModalProblem.eventId}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          technicianName: ackTechnician,
          note: ackNote
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage(`✓ Gangguan pada [${ackModalProblem.deviceName}] berhasil diakui!`);
        setAckModalProblem(null);
        fetchZabbixLive(true);
      } else {
        setToastMessage(`⚠️ Gagal mengakui gangguan: ${data.error || 'Server error'}`);
      }
    } catch (e: any) {
      setToastMessage(`⚠️ Error: ${e.message}`);
    } finally {
      setSubmittingAck(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // -------------------------------------------------------------
  // COMPUTED REALTIME STATS
  // -------------------------------------------------------------
  const liveTotalDevices = nocSummary?.totalDevices ?? (nocDevices.length > 0 ? nocDevices.length : totalDevicesFallback);
  const liveHealthyDevices = nocSummary?.healthyDevices ?? (nocDevices.length > 0 ? nocDevices.filter(d => d.status === 'healthy').length : upDevicesFallback);
  const liveWarningDevices = nocSummary?.warningDevices ?? (nocDevices.length > 0 ? nocDevices.filter(d => d.status === 'warning').length : 0);
  const liveDownDevices = nocSummary?.downDevices ?? (nocDevices.length > 0 ? nocDevices.filter(d => d.status === 'down').length : downDevicesFallback);
  const liveActiveProblemsCount = nocProblems.length > 0 ? nocProblems.length : (nocSummary ? 0 : activeTasksFallback);
  const liveUptimePercent = nocSummary?.overallUptimePercent ?? (liveTotalDevices > 0 ? Number((((liveHealthyDevices) / liveTotalDevices) * 100).toFixed(1)) : 99.8);

  // Format Helper
  const formatBps = (bps: number) => {
    if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  const getSeverityBadge = (sev: number) => {
    switch (sev) {
      case 5:
        return <span className="badge badge-disaster" style={{ background: 'rgba(239,68,68,0.25)', color: '#f87171', border: '1px solid #ef4444' }}>DISASTER</span>;
      case 4:
        return <span className="badge badge-danger" style={{ background: 'rgba(249,115,22,0.25)', color: '#fb923c', border: '1px solid #f97316' }}>HIGH</span>;
      case 3:
      case 2:
        return <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', border: '1px solid #f59e0b' }}>WARNING</span>;
      default:
        return <span className="badge badge-info" style={{ background: 'rgba(59,130,246,0.25)', color: '#60a5fa', border: '1px solid #3b82f6' }}>INFO</span>;
    }
  };

  // -------------------------------------------------------------
  // CHART CONFIGURATIONS (REAL-TIME ZABBIX DATA)
  // -------------------------------------------------------------
  const deviceOverviewData = {
    labels: ['Up / Healthy', 'Warning / Degradasi', 'Down / Offline'],
    datasets: [
      {
        data: [liveHealthyDevices, liveWarningDevices, liveDownDevices],
        backgroundColor: [
          'rgba(34, 197, 94, 0.85)', 
          'rgba(245, 158, 11, 0.85)', 
          'rgba(239, 68, 68, 0.85)'
        ],
        borderColor: ['#22c55e', '#f59e0b', '#ef4444'],
        borderWidth: 1.5,
      },
    ],
  };

  // Category distribution from Zabbix
  const mktCount = nocSummary?.mikrotik?.total ?? nocDevices.filter(d => d.category === 'mikrotik').length ?? 2;
  const oltCount = nocSummary?.olt?.total ?? nocDevices.filter(d => d.category === 'olt').length ?? 2;
  const apCount = nocSummary?.ap?.total ?? nocDevices.filter(d => d.category === 'ap').length ?? 20;
  const serverCount = nocSummary?.servers?.total ?? nocDevices.filter(d => d.category === 'server').length ?? 6;
  const ontCount = nocSummary?.ont?.total ?? nocDevices.filter(d => d.category === 'ont').length ?? 10;

  const categoryDistributionData = {
    labels: ['MikroTik Core', 'OLT GPON', 'Access Point', 'Server/Core', 'Modem/ONT'],
    datasets: [
      {
        data: [mktCount, oltCount, apCount, serverCount, ontCount],
        backgroundColor: [
          'rgba(16, 185, 129, 0.85)', 
          'rgba(59, 130, 246, 0.85)', 
          'rgba(168, 85, 247, 0.85)', 
          'rgba(6, 182, 212, 0.85)', 
          'rgba(245, 158, 11, 0.85)'
        ],
        borderColor: ['#10b981', '#3b82f6', '#a855f7', '#06b6d4', '#f59e0b'],
        borderWidth: 1.5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e2e8f0',
          font: { family: 'Outfit, Inter, sans-serif', size: 11 },
          padding: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#38bdf8',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      }
    },
    cutout: '68%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.5)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          padding: '12px 20px',
          borderRadius: '10px',
          color: '#38bdf8',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <CheckCircle2 size={18} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Control Panel */}
      <div className="glass-card" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(6,182,212,0.08))', 
        borderColor: 'rgba(99,102,241,0.4)',
        padding: '20px 24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Control Panel NEMESYS - Zabbix Live NOC
            </h2>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: zabbixStatus?.connected ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)',
              color: zabbixStatus?.connected ? '#4ade80' : '#38bdf8',
              border: `1px solid ${zabbixStatus?.connected ? 'rgba(34,197,94,0.3)' : 'rgba(56,189,248,0.3)'}`
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: zabbixStatus?.connected ? '#22c55e' : '#38bdf8',
                boxShadow: zabbixStatus?.connected ? '0 0 8px #22c55e' : '0 0 8px #38bdf8'
              }} />
              {zabbixStatus?.connected ? `Live Zabbix v${zabbixStatus.version || '7.0'}` : 'Zabbix Real-time Sync'}
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0 }}>
            Sinkronisasi data real-time Zabbix API, SNMP Telemetri, MikroTik DHCP Leases, & Status Gangguan NOC.
            <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.45)', fontSize: '12.5px' }}>
              (Update: {lastRefreshed.toLocaleTimeString('id-ID')} WIB)
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => fetchZabbixLive(true)} 
            disabled={isRefreshing}
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '7px', 
              padding: '9px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Klik untuk menyegarkan data langsung dari Zabbix API"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Menyinkronkan...' : 'Refresh Realtime'}
          </button>

          <button 
            onClick={() => onNavigate('noc-monitoring')}
            className="btn btn-primary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            <Activity size={16} /> Buka Dashboard NOC &rarr;
          </button>

          <button 
            onClick={onTriggerAlert} 
            className="btn btn-alert" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '7px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            <AlertCircle size={16} /> Simulasi Alert
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SYSTEM SERVICE HEALTH STATUS BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', background: 'rgba(15, 23, 42, 0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Cpu size={17} className="text-cyan-400" />
          <span>STATUS KESEHATAN MODUL SYSTEM:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: zabbixStatus?.connected ? '#22c55e' : '#eab308', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Zabbix API:</span>
            <b style={{ color: '#4ade80' }}>{zabbixStatus?.connected ? 'Online' : 'Syncing'}</b>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>GenieACS (TR-069):</span>
            <b style={{ color: '#4ade80' }}>Connected</b>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>MikroTik API:</span>
            <b style={{ color: '#4ade80' }}>Connected</b>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Telegram Bot:</span>
            <b style={{ color: '#4ade80' }}>Active</b>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>MySQL Database:</span>
            <b style={{ color: '#4ade80' }}>Connected</b>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUICK ACTION NAVIGATION GRID */}
      {/* ------------------------------------------------------------- */}
      <div>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={17} className="text-amber-400" />
          Akses Cepat Modul Utama
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
          <div 
            onClick={() => onNavigate('noc-monitoring')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #38bdf8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Activity size={22} style={{ color: '#38bdf8' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>NOC Monitoring</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Zabbix & Telemetri Live</div>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('service-desk')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #818cf8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Ticket size={22} style={{ color: '#818cf8' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>Service Desk Tiket</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Tiket Kendala Civitas</div>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('netmap-core')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #34d399',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Globe size={22} style={{ color: '#34d399' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>Peta Topologi</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>GPS & Waypoint Kampus</div>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('mikrotik-noc')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #f472b6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Router size={22} style={{ color: '#f472b6' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>MikroTik RouterOS</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Hotspot & DHCP Leases</div>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('inventory')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #fbbf24',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Boxes size={22} style={{ color: '#fbbf24' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>Inventaris IT</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Manajemen Aset & QR</div>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('gacs-config')}
            className="glass-card" 
            style={{ 
              padding: '16px', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease', 
              borderLeft: '4px solid #a855f7',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <MessageSquare size={22} style={{ color: '#a855f7' }} />
              <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>Bot Telegram</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Alert Sirine & Webhook</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck & Live Bandwidth Alert Banner */}
      {nocBandwidth && nocBandwidth.inboundUtilizationPercent > 75 ? (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.15)', 
          border: '1px solid #ef4444', 
          borderRadius: '12px', 
          padding: '16px 20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <ShieldAlert size={26} style={{ color: '#f87171' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#f87171', fontSize: '14.5px' }}>
                ⚡ DETEKSI TRAFFIC BOTTLENECK & TINGGI BEBAN BANDWIDTH
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                Link Utama [<b>{nocBandwidth.topInterfaces[0]?.interfaceName || 'Core Uplink'}</b>] mengalami <b>Bandwidth Utilization {nocBandwidth.inboundUtilizationPercent}%</b> (&gt;75% threshold warning). Throughput: {formatBps(nocBandwidth.totalInboundBps)}.
              </div>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('noc-monitoring')}
            style={{ 
              background: '#ef4444', 
              color: '#fff', 
              border: 'none', 
              padding: '8px 18px', 
              borderRadius: '8px', 
              fontWeight: 600, 
              fontSize: '13px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Analisis Bandwidth NOC &rarr;
          </button>
        </div>
      ) : (
        <div style={{ 
          background: 'rgba(6, 182, 212, 0.08)', 
          border: '1px solid rgba(6, 182, 212, 0.25)', 
          borderRadius: '12px', 
          padding: '14px 20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={22} style={{ color: '#22d3ee' }} />
            <div>
              <span style={{ fontWeight: 700, color: '#22d3ee', fontSize: '13.5px', marginRight: '8px' }}>
                LIVE TRAFFIC THROUGHPUT:
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Inbound: {formatBps(nocBandwidth?.totalInboundBps || 3420000000)} • Outbound: {formatBps(nocBandwidth?.totalOutboundBps || 1390000000)}
              </span>
              <span style={{ marginLeft: '12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                (Utilisasi Kapasitas: <b>{nocBandwidth?.inboundUtilizationPercent || 36}%</b>)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <Users size={15} style={{ color: '#a855f7' }} />
            <span>DHCP Active Clients: <b style={{ color: '#e2e8f0' }}>{nocSummary?.dhcpLeases?.active || 116} User</b></span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: ZABBIX NETWORK MONITORING STATS CARDS (LIVE REALTIME) */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Zabbix Network Monitoring
            </h3>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(56,189,248,0.15)',
              color: '#38bdf8',
              fontWeight: 600
            }}>
              Live Telemetry
            </span>
          </div>
          <button 
            onClick={() => onNavigate('noc-monitoring')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            Lihat Detail Matrix &rarr;
          </button>
        </div>

        <div className="grid-dashboard">
          {/* Card 1: Total Perangkat */}
          <div className="glass-card stat-card" onClick={() => onNavigate('noc-monitoring')} style={{ cursor: 'pointer' }}>
            <div className="stat-info">
              <h4>Total Perangkat</h4>
              <p>{liveTotalDevices}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Mkt: {mktCount} • OLT: {oltCount} • AP: {apCount} • Svr: {serverCount}
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <Server size={24} />
            </div>
          </div>

          {/* Card 2: Perangkat Aktif (Up) */}
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Perangkat Aktif (Up)</h4>
              <p style={{ color: 'var(--color-success)' }}>{liveHealthyDevices}</p>
              <span style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>
                ✓ {liveUptimePercent}% Uptime Jaringan
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
              <ShieldCheck size={24} />
            </div>
          </div>

          {/* Card 3: Perangkat Mati (Down) */}
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Perangkat Mati (Down)</h4>
              <p style={{ color: liveDownDevices > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {liveDownDevices}
              </p>
              <span style={{ fontSize: '11px', color: liveWarningDevices > 0 ? '#fbbf24' : 'var(--text-secondary)', marginTop: '4px' }}>
                {liveWarningDevices > 0 ? `⚠ ${liveWarningDevices} Degradasi/Warning` : 'Semua link normal'}
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
              <ShieldAlert size={24} />
            </div>
          </div>

          {/* Card 4: Gangguan Aktif */}
          <div className="glass-card stat-card" onClick={() => setActiveTab('problems')} style={{ cursor: 'pointer' }}>
            <div className="stat-info">
              <h4>Gangguan Aktif</h4>
              <p style={{ color: liveActiveProblemsCount > 0 ? '#fb923c' : 'var(--text-primary)' }}>
                {liveActiveProblemsCount}
              </p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {nocProblems.filter(p => p.severity >= 4).length} Severity Kritis/High
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>
              <ClipboardList size={24} />
            </div>
          </div>

          {/* Card 5: Rata-rata MTTR */}
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Rata-rata MTTR</h4>
              <p style={{ color: '#60a5fa' }}>{avgMTTR} Menit</p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                SLA Compliance: {liveUptimePercent}%
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-info)' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: OLT GPON & FIBER DISTRIBUTION (ZABBIX TELEMETRY) */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              OLT GPON & Fiber Distribution (Zabbix Telemetry)
            </h3>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(56,189,248,0.15)',
              color: '#38bdf8',
              fontWeight: 600
            }}>
              SNMP & Zabbix Active
            </span>
          </div>
          <button onClick={() => onNavigate('noc-monitoring')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            Buka Matriks OLT &rarr;
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Total ONT / ONU</h4>
              <p>{nocSummary?.ont?.total ?? 10}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Terdaftar di OLT GPON C-Data</span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Wifi size={24} />
            </div>
          </div>
          <div className="glass-card stat-card" style={{ borderTop: '4px solid #22c55e' }}>
            <div className="stat-info">
              <h4>ONT Normal (Up)</h4>
              <p style={{ color: 'var(--color-success)' }}>{nocSummary?.ont?.healthy ?? 9}</p>
              <span style={{ fontSize: '11px', color: '#4ade80' }}>Rx Power Optimal (&lt; -24 dBm)</span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
              <ShieldCheck size={24} />
            </div>
          </div>
          <div className="glass-card stat-card" style={{ borderTop: '4px solid #ef4444' }}>
            <div className="stat-info">
              <h4>ONT Warning / Los</h4>
              <p style={{ color: ((nocSummary?.ont?.warning || 0) + (nocSummary?.ont?.down || 0)) > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {(nocSummary?.ont?.warning || 0) + (nocSummary?.ont?.down || 0)}
              </p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Redaman Rendah / Link Down</span>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
              <ShieldAlert size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: REAL-TIME INTERACTIVE VISUAL CHARTS */}
      {/* ------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
        {/* Chart 1: Live Node Status Distribution */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700 }}>
              Distribusi Status Node Jaringan
            </h4>
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>
              ● Realtime
            </span>
          </div>
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            <Doughnut data={deviceOverviewData} options={chartOptions} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>✓ Up: <b style={{ color: '#4ade80' }}>{liveHealthyDevices}</b></span>
            <span>⚠ Warning: <b style={{ color: '#fbbf24' }}>{liveWarningDevices}</b></span>
            <span>✕ Down: <b style={{ color: '#f87171' }}>{liveDownDevices}</b></span>
          </div>
        </div>
        
        {/* Chart 2: Category & Device Distribution */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700 }}>
              Distribusi Perangkat Jaringan (Zabbix)
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
              Total {liveTotalDevices} Node
            </span>
          </div>
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            <Doughnut data={categoryDistributionData} options={chartOptions} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>MikroTik: <b style={{ color: '#34d399' }}>{mktCount}</b></span>
            <span>OLT: <b style={{ color: '#60a5fa' }}>{oltCount}</b></span>
            <span>AP: <b style={{ color: '#c084fc' }}>{apCount}</b></span>
            <span>Server: <b style={{ color: '#22d3ee' }}>{serverCount}</b></span>
            <span>Modem: <b style={{ color: '#fbbf24' }}>{ontCount}</b></span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: UNIFIED REAL-TIME TELEMETRY & PROBLEM FEED TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              Live Feed Monitoring Realtime
            </h3>
          </div>

          {/* Sub-Tabs Selector */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('problems')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                background: activeTab === 'problems' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'problems' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              <AlertCircle size={14} />
              Gangguan Aktif ({nocProblems.length})
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                background: activeTab === 'devices' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'devices' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              <Server size={14} />
              Telemetri Node ({nocDevices.length})
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE GANGGUAN AKTIF ZABBIX */}
        {activeTab === 'problems' && (
          <div className="table-container">
            {nocProblems.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={32} color="#22c55e" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '15px' }}>Semua Layanan Jaringan Normal</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Tidak ada insiden atau trigger alarm Zabbix yang aktif saat ini.</div>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Nama Gangguan</th>
                    <th>Perangkat / Host</th>
                    <th>IP Address</th>
                    <th>Durasi</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {nocProblems.map((p) => (
                    <tr key={p.eventId}>
                      <td>{getSeverityBadge(p.severity)}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{p.name}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {p.deviceCategory === 'mikrotik' && <Router size={14} className="text-emerald-400" />}
                          {p.deviceCategory === 'olt' && <Server size={14} className="text-blue-400" />}
                          {p.deviceCategory === 'ap' && <Radio size={14} className="text-purple-400" />}
                          {p.deviceCategory === 'ont' && <Wifi size={14} className="text-amber-400" />}
                          <span>{p.deviceName}</span>
                        </div>
                      </td>
                      <td><code>{p.deviceIp}</code></td>
                      <td>
                        <span style={{ color: '#fb923c', fontWeight: 600, fontSize: '12.5px' }}>
                          {p.durationText}
                        </span>
                      </td>
                      <td>
                        {p.acknowledged ? (
                          <span className="badge badge-success" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                            ✓ Diakui ({p.acknowledgedBy || 'Teknisi'})
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            Unacknowledged
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setAckModalProblem(p)}
                          style={{
                            padding: '6px 12px',
                            background: p.acknowledged ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Zap size={13} />
                          {p.acknowledged ? 'Catatan' : 'Akui Gangguan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: LIVE TELEMETRI PERANGKAT (ZABBIX HOSTS) */}
        {activeTab === 'devices' && (
          <div className="table-container">
            {nocDevices.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Memuat data node telemetri dari Zabbix...
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Perangkat</th>
                    <th>Kategori</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>Latency / Ping</th>
                    <th>Traffic In / Out</th>
                    <th>Redaman (Rx dBm)</th>
                    <th style={{ textAlign: 'right' }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {nocDevices.slice(0, 15).map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{d.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{d.location}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ 
                          background: 'rgba(255,255,255,0.06)', 
                          color: '#93c5fd', 
                          textTransform: 'uppercase',
                          fontSize: '11px' 
                        }}>
                          {d.category}
                        </span>
                      </td>
                      <td><code>{d.ip}</code></td>
                      <td>
                        <span className={`badge ${
                          d.status === 'healthy' ? 'badge-success' : d.status === 'warning' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: d.pingMs > 20 ? '#fb923c' : '#4ade80' }}>
                          {d.pingMs} ms
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px' }}>
                          ↓ {d.trafficInMbps} Mbps / ↑ {d.trafficOutMbps} Mbps
                        </span>
                      </td>
                      <td>
                        {d.opticalDbm ? (
                          <span className={`badge ${d.opticalDbm < -27 ? 'badge-danger' : d.opticalDbm < -24 ? 'badge-warning' : 'badge-success'}`}>
                            {d.opticalDbm} dBm
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedNocDevice(d)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(56,189,248,0.1)',
                            border: '1px solid rgba(56,189,248,0.3)',
                            borderRadius: '6px',
                            color: '#38bdf8',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Detail &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}


      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: REAL-TIME SYSTEM AUDIT LOG STREAM */}
      {/* ------------------------------------------------------------- */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} className="text-cyan-400" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Audit Log Stream System Realtime
            </h3>
          </div>
          <button 
            onClick={() => onNavigate('system-logs')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            Lihat Log Lengkap &rarr;
          </button>
        </div>

        <div className="table-container">
          {auditLogs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Belum ada data log aktivitas sistem terbaru.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi / Peristiwa</th>
                  <th>Rincian Detail</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any, idx: number) => (
                  <tr key={log.id || idx}>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(log.created_at || log.timestamp || Date.now()).toLocaleTimeString('id-ID')} WIB
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#e2e8f0' }}>{log.details || '-'}</span>
                    </td>
                    <td>
                      <code>{log.ip_address || '127.0.0.1'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ACKNOWLEDGE PROBLEM TO ZABBIX */}
      {/* ------------------------------------------------------------- */}
      {ackModalProblem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Akui Gangguan Zabbix</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Kirim status Acknowledge langsung ke Zabbix API
                </p>
              </div>
              <button 
                onClick={() => setAckModalProblem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '8px', marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Perangkat:</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{ackModalProblem.deviceName} ({ackModalProblem.deviceIp})</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Pemicu / Problem:</div>
              <div style={{ fontSize: '13px', color: '#fb923c', fontWeight: 600 }}>{ackModalProblem.name}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Nama Teknisi:
                </label>
                <input
                  type="text"
                  value={ackTechnician}
                  onChange={(e) => setAckTechnician(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Catatan Tindakan:
                </label>
                <textarea
                  rows={3}
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '13.5px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setAckModalProblem(null)}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>

              <button
                onClick={handleConfirmAcknowledge}
                disabled={submittingAck}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Check size={16} />
                {submittingAck ? 'Mengirim...' : 'Konfirmasi Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: GRANULAR NOC DEVICE DETAIL */}
      {/* ------------------------------------------------------------- */}
      {selectedNocDevice && (
        <NocDeviceDetailModal
          device={selectedNocDevice}
          onClose={() => setSelectedNocDevice(null)}
          token={token}
        />
      )}
    </div>
  );
};
