import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldAlert,
  Server,
  Building2,
  RefreshCw,
  Search,
  Plus,
  X,
  Flame,
  Award,
  Radio,
  Zap,
  Edit2,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { BACKEND_URL } from '../App';

export interface SlaSummaryReport {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalPeriodHours: number;
  totalPeriodMinutes: number;
  zabbixLiveConnected: boolean;
  liveOutageCount: number;
  overallUptimePercent: number;
  totalDowntimeMinutes: number;
  totalIncidents: number;
  mttrMinutes: number;
  mtbfHours: number;
  slaComplianceRatePercent: number;
  nodesMetCount: number;
  nodesBreachedCount: number;
  totalNodesMonitored: number;
  devices: Array<{
    id: number | string;
    name: string;
    ip: string;
    type: string;
    location: string;
    targetSlaPercent: number;
    actualUptimePercent: number;
    totalDowntimeMinutes: number;
    incidentCount: number;
    mttrMinutes: number;
    status: 'MET' | 'BREACHED';
    isBackbone: boolean;
    isLiveDown?: boolean;
    liveDownMinutes?: number;
  }>;
  pops: Array<{
    popName: string;
    nodeCount: number;
    targetSlaPercent: number;
    actualUptimePercent: number;
    totalDowntimeMinutes: number;
    incidentCount: number;
    status: 'MET' | 'BREACHED';
    hasLiveOutage?: boolean;
  }>;
  incidents: Array<{
    id: number;
    incidentDate: string;
    reportTime: string;
    resolvedTime: string;
    durationMinutes: number;
    affectedSystem: string;
    location: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    rootCause: string;
    actionTaken: string;
    handledBy: string;
    status: 'Resolved' | 'Closed' | 'In Progress';
    slaBreached: boolean;
    isLive?: boolean;
  }>;
  rootCauses: Array<{ cause: string; count: number; downtimeMinutes: number }>;
  dailyTrends: Array<{ date: string; uptimePercent: number; incidentCount: number }>;
}

export type SlaIncident = SlaSummaryReport['incidents'][number];

interface Props {
  token?: string;
  currentUserRole?: string;
  currentUserName?: string;
}

export const SlaReportManager: React.FC<Props> = ({
  token,
  currentUserRole: _currentUserRole = 'Teknisi',
  currentUserName = 'Teknisi NOC',
}) => {
  const [report, setReport] = useState<SlaSummaryReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10000); // 10s default realtime polling

  // Filter States
  const [period, setPeriod] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [scope, setScope] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalSearch, setModalSearch] = useState<string>('');

  // Active Subtab inside table section
  const [tableTab, setTableTab] = useState<'devices' | 'pops' | 'incidents'>('devices');

  // Modals
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [showAddIncidentModal, setShowAddIncidentModal] = useState<boolean>(false);
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [showEditIncidentModal, setShowEditIncidentModal] = useState<boolean>(false);
  const [editingIncident, setEditingIncident] = useState<SlaIncident | null>(null);

  // Edit Incident Form
  const [editIncidentForm, setEditIncidentForm] = useState({
    id: 0,
    incident_date: '',
    report_time: '',
    resolved_time: '',
    affected_system: '',
    severity: 'Medium',
    description: '',
    impact: '',
    root_cause: '',
    action_taken: '',
    handled_by: currentUserName,
    status: 'Resolved',
    sla_limit_minutes: 60,
  });

  // New Incident Form
  const [incidentForm, setIncidentForm] = useState({
    incident_date: new Date().toISOString().split('T')[0],
    report_time: '09:00',
    resolved_time: '09:30',
    affected_system: '',
    severity: 'Medium',
    description: '',
    impact: '',
    root_cause: '',
    action_taken: '',
    handled_by: currentUserName,
    sla_limit_minutes: 60,
  });

  const handleOpenEditIncident = (inc: SlaIncident) => {
    setEditingIncident(inc);
    setEditIncidentForm({
      id: inc.id,
      incident_date: inc.incidentDate,
      report_time: inc.reportTime,
      resolved_time: inc.resolvedTime.includes('PADAM') ? new Date().toTimeString().substring(0, 5) : inc.resolvedTime,
      affected_system: inc.affectedSystem,
      severity: inc.severity,
      description: inc.rootCause,
      impact: inc.rootCause,
      root_cause: inc.rootCause,
      action_taken: inc.actionTaken,
      handled_by: inc.handledBy,
      status: inc.status,
      sla_limit_minutes: 60,
    });
    setShowEditIncidentModal(true);
  };

  const handleUpdateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/reports/sla-incident/${editingIncident.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(editIncidentForm),
      });

      if (res.ok) {
        setShowEditIncidentModal(false);
        setEditingIncident(null);
        fetchReport(true);
      }
    } catch (err) {
      console.error('Failed to update incident:', err);
    }
  };

  const handleDeleteIncident = async (id: number) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus catatan insiden #${id}?`)) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/reports/sla-incident/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        fetchReport(true);
      }
    } catch (err) {
      console.error('Failed to delete incident:', err);
    }
  };

  const handleQuickResolve = async (inc: SlaIncident) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const nowTime = new Date().toTimeString().substring(0, 5);
      await fetch(`${BACKEND_URL}/api/reports/sla-incident/${inc.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'Resolved',
          resolved_time: nowTime,
          affected_system: inc.affectedSystem,
        }),
      });

      fetchReport(true);
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  };

  // Fetch SLA Report from API
  const fetchReport = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `${BACKEND_URL}/api/reports/sla-summary?period=${period}&scope=${scope}`;
      if (period === 'custom') {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data: SlaSummaryReport = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to fetch SLA report:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Real-time Polling Effect
  useEffect(() => {
    fetchReport();

    if (autoRefreshInterval > 0) {
      const poller = setInterval(() => {
        fetchReport();
      }, autoRefreshInterval);
      return () => clearInterval(poller);
    }
  }, [period, scope, autoRefreshInterval]);

  // Handle Export Excel
  const handleExportExcel = () => {
    let exportUrl = `${BACKEND_URL}/api/reports/sla-export-excel?period=${period}&scope=${scope}`;
    if (period === 'custom') {
      exportUrl += `&startDate=${startDate}&endDate=${endDate}`;
    }
    window.open(exportUrl, '_blank');
  };

  // Handle Quick Outage Simulation (Trigger Live Breach Test)
  const handleSimulateOutage = async (device: any) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/reports/sla-incident`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          incident_date: new Date().toISOString().split('T')[0],
          report_time: new Date().toTimeString().substring(0, 5),
          resolved_time: '11:45',
          affected_system: device.name,
          severity: 'High',
          description: `Simulasi Uji Gangguan Real-time pada ${device.name}`,
          impact: `Koneksi ${device.location} mengalami gangguan total 65 menit`,
          root_cause: 'Pemadaman Listrik & Overheat Switch',
          action_taken: 'Penggantian power supply dan re-routing kabel',
          handled_by: currentUserName,
          sla_limit_minutes: 45,
          sla_breached: true
        }),
      });

      if (res.ok) {
        setShowSimulateModal(false);
        fetchReport(true);
      }
    } catch (err) {
      console.error('Failed to simulate outage:', err);
    }
  };

  // Handle Save Incident
  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/reports/sla-incident`, {
        method: 'POST',
        headers,
        body: JSON.stringify(incidentForm),
      });

      if (res.ok) {
        setShowAddIncidentModal(false);
        fetchReport(true);
        // Reset form
        setIncidentForm({
          incident_date: new Date().toISOString().split('T')[0],
          report_time: '09:00',
          resolved_time: '09:30',
          affected_system: '',
          severity: 'Medium',
          description: '',
          impact: '',
          root_cause: '',
          action_taken: '',
          handled_by: currentUserName,
          sla_limit_minutes: 60,
        });
      }
    } catch (err) {
      console.error('Failed to save incident:', err);
    }
  };

  // Filtered devices based on search
  const filteredDevices = (report?.devices || []).filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sla-report-container">
      {/* 1. HEADER & CONTROLS */}
      <header className="sla-header glass-panel">
        <div className="sla-header-left">
          <div className="sla-title-badge">
            <Award size={24} className="text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">SLA & DOWNTIME PERFORMANCE REPORT</h1>
                <span className="sla-official-tag">Official Reporting</span>
              </div>
              <p className="text-xs text-slate-400">
                Kalkulasi Ketersediaan Jaringan (Uptime SLA %), MTTR, MTBF &amp; Ekspor Dokumen Resmi
              </p>
            </div>
          </div>
        </div>

        <div className="sla-header-actions">
          {/* Zabbix Live Sync Badge */}
          <div className="sla-live-sync-badge">
            <Radio size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-semibold text-xs">
              {report?.zabbixLiveConnected ? 'Zabbix Live Sync: Active' : 'NOC Telemetry: Realtime'}
            </span>
          </div>

          {/* Auto Refresh Interval */}
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="sla-select select-compact"
            title="Interval Pembaruan Real-time Otomatis"
          >
            <option value={5000}>Auto: 5s</option>
            <option value={10000}>Auto: 10s</option>
            <option value={30000}>Auto: 30s</option>
            <option value={0}>Auto: Pause</option>
          </select>

          {/* Simulate Test Breach Button */}
          <button
            className="sla-btn sla-btn-simulate"
            onClick={() => setShowSimulateModal(true)}
            title="Simulasikan Gangguan Real-time pada Perangkat untuk Menguji Deteksi SLA Breach"
          >
            <Zap size={15} className="text-amber-400" />
            <span>⚡ Uji Gangguan (Breach)</span>
          </button>

          <button
            className="sla-btn sla-btn-pdf"
            onClick={() => setShowPdfModal(true)}
            title="Buka Pratinjau Dokumen PDF Resmi Lengkap KOP Surat & Tanda Tangan"
          >
            <Printer size={16} />
            <span>Cetak PDF Resmi</span>
          </button>

          <button
            className="sla-btn sla-btn-excel"
            onClick={handleExportExcel}
            title="Download Laporan Format Excel (.xlsx) Multi-Sheet"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            className="sla-btn sla-btn-add"
            onClick={() => setShowAddIncidentModal(true)}
            title="Catat Insiden Downtime Baru ke Log Operasional"
          >
            <Plus size={16} />
            <span>Catat Gangguan</span>
          </button>

          <button
            className={`sla-btn-refresh ${refreshing ? 'rotating' : ''}`}
            onClick={() => fetchReport(true)}
            title="Refresh Data Kalkulasi SLA"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {/* 2. FILTER TOOLBAR */}
      <section className="sla-toolbar glass-panel">
        <div className="sla-filter-group">
          <label>
            <Calendar size={14} className="text-cyan-400" />
            <span>Periode:</span>
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="sla-select"
          >
            <option value="this_month">Bulan Ini (Agustus 2026)</option>
            <option value="last_month">Bulan Lalu (Juli 2026)</option>
            <option value="q3">Triwulan III (Q3 2026)</option>
            <option value="last_30_days">30 Hari Terakhir</option>
            <option value="custom">Rentang Kustom...</option>
          </select>
        </div>

        {period === 'custom' && (
          <div className="sla-custom-date-group">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sla-input-date"
            />
            <span className="text-slate-400 text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sla-input-date"
            />
            <button
              className="sla-btn-apply"
              onClick={() => fetchReport(true)}
            >
              Terapkan
            </button>
          </div>
        )}

        <div className="sla-filter-group">
          <label>
            <Filter size={14} className="text-emerald-400" />
            <span>Ruang Lingkup:</span>
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="sla-select"
          >
            <option value="all">Semua Perangkat &amp; POP</option>
            <option value="backbone">Core &amp; Backbone Gateway</option>
            <option value="vip">Layanan VIP &amp; Rektorat</option>
            <option value="aps">Seluruh Access Point Kampus</option>
          </select>
        </div>

        <div className="sla-search-group">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Cari perangkat / IP / lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sla-search-input"
          />
        </div>

        {report && (
          <div className="sla-period-badge">
            <span>Periode Aktif: <strong>{report.periodLabel}</strong> ({report.totalPeriodHours} Jam)</span>
          </div>
        )}
      </section>

      {/* 2B. REALTIME ACTIVE OUTAGE BANNER */}
      {report && report.liveOutageCount > 0 && (
        <section className="sla-live-alert-banner glass-panel">
          <div className="flex items-center gap-3">
            <div className="live-alert-icon animate-bounce">
              <ShieldAlert size={22} className="text-rose-400" />
            </div>
            <div>
              <strong className="text-rose-300 text-sm font-bold tracking-wide">
                ⚠️ PERINGATAN GANGGUAN REAL-TIME TERDETEKSI ({report.liveOutageCount} NODE SEDANG DOWN)
              </strong>
              <p className="text-xs text-slate-300 mt-0.5">
                Perangkat yang sedang padam otomatis memotong persentase Uptime SLA dan memicu status <strong>BREACHED</strong> secara langsung.
              </p>
            </div>
          </div>
          <span className="live-alert-pill animate-pulse">LIVE INCIDENT ACTIVE</span>
        </section>
      )}

      {/* 3. EXECUTIVE KPI HERO CARDS */}
      {loading || !report ? (
        <div className="sla-loading-state glass-panel">
          <RefreshCw size={36} className="animate-spin text-cyan-400 mb-3" />
          <p className="text-slate-300 font-semibold">Mengkalkulasi Metrik Ketersediaan SLA &amp; Riwayat Downtime...</p>
        </div>
      ) : (
        <>
          <section className="sla-kpi-grid">
            {/* Card 1: Overall SLA Uptime */}
            <div className="sla-kpi-card hero-kpi">
              <div className="kpi-icon-wrap bg-cyan-500/10 text-cyan-400">
                <CheckCircle2 size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">OVERALL UPTIME SLA</span>
                <div className="kpi-value-row">
                  <span className="kpi-value text-cyan-300">{report.overallUptimePercent}%</span>
                  <span className="kpi-target-tag">Target: 99.5%</span>
                </div>
                <div className="kpi-progress-bar">
                  <div
                    className="kpi-progress-fill bg-cyan-400"
                    style={{ width: `${Math.min(100, report.overallUptimePercent)}%` }}
                  />
                </div>
                <span className="kpi-subtext">
                  Status: <strong className={report.overallUptimePercent >= 99.5 ? 'text-emerald-400' : 'text-rose-400'}>
                    {report.overallUptimePercent >= 99.5 ? '✓ SLA TERPENUHI (MET)' : '⚠️ SLA BREACHED'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Card 2: MTTR */}
            <div className="sla-kpi-card">
              <div className="kpi-icon-wrap bg-indigo-500/10 text-indigo-400">
                <Clock size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">MTTR (MEAN TIME TO REPAIR)</span>
                <div className="kpi-value-row">
                  <span className="kpi-value text-indigo-300">{report.mttrMinutes} <small className="text-sm font-normal">Menit</small></span>
                </div>
                <span className="kpi-subtext text-slate-400">Rata-rata waktu perbaikan insiden</span>
              </div>
            </div>

            {/* Card 3: MTBF */}
            <div className="sla-kpi-card">
              <div className="kpi-icon-wrap bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">MTBF (MEAN TIME BETWEEN FAILURES)</span>
                <div className="kpi-value-row">
                  <span className="kpi-value text-emerald-300">{report.mtbfHours} <small className="text-sm font-normal">Jam</small></span>
                </div>
                <span className="kpi-subtext text-slate-400">Jarak rata-rata antar gangguan</span>
              </div>
            </div>

            {/* Card 4: Total Downtime */}
            <div className="sla-kpi-card">
              <div className="kpi-icon-wrap bg-rose-500/10 text-rose-400">
                <ShieldAlert size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">TOTAL DOWNTIME BULANAN</span>
                <div className="kpi-value-row">
                  <span className="kpi-value text-rose-300">{report.totalDowntimeMinutes} <small className="text-sm font-normal">Menit</small></span>
                  <span className="text-xs text-slate-400">({report.totalIncidents} Insiden)</span>
                </div>
                <span className="kpi-subtext text-slate-400">Akumulasi durasi padam jaringan</span>
              </div>
            </div>

            {/* Card 5: SLA Compliance Rate */}
            <div className="sla-kpi-card">
              <div className="kpi-icon-wrap bg-amber-500/10 text-amber-400">
                <Award size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">SLA COMPLIANCE RATE</span>
                <div className="kpi-value-row">
                  <span className="kpi-value text-amber-300">{report.slaComplianceRatePercent}%</span>
                </div>
                <span className="kpi-subtext">
                  <strong className="text-emerald-400">{report.nodesMetCount} Sesuai</strong> • <strong className="text-rose-400">{report.nodesBreachedCount} Terlewati</strong>
                </span>
              </div>
            </div>
          </section>

          {/* 4. VISUAL CHARTS ROW */}
          <section className="sla-charts-grid">
            {/* Chart 1: Daily Availability Trend */}
            <div className="sla-chart-card glass-panel">
              <div className="chart-header">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-cyan-400" />
                  <h3>Tren Ketersediaan Harian (Daily Uptime Trend %)</h3>
                </div>
                <span className="text-xs text-slate-400">Baseline 99.5%</span>
              </div>
              <div className="chart-body">
                <div className="trend-bar-container">
                  {report.dailyTrends.map((d, idx) => (
                    <div key={idx} className="trend-bar-col" title={`${d.date}: ${d.uptimePercent}% (${d.incidentCount} insiden)`}>
                      <div className="trend-bar-wrapper">
                        <div
                          className={`trend-bar-fill ${d.uptimePercent >= 99.5 ? 'bar-good' : d.uptimePercent >= 98.0 ? 'bar-warn' : 'bar-bad'}`}
                          style={{ height: `${Math.max(15, (d.uptimePercent - 90) * 10)}%` }}
                        />
                      </div>
                      <span className="trend-bar-label">{d.date.replace('Tgl ', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 2: Root Cause Distribution */}
            <div className="sla-chart-card glass-panel">
              <div className="chart-header">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-amber-400" />
                  <h3>Penyebab Gangguan (Root Cause Analysis)</h3>
                </div>
                <span className="text-xs text-slate-400">Berdasarkan Durasi</span>
              </div>
              <div className="chart-body root-cause-body">
                {report.rootCauses.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Tidak ada insiden tercatat pada periode ini.</p>
                ) : (
                  <div className="root-cause-list">
                    {report.rootCauses.map((rc, idx) => (
                      <div key={idx} className="root-cause-item">
                        <div className="root-cause-info">
                          <span className="root-cause-title">{rc.cause}</span>
                          <span className="root-cause-meta">{rc.count} Kali • {rc.downtimeMinutes} Menit</span>
                        </div>
                        <div className="root-cause-bar-wrap">
                          <div
                            className="root-cause-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(10, (rc.downtimeMinutes / (report.totalDowntimeMinutes || 1)) * 100))}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 5. STRUCTURED DATA TABLES */}
          <section className="sla-tables-section glass-panel">
            <div className="sla-table-subnav">
              <button
                className={`table-tab-btn ${tableTab === 'devices' ? 'active' : ''}`}
                onClick={() => setTableTab('devices')}
              >
                <Server size={16} />
                <span>Ketersediaan Per Perangkat ({filteredDevices.length})</span>
              </button>
              <button
                className={`table-tab-btn ${tableTab === 'pops' ? 'active' : ''}`}
                onClick={() => setTableTab('pops')}
              >
                <Building2 size={16} />
                <span>Ketersediaan Per POP / Gedung ({report.pops.length})</span>
              </button>
              <button
                className={`table-tab-btn ${tableTab === 'incidents' ? 'active' : ''}`}
                onClick={() => setTableTab('incidents')}
              >
                <ShieldAlert size={16} />
                <span>Log Riwayat Gangguan Bulanan ({report.incidents.length})</span>
              </button>
            </div>

            {/* TAB A: DEVICES TABLE */}
            {tableTab === 'devices' && (
              <div className="sla-table-wrapper">
                <table className="sla-table">
                  <thead>
                    <tr>
                      <th>NAMA PERANGKAT</th>
                      <th>IP ADDRESS</th>
                      <th>TIPE</th>
                      <th>LOKASI / POP</th>
                      <th>TARGET SLA</th>
                      <th>UPTIME AKTUAL</th>
                      <th>TOTAL DOWNTIME</th>
                      <th>MTTR</th>
                      <th>STATUS SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((dev) => (
                      <tr key={dev.id} className={dev.isLiveDown ? 'row-live-down' : dev.status === 'BREACHED' ? 'row-breached' : ''}>
                        <td>
                          <div className="flex items-center gap-2">
                            {dev.isBackbone && <span className="badge-backbone">CORE</span>}
                            <strong className="text-white">{dev.name}</strong>
                            {dev.isLiveDown && (
                              <span className="badge-live-down animate-pulse">
                                🔴 LIVE PADAM ({dev.liveDownMinutes}m)
                              </span>
                            )}
                          </div>
                        </td>
                        <td><code className="text-cyan-300">{dev.ip}</code></td>
                        <td><span className="text-xs text-slate-300">{dev.type}</span></td>
                        <td><span className="text-slate-300">{dev.location}</span></td>
                        <td className="text-center font-semibold text-slate-400">{dev.targetSlaPercent}%</td>
                        <td className="text-center">
                          <strong className={dev.actualUptimePercent >= dev.targetSlaPercent && !dev.isLiveDown ? 'text-emerald-400' : 'text-rose-400'}>
                            {dev.actualUptimePercent}%
                          </strong>
                        </td>
                        <td className="text-center">
                          <span className={dev.totalDowntimeMinutes > 0 ? 'text-rose-300 font-semibold' : 'text-slate-400'}>
                            {dev.totalDowntimeMinutes} Menit
                          </span>
                        </td>
                        <td className="text-center text-slate-300">{dev.mttrMinutes} Mins</td>
                        <td className="text-center">
                          <span className={`status-pill ${dev.status === 'MET' && !dev.isLiveDown ? 'pill-met' : 'pill-breached animate-pulse'}`}>
                            {dev.isLiveDown ? '⚠️ BREACHED (OUTAGE)' : dev.status === 'MET' ? '✓ MET' : '⚠️ BREACHED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB B: POP / GEDUNG TABLE */}
            {tableTab === 'pops' && (
              <div className="sla-table-wrapper">
                <table className="sla-table">
                  <thead>
                    <tr>
                      <th>POP / GEDUNG KAMPUS</th>
                      <th>JUMLAH PERANGKAT</th>
                      <th>TARGET SLA</th>
                      <th>UPTIME AKTUAL</th>
                      <th>TOTAL DOWNTIME</th>
                      <th>INSIDEN</th>
                      <th>STATUS KINERJA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.pops.map((pop, idx) => (
                      <tr key={idx} className={pop.status === 'BREACHED' ? 'row-breached' : ''}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-cyan-400" />
                            <strong className="text-white">{pop.popName}</strong>
                          </div>
                        </td>
                        <td className="text-center">{pop.nodeCount} Node</td>
                        <td className="text-center text-slate-400">{pop.targetSlaPercent}%</td>
                        <td className="text-center">
                          <strong className={pop.actualUptimePercent >= pop.targetSlaPercent ? 'text-emerald-400' : 'text-rose-400'}>
                            {pop.actualUptimePercent}%
                          </strong>
                        </td>
                        <td className="text-center text-slate-300">{pop.totalDowntimeMinutes} Menit</td>
                        <td className="text-center">{pop.incidentCount}</td>
                        <td className="text-center">
                          <span className={`status-pill ${pop.status === 'MET' ? 'pill-met' : 'pill-breached'}`}>
                            {pop.status === 'MET' ? '✓ SLA MET' : '⚠️ BREACHED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB C: INCIDENTS AUDIT LOG */}
            {tableTab === 'incidents' && (
              <div className="sla-table-wrapper">
                <table className="sla-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>TANGGAL &amp; JAM</th>
                      <th>DURASI</th>
                      <th>PERANGKAT TERDAMPAK</th>
                      <th>SEVERITY</th>
                      <th>ROOT CAUSE</th>
                      <th>TINDAKAN PERBAIKAN</th>
                      <th>TEKNISI</th>
                      <th>STATUS</th>
                      <th className="text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.incidents.map((inc) => (
                      <tr key={inc.id}>
                        <td className="text-center font-mono text-slate-400">#{inc.id}</td>
                        <td>
                          <div className="text-xs">
                            <strong className="text-slate-200">{inc.incidentDate}</strong>
                            <div className="text-slate-400">{inc.reportTime} - {inc.resolvedTime}</div>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="dur-badge">{inc.durationMinutes} Mins</span>
                        </td>
                        <td>
                          <strong className="text-white">{inc.affectedSystem}</strong>
                        </td>
                        <td>
                          <span className={`sev-badge sev-${inc.severity.toLowerCase()}`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td className="text-slate-300 text-xs max-w-xs">{inc.rootCause}</td>
                        <td className="text-slate-300 text-xs max-w-xs">{inc.actionTaken}</td>
                        <td><span className="text-xs text-cyan-300">{inc.handledBy}</span></td>
                        <td className="text-center">
                          <span className={`status-pill ${!inc.slaBreached ? 'pill-met' : 'pill-breached'}`}>
                            {!inc.slaBreached ? 'SLA OK' : 'BREACHED'}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="sla-actions-wrap">
                            {inc.status === 'In Progress' && (
                              <button
                                type="button"
                                className="sla-action-btn btn-resolve-quick"
                                onClick={() => handleQuickResolve(inc)}
                                title="Tandai Selesai &amp; Pulihkan Gangguan Ini Sekarang"
                              >
                                <CheckCircle size={13} />
                                <span>Pulihkan</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="sla-action-btn btn-edit"
                              onClick={() => handleOpenEditIncident(inc)}
                              title="Edit Rincian Insiden Gangguan Ini"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="sla-action-btn btn-delete"
                              onClick={() => handleDeleteIncident(inc.id)}
                              title="Hapus Catatan Insiden"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* 6. OFFICIAL PDF PREVIEW & PRINT MODAL */}
      {showPdfModal && report && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box pdf-preview-modal">
            <div className="sla-modal-header no-print">
              <div className="flex items-center gap-2">
                <Printer size={20} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Pratinjau Dokumen Laporan SLA &amp; Kinerja Resmi</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="sla-btn sla-btn-pdf"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  <span>Cetak / Simpan PDF Sekarang</span>
                </button>
                <button
                  className="sla-modal-close"
                  onClick={() => setShowPdfModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="printable-document-container" id="printable-sla-doc">
              {/* KOP SURAT RESMI */}
              <div className="doc-kop-surat">
                <div className="kop-logo-left">
                  <div className="kop-seal-untag">UNTAG</div>
                </div>
                <div className="kop-text">
                  <h3>UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI</h3>
                  <h4>DIREKTORAT TEKNOLOGI INFORMASI &amp; KOMUNIKASI (DTIK)</h4>
                  <h5>NETWORK OPERATIONS CENTER (NOC) &amp; INFRASTRUKTUR JARINGAN</h5>
                  <p>Jl. Adi Sucipto No. 26 Banyuwangi, Jawa Timur 68416 | Telp: (0333) 412345 | Web: www.untag-banyuwangi.ac.id</p>
                </div>
                <div className="kop-logo-right">
                  <div className="kop-seal-nemesys">NEMESYS</div>
                </div>
              </div>
              <div className="kop-divider-double"></div>

              {/* DOCUMENT TITLE & REF */}
              <div className="doc-meta-header">
                <h2 className="doc-main-title">LAPORAN KINERJA KETERSEDIAAN JARINGAN (SLA) &amp; DOWNTIME</h2>
                <div className="doc-meta-grid">
                  <div><strong>Nomor Dokumen:</strong> NOC-SLA/UNTAG/2026/08-{String(new Date().getDate()).padStart(2, '0')}</div>
                  <div><strong>Tanggal Terbit:</strong> {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div><strong>Periode Pelaporan:</strong> {report.periodLabel} ({report.startDate} s/d {report.endDate})</div>
                  <div><strong>Klasifikasi:</strong> Resmi / Internal &amp; Manajemen Eksekutif</div>
                </div>
              </div>

              {/* EXECUTIVE SUMMARY TABLE */}
              <div className="doc-section">
                <div className="doc-section-title">I. RINGKASAN EKSEKUTIF KINERJA SLA (EXECUTIVE SUMMARY)</div>
                <table className="doc-table kpi-summary-table">
                  <tbody>
                    <tr>
                      <td className="bg-light"><strong>Total Durasi Periode</strong></td>
                      <td>{report.totalPeriodHours} Jam ({report.totalPeriodMinutes.toLocaleString()} Menit)</td>
                      <td className="bg-light"><strong>Total Insiden Terdeteksi</strong></td>
                      <td>{report.totalIncidents} Kejadian Gangguan</td>
                    </tr>
                    <tr>
                      <td className="bg-light"><strong>Ketersediaan SLA Global</strong></td>
                      <td><strong className="text-highlight">{report.overallUptimePercent}%</strong> (Target: 99.5%)</td>
                      <td className="bg-light"><strong>Total Akumulasi Downtime</strong></td>
                      <td>{report.totalDowntimeMinutes} Menit</td>
                    </tr>
                    <tr>
                      <td className="bg-light"><strong>MTTR (Rata-rata Waktu Pulih)</strong></td>
                      <td>{report.mttrMinutes} Menit / Insiden</td>
                      <td className="bg-light"><strong>MTBF (Jarak Antar Kerusakan)</strong></td>
                      <td>{report.mtbfHours} Jam Bebas Gangguan</td>
                    </tr>
                    <tr>
                      <td className="bg-light"><strong>SLA Compliance Rate</strong></td>
                      <td><strong>{report.slaComplianceRatePercent}%</strong> Node Memenuhi SLA</td>
                      <td className="bg-light"><strong>Status Kepatuhan</strong></td>
                      <td><span className="doc-badge-met">✓ TARGET TERPENUHI</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* POP & BACKBONE AVAILABILITY */}
              <div className="doc-section">
                <div className="doc-section-title">II. KETERSEDIAAN INFRASTRUKTUR PER POP / GEDUNG KAMPUS</div>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Nama POP / Lokasi Gedung</th>
                      <th>Jumlah Node</th>
                      <th>Target SLA</th>
                      <th>Uptime Aktual</th>
                      <th>Total Downtime</th>
                      <th>Insiden</th>
                      <th>Status SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.pops.map((p, idx) => (
                      <tr key={idx}>
                        <td><strong>{p.popName}</strong></td>
                        <td className="text-center">{p.nodeCount}</td>
                        <td className="text-center">{p.targetSlaPercent}%</td>
                        <td className="text-center font-bold">{p.actualUptimePercent}%</td>
                        <td className="text-center">{p.totalDowntimeMinutes} Mins</td>
                        <td className="text-center">{p.incidentCount}</td>
                        <td className="text-center">{p.status === 'MET' ? 'Sesuai (MET)' : 'BREACHED'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* INCIDENT LOG SUMMARY */}
              <div className="doc-section">
                <div className="doc-section-title">III. REKAPITULASI INSIDEN &amp; LOG GANGGUAN BULANAN</div>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Waktu</th>
                      <th>Durasi</th>
                      <th>Perangkat / Sistem Terdampak</th>
                      <th>Akar Penyebab (Root Cause)</th>
                      <th>Tindakan Penanganan</th>
                      <th>Teknisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.incidents.map((inc) => (
                      <tr key={inc.id}>
                        <td className="text-center">{inc.incidentDate}</td>
                        <td className="text-center">{inc.reportTime}-{inc.resolvedTime}</td>
                        <td className="text-center">{inc.durationMinutes}m</td>
                        <td>{inc.affectedSystem}</td>
                        <td>{inc.rootCause}</td>
                        <td>{inc.actionTaken}</td>
                        <td>{inc.handledBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SIGNATURE & APPROVAL BOX */}
              <div className="doc-signatures">
                <div className="sig-block">
                  <p className="sig-title">Dilaporkan Oleh,</p>
                  <p className="sig-role">Lead Engineer NOC &amp; Infrastruktur</p>
                  <div className="sig-space"></div>
                  <p className="sig-name"><u>Rizal Kurniawan, S.Kom</u></p>
                  <p className="sig-nip">NIDN/NIP: 19920815 201803 1 002</p>
                </div>

                <div className="sig-block">
                  <p className="sig-title">Banyuwangi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="sig-title">Mengetahui &amp; Menyetujui,</p>
                  <p className="sig-role">Kepala Direktorat TI &amp; Komputer (DTIK)</p>
                  <div className="sig-space"></div>
                  <p className="sig-name"><u>Dr. Ir. Hendra Wijaya, M.Kom</u></p>
                  <p className="sig-nip">NIP: 19780512 200501 1 004</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: LOG NEW DOWNTIME INCIDENT */}
      {showAddIncidentModal && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box form-modal">
            <div className="sla-modal-header">
              <div className="flex items-center gap-2">
                <Plus size={20} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Catat Insiden Gangguan / Downtime Baru</h2>
              </div>
              <button
                className="sla-modal-close"
                onClick={() => setShowAddIncidentModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIncident} className="sla-incident-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Tanggal Insiden</label>
                  <input
                    type="date"
                    required
                    value={incidentForm.incident_date}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incident_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tingkat Dampak (Severity)</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                  >
                    <option value="Low">Low (Gangguan Minor)</option>
                    <option value="Medium">Medium (Gangguan Sebagian)</option>
                    <option value="High">High (Gangguan Fakultas / Gedung)</option>
                    <option value="Critical">Critical (Down Total / Backbone)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Waktu Mulai Deteksi</label>
                  <input
                    type="time"
                    required
                    value={incidentForm.report_time}
                    onChange={(e) => setIncidentForm({ ...incidentForm, report_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Waktu Pulih (Resolved)</label>
                  <input
                    type="time"
                    required
                    value={incidentForm.resolved_time}
                    onChange={(e) => setIncidentForm({ ...incidentForm, resolved_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Perangkat / Sistem Terdampak</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SW-CORE-REKTORAT-01 atau AP-Gedung-B"
                  value={incidentForm.affected_system}
                  onChange={(e) => setIncidentForm({ ...incidentForm, affected_system: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Akar Masalah (Root Cause)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kabel Drop Core FO Putus atau Pemadaman Listrik PLN"
                  value={incidentForm.root_cause}
                  onChange={(e) => setIncidentForm({ ...incidentForm, root_cause: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tindakan Perbaikan yang Dilakukan</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Melakukan penyambungan fusion splicing 6 core kabel FO dan restart interface SFP"
                  value={incidentForm.action_taken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, action_taken: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Petugas / Teknisi Penanggung Jawab</label>
                  <input
                    type="text"
                    required
                    value={incidentForm.handled_by}
                    onChange={(e) => setIncidentForm({ ...incidentForm, handled_by: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Batas Waktu SLA (Menit)</label>
                  <input
                    type="number"
                    value={incidentForm.sla_limit_minutes}
                    onChange={(e) => setIncidentForm({ ...incidentForm, sla_limit_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddIncidentModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-save">
                  Simpan Insiden ke Laporan SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7B. MODAL: EDIT DOWNTIME INCIDENT */}
      {showEditIncidentModal && editingIncident && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box form-modal">
            <div className="sla-modal-header">
              <div className="flex items-center gap-2">
                <Edit2 size={20} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Edit Insiden Gangguan #{editingIncident.id}</h2>
              </div>
              <button
                className="sla-modal-close"
                onClick={() => setShowEditIncidentModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateIncident} className="sla-incident-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Tanggal Insiden</label>
                  <input
                    type="date"
                    required
                    value={editIncidentForm.incident_date}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, incident_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tingkat Dampak (Severity)</label>
                  <select
                    value={editIncidentForm.severity}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, severity: e.target.value })}
                  >
                    <option value="Low">Low (Gangguan Minor)</option>
                    <option value="Medium">Medium (Gangguan Sebagian)</option>
                    <option value="High">High (Gangguan Fakultas / Gedung)</option>
                    <option value="Critical">Critical (Down Total / Backbone)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Waktu Mulai Deteksi</label>
                  <input
                    type="time"
                    required
                    value={editIncidentForm.report_time}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, report_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label>Waktu Pulih (Resolved)</label>
                    <button
                      type="button"
                      className="text-xs text-cyan-400 hover:underline"
                      onClick={() => setEditIncidentForm({ ...editIncidentForm, resolved_time: new Date().toTimeString().substring(0, 5), status: 'Resolved' })}
                    >
                      Set Jam Sekarang
                    </button>
                  </div>
                  <input
                    type="time"
                    value={editIncidentForm.resolved_time}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, resolved_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Perangkat / Sistem Terdampak</label>
                  <input
                    type="text"
                    required
                    value={editIncidentForm.affected_system}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, affected_system: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status Penanganan</label>
                  <select
                    value={editIncidentForm.status}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, status: e.target.value })}
                  >
                    <option value="Resolved">Resolved (Sudah Pulih)</option>
                    <option value="In Progress">In Progress (Sedang Dikerjakan)</option>
                    <option value="Closed">Closed (Selesai &amp; Ditutup)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Akar Masalah (Root Cause)</label>
                <input
                  type="text"
                  required
                  value={editIncidentForm.root_cause}
                  onChange={(e) => setEditIncidentForm({ ...editIncidentForm, root_cause: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tindakan Perbaikan yang Dilakukan</label>
                <textarea
                  rows={2}
                  required
                  value={editIncidentForm.action_taken}
                  onChange={(e) => setEditIncidentForm({ ...editIncidentForm, action_taken: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Petugas / Teknisi Penanggung Jawab</label>
                  <input
                    type="text"
                    required
                    value={editIncidentForm.handled_by}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, handled_by: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Batas Waktu SLA (Menit)</label>
                  <input
                    type="number"
                    value={editIncidentForm.sla_limit_minutes}
                    onChange={(e) => setEditIncidentForm({ ...editIncidentForm, sla_limit_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-delete"
                  style={{ marginRight: 'auto', background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => {
                    handleDeleteIncident(editingIncident.id);
                    setShowEditIncidentModal(false);
                  }}
                >
                  Hapus Insiden
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditIncidentModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-save">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: QUICK SIMULATE BREACH TEST */}
      {showSimulateModal && report && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box sim-modal-box">
            <div className="sla-modal-header">
              <div className="sim-modal-title-wrap">
                <div className="sim-icon-halo">
                  <Zap size={22} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="sim-modal-title">Uji Simulasi Gangguan &amp; SLA Breach Real-time</h2>
                  <p className="sim-modal-subtitle">Pengujian deteksi otomatis toleransi ketersediaan jaringan</p>
                </div>
              </div>
              <button
                className="sla-modal-close"
                onClick={() => setShowSimulateModal(false)}
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sim-modal-content">
              {/* Info Banner */}
              <div className="sim-info-banner">
                <ShieldAlert size={20} className="text-amber-400 flex-shrink-0" />
                <p>
                  Pilih salah satu perangkat kampus di bawah ini untuk mensimulasikan pemadaman mendadak <strong>(65 Menit)</strong>.
                  Sistem akan secara instan menghitung pemotongan <strong>Uptime SLA %</strong> dan memicu status merah <strong>⚠️ BREACHED</strong> secara real-time.
                </p>
              </div>

              {/* Search Inside Modal */}
              <div className="sim-search-bar">
                <Search size={15} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari perangkat yang ingin diuji coba (Nama / IP / Gedung)..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="sim-search-input"
                />
              </div>

              {/* Device Card Grid */}
              <div className="sim-device-grid">
                {(report.devices || [])
                  .filter((d) =>
                    d.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    d.ip.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    d.location.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((dev) => (
                    <div
                      key={dev.id}
                      onClick={() => handleSimulateOutage(dev)}
                      className="sim-device-card"
                    >
                      <div className="sim-card-top">
                        <div className="sim-card-name-group">
                          {dev.isBackbone && <span className="sim-core-badge">CORE</span>}
                          <strong className="sim-device-name">{dev.name}</strong>
                        </div>
                        <span className="sim-ip-badge">{dev.ip}</span>
                      </div>

                      <div className="sim-card-meta">
                        <div className="sim-meta-location">
                          <Building2 size={13} className="text-cyan-400" />
                          <span>{dev.location}</span>
                        </div>
                        <span className="sim-target-badge">Target: {dev.targetSlaPercent}%</span>
                      </div>

                      <div className="sim-card-cta">
                        <div className="flex items-center gap-1.5">
                          <Zap size={14} className="text-amber-400" />
                          <span>Picu Gangguan Simulasi</span>
                        </div>
                        <span className="sim-arrow">&rarr;</span>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="sim-modal-footer">
                <span className="sim-footer-count">
                  Menampilkan {(report.devices || []).filter((d) => d.name.toLowerCase().includes(modalSearch.toLowerCase()) || d.ip.toLowerCase().includes(modalSearch.toLowerCase()) || d.location.toLowerCase().includes(modalSearch.toLowerCase())).length} perangkat kampus
                </span>
                <button
                  type="button"
                  className="sim-btn-close"
                  onClick={() => setShowSimulateModal(false)}
                >
                  Tutup Dialog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
