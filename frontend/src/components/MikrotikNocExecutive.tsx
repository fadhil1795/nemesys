import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sliders,
  RefreshCw
} from 'lucide-react';
import { BACKEND_URL } from '../App';

export interface SiteStatus {
  id: string;
  name: string;
  status: 'OK' | 'Warning' | 'Down';
  cpu: number | null;
  ram: number | null;
  temp: number | null;
  uplink: string;
  ip: string;
  location: string;
}

export interface InterfaceItem {
  id: string;
  name: string;
  link: string;
  linkType: '1G full' | '100M half' | '10G full' | 'Down';
  rx: string;
  tx: string;
  error: number;
}

export interface AlertEscalationItem {
  id: string;
  type: 'Critical' | 'Warning';
  title: string;
  desc: string;
  ticketId?: string;
  time: string;
}

export interface SecurityMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
  status?: 'safe' | 'warning' | 'critical';
  hint?: string;
}

export interface ConfigAuditLog {
  id: string;
  time: string;
  site: string;
  action: string;
  author: string;
  topics?: string[];
  level?: 'error' | 'warning' | 'info';
  buffer?: string;
}

interface ExecutiveKpis {
  routersOnline: number;
  routersTotal: number;
  slaMonth: number;
  slaTarget: number;
  trafficTotalGbps: number;
  trafficPeakGbps: number;
  activeClientsTotal: number;
  activePppoe: number;
  activeHotspot: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
}

interface Props {
  token?: string;
  socket?: any;
  onSwitchToDetailView?: () => void;
  onNavigateToTicket?: (ticketId: string) => void;
}

export const MikrotikNocExecutive: React.FC<Props> = ({
  token,
  socket,
  onSwitchToDetailView,
  onNavigateToTicket
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [siteFilter, setSiteFilter] = useState<'all' | 'problem'>('all');
  const [selectedSite, setSelectedSite] = useState<string>('Router Mikrotik UNTAG');
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Realtime Live Data States
  const [kpis, setKpis] = useState<ExecutiveKpis>({
    routersOnline: 5,
    routersTotal: 7,
    slaMonth: 99.93,
    slaTarget: 99.90,
    trafficTotalGbps: 1.2,
    trafficPeakGbps: 1.8,
    activeClientsTotal: 1842,
    activePppoe: 1611,
    activeHotspot: 231,
    criticalAlertsCount: 0,
    warningAlertsCount: 3,
  });

  const [sitesData, setSitesData] = useState<SiteStatus[]>([
    { id: '10780', name: 'Router Mikrotik UNTAG', status: 'OK', cpu: 21, ram: 57, temp: 44, uplink: '100 Mbps', ip: '103.92.209.1', location: 'Grup: Router' },
    { id: '10791', name: 'mikrotik perpenas', status: 'OK', cpu: 28, ram: 42, temp: 42, uplink: '355 Mbps', ip: '103.92.209.30', location: 'Grup: Router' },
    { id: '10784', name: 'OLT Cddata', status: 'Warning', cpu: 24, ram: 42, temp: 44, uplink: '100 Mbps', ip: '103.92.209.107', location: 'Grup: OLT Cdata' },
    { id: '10781', name: 'Kelas B3', status: 'Warning', cpu: 24, ram: 42, temp: 44, uplink: '25 Mbps', ip: '192.168.44.69', location: 'Grup: Modem Cdata' },
    { id: '10782', name: 'Kelas B4', status: 'Warning', cpu: 24, ram: 42, temp: 44, uplink: '25 Mbps', ip: '192.168.44.43', location: 'Grup: Modem Cdata' },
    { id: '10783', name: 'Kelas B8', status: 'OK', cpu: 24, ram: 42, temp: 42, uplink: '25 Mbps', ip: '192.168.44.66', location: 'Grup: Modem Cdata' },
    { id: '10084', name: 'Zabbix server', status: 'Warning', cpu: 12, ram: 38, temp: 44, uplink: '100 Mbps', ip: '127.0.0.1', location: 'Grup: Zabbix servers' },
  ]);

  const [interfacesData, setInterfacesData] = useState<InterfaceItem[]>([
    { id: 'if-1', name: 'ether9 - iforte (IP Public UNTAG)', link: '1G full', linkType: '1G full', rx: '355 M', tx: '140 M', error: 0 },
    { id: 'if-2', name: 'bridge-uplink-olt (Core Trunk OLT)', link: '1G full', linkType: '1G full', rx: '420 M', tx: '180 M', error: 0 },
    { id: 'if-3', name: 'vlan156-perpenas (Distribusi Kantor)', link: '1G full', linkType: '1G full', rx: '142 M', tx: '45 M', error: 0 },
    { id: 'if-4', name: 'vlan-159-baak (Jaringan BAAK)', link: '1G full', linkType: '1G full', rx: '88 M', tx: '26 M', error: 0 },
  ]);

  const [alertEscalations, setAlertEscalations] = useState<AlertEscalationItem[]>([
    {
      id: '27213',
      type: 'Warning',
      title: 'Kelas B3: Network Generic Device: No SNMP data collection',
      desc: 'Peringatan Zabbix · SNMP Agent Timeout (192.168.44.69)',
      time: 'Live'
    },
    {
      id: '20770',
      type: 'Warning',
      title: 'Kelas B4: Generic by SNMP: No SNMP data collection',
      desc: 'Peringatan Zabbix · SNMP Agent Timeout (192.168.44.43)',
      time: 'Live'
    },
    {
      id: '23',
      type: 'Warning',
      title: 'Zabbix server: Linux: Zabbix agent is not available',
      desc: 'Peringatan Zabbix · Service zabbix-agent inactive',
      time: 'Live'
    },
  ]);

  const [topTalkers, setTopTalkers] = useState<Array<{ name: string; asn: string; rateStr: string; percent: number; color: string }>>([
    { name: 'YouTube', asn: 'AS15169', rateStr: '612 M', percent: 100, color: '#2563eb' },
    { name: 'Netflix', asn: 'AS2906', rateStr: '430 M', percent: 70, color: '#3b82f6' },
    { name: 'Meta', asn: 'AS32934', rateStr: '285 M', percent: 46, color: '#60a5fa' },
    { name: 'Akamai', asn: 'AS20940', rateStr: '190 M', percent: 31, color: '#93c5fd' },
    { name: 'TikTok', asn: 'AS138699', rateStr: '160 M', percent: 26, color: '#bfdbfe' },
  ]);

  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetric[]>([
    { label: 'Login gagal (SSH/Winbox)', value: 37, status: 'warning' },
    { label: 'IP diblokir otomatis', value: 12, status: 'safe' },
    { label: 'Rogue DHCP terdeteksi', value: 0, status: 'safe' },
    { label: 'Router dengan RouterOS tertinggal', value: '2 dari 7', highlight: true, status: 'warning' },
  ]);

  const [securityWindow, setSecurityWindow] = useState<string>('Live RouterOS API');
  const [configAuditLogs, setConfigAuditLogs] = useState<ConfigAuditLog[]>([]);
  const [logSource, setLogSource] = useState<'routeros' | 'zabbix' | 'none'>('none');
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning'>('all');

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return configAuditLogs;
    return configAuditLogs.filter((l) => l.level === logFilter);
  }, [configAuditLogs, logFilter]);

  // Fetch real-time live matrix from backend
  const fetchExecutiveMatrix = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/mikrotik-dashboard/executive-matrix?timeRange=${timeRange}&selectedSite=${encodeURIComponent(selectedSite)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.kpis) setKpis(data.kpis);
          if (Array.isArray(data.sites) && data.sites.length > 0) {
            setSitesData(data.sites);
            setSelectedSite((prev) => {
              if (data.sites.some((s: any) => s.name === prev)) return prev;
              return data.sites[0].name;
            });
          }
          if (Array.isArray(data.interfaces)) setInterfacesData(data.interfaces);
          if (Array.isArray(data.alerts)) setAlertEscalations(data.alerts);
          if (Array.isArray(data.topTalkers)) setTopTalkers(data.topTalkers);
          if (Array.isArray(data.security)) setSecurityMetrics(data.security);
          if (data.securityWindow) setSecurityWindow(data.securityWindow);
          if (Array.isArray(data.configAudit)) setConfigAuditLogs(data.configAudit);
          if (data.logSource) setLogSource(data.logSource);
          
          const now = new Date();
          setLastSyncTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch real-time executive matrix:', err);
    } finally {
      if (isManual) setLoading(false);
    }
  }, [token, timeRange, selectedSite]);

  // Initial fetch and 5s periodic live polling
  useEffect(() => {
    fetchExecutiveMatrix();
    const interval = setInterval(() => {
      fetchExecutiveMatrix();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchExecutiveMatrix]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchExecutiveMatrix();
    };

    socket.on('data_changed', handleUpdate);
    socket.on('queue_tree_update', handleUpdate);
    socket.on('mikrotik_telemetry_stream', handleUpdate);

    return () => {
      socket.off('data_changed', handleUpdate);
      socket.off('queue_tree_update', handleUpdate);
      socket.off('mikrotik_telemetry_stream', handleUpdate);
    };
  }, [socket, fetchExecutiveMatrix]);

  const filteredSites = useMemo(() => {
    if (siteFilter === 'problem') {
      return sitesData.filter((s) => s.status !== 'OK');
    }
    return sitesData;
  }, [sitesData, siteFilter]);

  return (
    <div style={{
      backgroundColor: '#f1f5f9',
      minHeight: '100vh',
      padding: '24px',
      color: '#0f172a',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* =========================================================================
          TOP HEADER & TIME FILTER BAR
          ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              NOC jaringan MikroTik
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px'
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              SNMP Matrix Realtime ({lastSyncTime})
            </span>
          </div>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            {sitesData.length} node infrastruktur · live matrix SNMP & RouterOS API
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchExecutiveMatrix(true)}
            disabled={loading}
            style={{
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Live</span>
          </button>

          {onSwitchToDetailView && (
            <button
              onClick={onSwitchToDetailView}
              style={{
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s'
              }}
            >
              <Sliders size={14} color="#0284c7" />
              <span>Detail Winbox / Telemetri</span>
            </button>
          )}

          {/* Time Filter Pills */}
          <div style={{
            display: 'flex',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '3px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            {(['24h', '7d', '30d'] as const).map((range) => {
              const label = range === '24h' ? '24 jam' : range === '7d' ? '7 hari' : '30 hari';
              const active = timeRange === range;
              return (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    backgroundColor: active ? '#1d4ed8' : 'transparent',
                    color: active ? '#ffffff' : '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TOP 5 EXECUTIVE KPI CARDS
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Router online */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Router online</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.routersOnline} / {kpis.routersTotal}
          </div>
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${(kpis.routersOnline / Math.max(kpis.routersTotal, 1)) * 100}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Card 2: SLA bulan ini */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>SLA bulan ini</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.slaMonth.toFixed(2).replace('.', ',')}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>target {kpis.slaTarget.toFixed(2).replace('.', ',')}%</div>
        </div>

        {/* Card 3: Trafik total */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Trafik total</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.trafficTotalGbps.toFixed(1).replace('.', ',')} Gbps
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>puncak {kpis.trafficPeakGbps.toFixed(1).replace('.', ',')} Gbps</div>
        </div>

        {/* Card 4: Pelanggan aktif */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Pelanggan aktif</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.activeClientsTotal.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            PPPoE {kpis.activePppoe.toLocaleString('id-ID')} · Hotspot {kpis.activeHotspot.toLocaleString('id-ID')}
          </div>
        </div>

        {/* Card 5: Alert aktif */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>Alert aktif</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ef4444' }}>{kpis.criticalAlertsCount}</span>
            <span style={{ color: '#f59e0b' }}>{kpis.warningAlertsCount}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>critical · warning</div>
        </div>
      </div>

      {/* =========================================================================
          ROW 1: CHARTS (Trafik Gateway Utama & Latency Upstream)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Left Chart: Trafik gateway utama */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Trafik gateway utama</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>Download</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#ea580c', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>Upload</span>
              </div>
            </div>
          </div>

          {/* SVG Traffic Area Chart */}
          <div style={{ height: '220px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="dlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 40, 80, 120, 160, 200].map((val) => {
                const y = 175 - (val / 200) * 155;
                return (
                  <g key={val}>
                    <line x1="30" y1={y} x2="490" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="24" y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="Inter, sans-serif">{val}</text>
                  </g>
                );
              })}

              {/* X-Axis Labels */}
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map((label, idx) => {
                const x = 30 + (idx / 5) * 460;
                return (
                  <text key={label} x={x} y="194" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="Inter, sans-serif">
                    {label}
                  </text>
                );
              })}

              {/* Download Area Path */}
              <path
                d="M 30,128.5 C 90,110 150,70 210,38 C 260,34 310,48 370,85 C 430,128 460,138 490,136 L 490,175 L 30,175 Z"
                fill="url(#dlAreaGrad)"
              />
              {/* Download Line */}
              <path
                d="M 30,128.5 C 90,110 150,70 210,38 C 260,34 310,48 370,85 C 430,128 460,138 490,136"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Upload Dashed Line */}
              <path
                d="M 30,167 C 90,160 150,152 210,148 C 260,147 310,154 370,158 C 430,162 460,164 490,161"
                fill="none"
                stroke="#ea580c"
                strokeWidth="1.8"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Right Chart: Latency upstream (ms) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Latency upstream (ms)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>ISP-A</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#ea580c', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>ISP-B</span>
              </div>
            </div>
          </div>

          {/* SVG Latency Line Chart with Interactive Tooltip */}
          <div style={{ height: '220px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Grid Lines */}
              {[0, 10, 20, 30, 40, 50, 60].map((val) => {
                const y = 175 - (val / 60) * 155;
                return (
                  <g key={val}>
                    <line x1="30" y1={y} x2="490" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="24" y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="Inter, sans-serif">{val}</text>
                  </g>
                );
              })}

              {/* X-Axis Labels */}
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map((label, idx) => {
                const x = 30 + (idx / 5) * 460;
                return (
                  <text key={label} x={x} y="194" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="Inter, sans-serif">
                    {label}
                  </text>
                );
              })}

              {/* ISP-A Line (Solid Blue) */}
              <path
                d="M 30,150 C 90,140 150,135 210,142 C 260,132 310,138 370,136 C 430,134 460,148 490,144"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* ISP-B Line (Dashed Orange) */}
              <path
                d="M 30,134 C 90,118 150,92 210,70 C 260,52 310,74 370,88 C 430,116 460,122 490,128"
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.2"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />

              {/* Hover Tooltip at 11:00 Point */}
              <g transform="translate(258, 48)">
                <line x1="0" y1="0" x2="0" y2="127" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="3 3" />
                <circle cx="0" cy="18" r="4.5" fill="#ffffff" stroke="#ea580c" strokeWidth="2.5" />
                <circle cx="0" cy="88" r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                <rect x="8" y="28" width="105" height="48" rx="6" fill="#0f172a" />
                <text x="18" y="44" fill="#94a3b8" fontSize="9.5" fontWeight="600">11:00</text>
                <circle cx="18" cy="55" r="3" fill="#2563eb" />
                <text x="26" y="58" fill="#f8fafc" fontSize="9.5" fontWeight="600">ISP-A: 18 ms</text>
                <circle cx="18" cy="67" r="3" fill="#ea580c" />
                <text x="26" y="70" fill="#f8fafc" fontSize="9.5" fontWeight="600">ISP-B: 46 ms</text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: STATUS SITE (TABLE) & TOP TALKER (NETFLOW)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Left Box: Status Site */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Status site</div>
            
            {/* Filter Toggle Pills */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                onClick={() => setSiteFilter('all')}
                style={{
                  backgroundColor: siteFilter === 'all' ? '#1d4ed8' : 'transparent',
                  color: siteFilter === 'all' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Semua
              </button>
              <button
                onClick={() => setSiteFilter('problem')}
                style={{
                  backgroundColor: siteFilter === 'problem' ? '#1d4ed8' : 'transparent',
                  color: siteFilter === 'problem' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Bermasalah
              </button>
            </div>
          </div>

          {/* Site Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Site</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>CPU</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>RAM</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Suhu</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>Uplink</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((site) => {
                  const isSelected = selectedSite === site.name;
                  return (
                    <tr
                      key={site.id}
                      onClick={() => setSelectedSite(site.name)}
                      style={{
                        borderBottom: '1px solid #f8fafc',
                        backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '10px 4px', fontWeight: 600, color: isSelected ? '#0284c7' : '#0f172a' }}>
                        {site.name}
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        {site.status === 'OK' && (
                          <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            OK
                          </span>
                        )}
                        {site.status === 'Warning' && (
                          <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            Warning
                          </span>
                        )}
                        {site.status === 'Down' && (
                          <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            Down
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        {site.cpu !== null ? (
                          <div>
                            <div style={{ color: site.cpu >= 80 ? '#dc2626' : '#334155', fontWeight: site.cpu >= 80 ? 700 : 500 }}>
                              {site.cpu}%
                            </div>
                            <div style={{ width: '38px', height: '3px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${site.cpu}%`, height: '100%', backgroundColor: site.cpu >= 80 ? '#dc2626' : '#059669' }} />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        {site.ram !== null ? (
                          <div>
                            <div style={{ color: '#334155', fontWeight: 500 }}>{site.ram}%</div>
                            <div style={{ width: '38px', height: '3px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${site.ram}%`, height: '100%', backgroundColor: site.ram >= 80 ? '#d97706' : '#059669' }} />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 4px', color: '#475569' }}>
                        {site.temp !== null ? `${site.temp} °C` : '-'}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        {site.uplink}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Box: Top Traffic per VLAN & Interface */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Top Traffic (VLAN & Interface)</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>SNMP IF-MIB</div>
          </div>

          {/* Top Talker Bar Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {topTalkers.map((item) => (
              <div key={item.asn} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 500 }}>
                  {item.name} <span style={{ fontSize: '11px', color: '#94a3b8' }}>({item.asn})</span>
                </div>
                {/* Horizontal Bar */}
                <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.percent}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: '4px' }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                  {item.rateStr}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: INTERFACE TELEMETRY & ALERT DAN ESCALATION
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Left Box: Interface Selected Site */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Interface {selectedSite}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Realtime SNMP IF-MIB
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Interface</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Link</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>Rx</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>Tx</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {interfacesData.map((iface) => (
                  <tr key={iface.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 4px', fontWeight: 600, color: '#0f172a' }}>
                      {iface.name}
                    </td>
                    <td style={{ padding: '10px 4px' }}>
                      {iface.linkType === '1G full' && (
                        <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          1G full
                        </span>
                      )}
                      {iface.linkType === '100M half' && (
                        <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          100M half
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: '#334155', fontWeight: 500 }}>
                      {iface.rx}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: '#334155', fontWeight: 500 }}>
                      {iface.tx}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: iface.error > 0 ? 700 : 500, color: iface.error > 0 ? '#ea580c' : '#64748b' }}>
                      {iface.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Box: Alert dan escalation */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>
            Alert dan escalation
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alertEscalations.map((alt) => (
              <div
                key={alt.id}
                style={{
                  backgroundColor: alt.type === 'Critical' ? '#fee2e2' : '#fef3c7',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  border: alt.type === 'Critical' ? '1px solid #fecaca' : '1px solid #fde68a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: alt.type === 'Critical' ? '#991b1b' : '#92400e' }}>
                    <span style={{ textTransform: 'capitalize' }}>{alt.type}</span> · {alt.title}
                  </div>
                  <div style={{ fontSize: '11px', color: alt.type === 'Critical' ? '#b91c1c' : '#b45309', marginTop: '2px' }}>
                    {alt.desc}
                  </div>
                </div>

                {alt.ticketId && onNavigateToTicket && (
                  <button
                    onClick={() => onNavigateToTicket(alt.ticketId!)}
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Buka Tiket
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: KEAMANAN & PERUBAHAN KONFIGURASI
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px'
      }}>
        {/* Left Box: Keamanan */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Keamanan</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{securityWindow}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
            {securityMetrics.map((sec, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '8px',
                  borderBottom: idx < securityMetrics.length - 1 ? '1px solid #f8fafc' : 'none'
                }}
              >
                <div>
                  <div style={{ color: '#334155', fontWeight: 500 }}>{sec.label}</div>
                  {sec.hint && (
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>{sec.hint}</div>
                  )}
                </div>
                {sec.highlight || sec.status === 'warning' || sec.status === 'critical' ? (
                  <span style={{
                    backgroundColor: sec.status === 'critical' ? '#fee2e2' : sec.status === 'warning' ? '#fffbeb' : '#f1f5f9',
                    color: sec.status === 'critical' ? '#b91c1c' : sec.status === 'warning' ? '#d97706' : '#475569',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}>
                    {sec.value}
                  </span>
                ) : (
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{sec.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Box: Log Sistem & Event MikroTik */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Log Sistem & Event MikroTik</div>
              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  backgroundColor: logSource === 'routeros' ? '#16a34a' : logSource === 'zabbix' ? '#f59e0b' : '#94a3b8'
                }} />
                {logSource === 'routeros' ? 'Live RouterOS /log (sama dengan Winbox)' : logSource === 'zabbix' ? 'Fallback: Zabbix SNMP event' : 'Tidak ada sumber log'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'error', 'warning'] as const).map((f) => (
                <button
                  key={f}
                  id={`log-filter-${f}`}
                  onClick={() => setLogFilter(f)}
                  style={{
                    fontSize: '11px', padding: '3px 9px', borderRadius: '6px', cursor: 'pointer',
                    border: '1px solid ' + (logFilter === f ? '#2563eb' : '#e2e8f0'),
                    backgroundColor: logFilter === f ? '#eff6ff' : '#fff',
                    color: logFilter === f ? '#2563eb' : '#475569', fontWeight: 600
                  }}
                >
                  {f === 'all' ? 'Semua' : f === 'error' ? 'Error' : 'Warning'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                <tr style={{ color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>Time</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Topics</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                      Belum ada log dari router.
                    </td>
                  </tr>
                )}
                {filteredLogs.map((log) => {
                  const color = log.level === 'error' ? '#dc2626' : log.level === 'warning' ? '#2563eb' : '#334155';
                  return (
                    <tr key={log.id} style={{ borderTop: '1px solid #f1f5f9', color }}>
                      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{log.time}</td>
                      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                        {(log.topics && log.topics.length > 0 ? log.topics : [log.author]).map((t) => (
                          <span key={t} style={{
                            display: 'inline-block', marginRight: '3px', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                            backgroundColor: t === 'error' || t === 'critical' ? '#fee2e2' : t === 'warning' ? '#fef3c7' : '#f1f5f9',
                            color: t === 'error' || t === 'critical' ? '#b91c1c' : t === 'warning' ? '#b45309' : '#475569'
                          }}>{t}</span>
                        ))}
                      </td>
                      <td style={{ padding: '5px 8px', wordBreak: 'break-word' }} title={log.site}>{log.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
