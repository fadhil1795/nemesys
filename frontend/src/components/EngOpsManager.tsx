import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  GitPullRequest, 
  ShoppingBag, 
  Database, 
  Key, 
  CheckSquare, 
  Plus, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  FileSpreadsheet,
  Trash2,
  DollarSign,
  Edit3,
  Activity,
  Ticket,
  Check,
  X
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { 
  OperationalIncident, 
  OperationalChangeRequest, 
  OperationalProcurement, 
  OperationalBackupLog, 
  OperationalAccessLog, 
  OperationalDailyChecklist,
  OperationalMonitoringReport,
  OperationalSummary 
} from '../types';

interface EngOpsManagerProps {
  currentUserRole?: string;
  currentUserName?: string;
}

export const EngOpsManager: React.FC<EngOpsManagerProps> = ({ currentUserRole = 'Administrator', currentUserName = 'Technician' }) => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'change_requests' | 'procurements' | 'backups' | 'access_logs' | 'checklist' | 'monitoring'>('incidents');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [changeRequests, setChangeRequests] = useState<OperationalChangeRequest[]>([]);
  const [procurements, setProcurements] = useState<OperationalProcurement[]>([]);
  const [backups, setBackups] = useState<OperationalBackupLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<OperationalAccessLog[]>([]);
  const [checklists, setChecklists] = useState<OperationalDailyChecklist[]>([]);
  const [monitoringReports, setMonitoringReports] = useState<OperationalMonitoringReport[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalType, setModalType] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, incRes, crRes, procRes, backRes, accRes, chkRes, monRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/operational/summary`),
        fetch(`${BACKEND_URL}/api/operational/incidents`),
        fetch(`${BACKEND_URL}/api/operational/change-requests`),
        fetch(`${BACKEND_URL}/api/operational/procurements`),
        fetch(`${BACKEND_URL}/api/operational/backup-logs`),
        fetch(`${BACKEND_URL}/api/operational/access-logs`),
        fetch(`${BACKEND_URL}/api/operational/daily-checklists`),
        fetch(`${BACKEND_URL}/api/operational/monitoring-reports`)
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (incRes.ok) setIncidents(await incRes.json());
      if (crRes.ok) setChangeRequests(await crRes.json());
      if (procRes.ok) setProcurements(await procRes.json());
      if (backRes.ok) setBackups(await backRes.json());
      if (accRes.ok) setAccessLogs(await accRes.json());
      if (chkRes.ok) setChecklists(await chkRes.json());
      if (monRes.ok) setMonitoringReports(await monRes.json());
    } catch (err) {
      console.error('Error loading operational data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewModal = (type: string) => {
    setModalMode('create');
    setEditingId(null);
    setModalType(type);
    if (type === 'incidents') {
      setFormData({
        incident_date: new Date().toISOString().split('T')[0],
        report_time: '08:00',
        affected_system: '',
        severity: 'Medium',
        description: '',
        impact: '',
        root_cause: '',
        action_taken: '',
        handled_by: currentUserName,
        status: 'In Progress',
        notes: ''
      });
    } else if (type === 'change_requests') {
      setFormData({
        request_date: new Date().toISOString().split('T')[0],
        cr_code: `CR-${Math.floor(1000 + Math.random() * 9000)}`,
        description: '',
        reason: '',
        affected_devices: '',
        requested_by: currentUserName,
        approved_by: 'Administrator',
        implementation_schedule: '',
        rollback_plan: '-',
        status: 'Diajukan',
        notes: ''
      });
    } else if (type === 'procurements') {
      setFormData({
        item_name: '',
        category: 'Elektronik',
        sub_category: 'Jaringan',
        location: 'UNTAG',
        brand: '',
        color: '',
        unit_price: 0,
        quantity: 1,
        unit_name: 'Pcs',
        acquisition_date: new Date().toISOString().split('T')[0],
        lifespan: '-',
        notes: ''
      });
    } else if (type === 'backups') {
      setFormData({
        backup_date: new Date().toISOString().split('T')[0],
        device_name: '',
        backup_type: 'Full',
        storage_location: '',
        file_size: '25kb',
        performed_by: currentUserName,
        verification_status: 'Berhasil',
        notes: ''
      });
    } else if (type === 'access_logs') {
      setFormData({
        access_date: new Date().toISOString().split('T')[0],
        access_time: '08:00:00',
        accessor_name: currentUserName,
        target_device: '',
        purpose: 'Routine Maintenance',
        access_method: 'Web/GUI',
        approved_by: 'Administrator',
        end_time: '09:00:00',
        notes: ''
      });
    } else if (type === 'checklist') {
      setFormData({
        inspection_item: '',
        is_completed: false,
        inspected_by: currentUserName,
        inspection_time: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } else if (type === 'monitoring') {
      setFormData({
        report_date: new Date().toISOString().split('T')[0],
        device_name: '',
        uptime_pct: '100%',
        bandwidth_util: '100/100',
        cpu_pct: '1.0',
        memory_pct: '10.0',
        latency_ms: '35.0',
        packet_loss_pct: '0.0',
        status: 'Normal',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const openEditModal = (type: string, item: any) => {
    setModalMode('edit');
    setEditingId(item.id);
    setModalType(type);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpointMap: Record<string, string> = {
      incidents: '/api/operational/incidents',
      change_requests: '/api/operational/change-requests',
      procurements: '/api/operational/procurements',
      backups: '/api/operational/backup-logs',
      access_logs: '/api/operational/access-logs',
      checklist: '/api/operational/daily-checklists',
      monitoring: '/api/operational/monitoring-reports'
    };

    const url = modalMode === 'create' 
      ? `${BACKEND_URL}${endpointMap[modalType]}`
      : `${BACKEND_URL}${endpointMap[modalType]}/${editingId}`;

    const method = modalMode === 'create' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    const endpointMap: Record<string, string> = {
      incidents: `/api/operational/incidents/${id}`,
      change_requests: `/api/operational/change-requests/${id}`,
      procurements: `/api/operational/procurements/${id}`,
      backups: `/api/operational/backup-logs/${id}`,
      access_logs: `/api/operational/access-logs/${id}`,
      checklist: `/api/operational/daily-checklists/${id}`,
      monitoring: `/api/operational/monitoring-reports/${id}`
    };

    try {
      const res = await fetch(`${BACKEND_URL}${endpointMap[type]}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Quick Status Update for Incidents
  const handleQuickUpdateIncidentStatus = async (item: OperationalIncident, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/incidents/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: newStatus })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Quick Status Update for Change Requests
  const handleQuickUpdateCRStatus = async (item: OperationalChangeRequest, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/change-requests/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: newStatus })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Update CR status error:', err);
    }
  };

  // Manager Approve CR
  const handleApproveCR = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/change-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: currentUserName })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  // Manager Reject CR
  const handleRejectCR = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/change-requests/${id}/reject`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  // Escalate Incident to NEMESYS Open Ticket
  const handleEscalateToTicket = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/incidents/${id}/escalate-ticket`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`Insiden berhasil di-eskalasi menjadi Tiket NEMESYS (${data.ticket_number})!`);
        fetchData();
      }
    } catch (err) {
      console.error('Escalate ticket error:', err);
    }
  };

  // Toggle Checklist Item
  const toggleChecklist = async (item: OperationalDailyChecklist) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/daily-checklists/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_completed: !item.is_completed
        })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Toggle checklist error:', err);
    }
  };

  // Quick Status Update for Monitoring Reports
  const handleQuickUpdateMonitoringStatus = async (item: OperationalMonitoringReport, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/operational/monitoring-reports/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: newStatus })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Update monitoring status error:', err);
    }
  };

  return (
    <div style={{ padding: '24px', color: 'var(--text-color, #e0e0e0)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet style={{ color: '#6366f1' }} size={28} /> Network Engineering Operations (NEO Suite)
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Dokumentasi & Manajemen Operasional Rutin Terintegrasi (`Network Engginer.xlsx`)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchData} 
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Sync Data
          </button>
          <button 
            onClick={() => openNewModal(activeTab)} 
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Plus size={16} /> Tambah Record Baru
          </button>
        </div>
      </div>

      {/* Analytics / KPI Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Insiden Aktif</span>
              <AlertTriangle size={18} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{summary.openIncidents} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>/ {summary.totalIncidents} total</span></div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>CR Pending</span>
              <GitPullRequest size={18} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{summary.pendingCRs} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>/ {summary.totalCRs} total</span></div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Total Asset IT</span>
              <DollarSign size={18} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: '#34d399' }}>
              Rp {summary.totalProcurementCost.toLocaleString('id-ID')}
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Config Backup</span>
              <Database size={18} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{summary.totalBackups} <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 400 }}>Verified</span></div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a78bfa' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Daily Checklist</span>
              <CheckSquare size={18} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{summary.completedChecklists} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>/ {summary.totalChecklists} Selesai</span></div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Link Monitoring</span>
              <Activity size={18} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{summary.warningMonitors || 0} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Warning / {summary.totalMonitors || 0} link</span></div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button 
          onClick={() => setActiveTab('incidents')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'incidents' ? '#6366f1' : 'transparent', color: activeTab === 'incidents' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <AlertTriangle size={16} /> Incidents Log ({incidents.length})
        </button>
        <button 
          onClick={() => setActiveTab('change_requests')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'change_requests' ? '#6366f1' : 'transparent', color: activeTab === 'change_requests' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <GitPullRequest size={16} /> Change Requests ({changeRequests.length})
        </button>
        <button 
          onClick={() => setActiveTab('procurements')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'procurements' ? '#6366f1' : 'transparent', color: activeTab === 'procurements' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ShoppingBag size={16} /> Pengadaan IT ({procurements.length})
        </button>
        <button 
          onClick={() => setActiveTab('backups')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'backups' ? '#6366f1' : 'transparent', color: activeTab === 'backups' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Database size={16} /> Backup Logs ({backups.length})
        </button>
        <button 
          onClick={() => setActiveTab('access_logs')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'access_logs' ? '#6366f1' : 'transparent', color: activeTab === 'access_logs' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Key size={16} /> Access Control ({accessLogs.length})
        </button>
        <button 
          onClick={() => setActiveTab('checklist')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'checklist' ? '#6366f1' : 'transparent', color: activeTab === 'checklist' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <CheckSquare size={16} /> Daily Checklist ({checklists.length})
        </button>
        <button 
          onClick={() => setActiveTab('monitoring')}
          style={{ padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: activeTab === 'monitoring' ? '#6366f1' : 'transparent', color: activeTab === 'monitoring' ? '#fff' : 'rgba(255, 255, 255, 0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Activity size={16} /> Monitoring Report ({monitoringReports.length})
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input 
            type="text" 
            placeholder="Cari kata kunci di tabel ini..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '14px' }}
          />
        </div>
      </div>

      {/* Content Tables */}

      {/* 1. Incidents Tab */}
      {activeTab === 'incidents' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Tanggal & Waktu</th>
                <th style={{ padding: '12px 16px' }}>Perangkat Terdampak</th>
                <th style={{ padding: '12px 16px' }}>Severity & SLA</th>
                <th style={{ padding: '12px 16px' }}>Deskripsi & Dampak</th>
                <th style={{ padding: '12px 16px' }}>Root Cause & Action</th>
                <th style={{ padding: '12px 16px' }}>Teknisi</th>
                <th style={{ padding: '12px 16px' }}>Status (Inline Edit)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {incidents.filter(i => i.affected_system.toLowerCase().includes(searchTerm.toLowerCase()) || i.description.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{item.incident_date}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{item.report_time} - {item.resolved_time || 'Present'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#818cf8' }}>{item.affected_system}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, width: 'fit-content',
                        background: item.severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : item.severity === 'High' ? 'rgba(249, 115, 22, 0.2)' : item.severity === 'Medium' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: item.severity === 'Critical' ? '#f87171' : item.severity === 'High' ? '#fb923c' : item.severity === 'Medium' ? '#facc15' : '#60a5fa',
                        border: `1px solid ${item.severity === 'Critical' ? '#ef4444' : item.severity === 'High' ? '#f97316' : item.severity === 'Medium' ? '#eab308' : '#3b82f6'}`
                      }}>
                        {item.severity}
                      </span>
                      <span style={{ fontSize: '11px', color: item.status === 'Resolved' || item.status === 'Closed' ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                        {item.status === 'Resolved' || item.status === 'Closed' ? '✓ SLA Met' : item.severity === 'Critical' ? '⏱️ SLA 15m' : item.severity === 'High' ? '⏱️ SLA 30m' : '⏱️ SLA 60m'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                    <div>{item.description}</div>
                    {item.impact && <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>Dampak: {item.impact}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                    {item.root_cause && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}><b>Cause:</b> {item.root_cause}</div>}
                    {item.action_taken && <div style={{ fontSize: '12px', color: '#34d399', marginTop: '2px' }}><b>Action:</b> {item.action_taken}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{item.handled_by}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select 
                      value={item.status} 
                      onChange={(e) => handleQuickUpdateIncidentStatus(item, e.target.value)}
                      style={{ 
                        padding: '4px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: item.status === 'Resolved' || item.status === 'Closed' ? '#065f46' : item.status === 'In Progress' ? '#92400e' : '#1e3a8a',
                        color: '#fff'
                      }}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button 
                      onClick={() => handleEscalateToTicket(item.id)} 
                      title="Eskalasi ke Tiket NEMESYS" 
                      style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', color: '#818cf8', borderRadius: '6px', padding: '4px 8px', marginRight: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      <Ticket size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Ticket
                    </button>
                    <button onClick={() => openEditModal('incidents', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('incidents', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Change Requests Tab */}
      {activeTab === 'change_requests' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>ID CR & Tanggal</th>
                <th style={{ padding: '12px 16px' }}>Deskripsi Perubahan</th>
                <th style={{ padding: '12px 16px' }}>Alasan / Justifikasi</th>
                <th style={{ padding: '12px 16px' }}>Perangkat Terdampak</th>
                <th style={{ padding: '12px 16px' }}>Pengaju & Approver</th>
                <th style={{ padding: '12px 16px' }}>Status (Inline Edit)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.filter(c => c.cr_code.toLowerCase().includes(searchTerm.toLowerCase()) || c.description.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: '#fbbf24' }}>{item.cr_code}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{item.request_date}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.description}</td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.8)' }}>{item.reason}</td>
                  <td style={{ padding: '12px 16px', color: '#818cf8' }}>{item.affected_devices}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div><b>Req:</b> {item.requested_by}</div>
                    <div style={{ fontSize: '12px', color: '#34d399' }}><b>App:</b> {item.approved_by || '-'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select 
                      value={item.status} 
                      onChange={(e) => handleQuickUpdateCRStatus(item, e.target.value)}
                      style={{ 
                        padding: '4px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: item.status === 'Disetujui' || item.status === 'Diimplementasi' || item.status === 'Selesai' ? '#065f46' : item.status === 'Ditolak' ? '#991b1b' : '#92400e',
                        color: '#fff'
                      }}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Diajukan">Diajukan</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Diimplementasi">Diimplementasi</option>
                      <option value="Ditolak">Ditolak</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {item.status === 'Diajukan' && currentUserRole !== 'Teknisi' && (
                      <>
                        <button onClick={() => handleApproveCR(item.id)} title="Setujui CR" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', borderRadius: '6px', padding: '4px 8px', marginRight: '4px', cursor: 'pointer' }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => handleRejectCR(item.id)} title="Tolak CR" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '6px', padding: '4px 8px', marginRight: '6px', cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </>
                    )}
                    <button onClick={() => openEditModal('change_requests', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('change_requests', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Pengadaan IT Tab */}
      {activeTab === 'procurements' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Nama Barang</th>
                <th style={{ padding: '12px 16px' }}>Kategori & Lokasi</th>
                <th style={{ padding: '12px 16px' }}>Merk / Spesifikasi</th>
                <th style={{ padding: '12px 16px' }}>Harga Satuan</th>
                <th style={{ padding: '12px 16px' }}>Jumlah</th>
                <th style={{ padding: '12px 16px' }}>Total Biaya</th>
                <th style={{ padding: '12px 16px' }}>Tgl Perolehan</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {procurements.filter(p => p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || p.location.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>{item.item_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div><span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '12px' }}>{item.category}</span></div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>📍 {item.location}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.8)' }}>{item.brand || '-'} ({item.color || '-'})</td>
                  <td style={{ padding: '12px 16px' }}>Rp {item.unit_price.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.quantity} {item.unit_name || 'Unit'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#34d399' }}>Rp {(item.unit_price * item.quantity).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{item.acquisition_date || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditModal('procurements', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('procurements', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Backup Logs Tab */}
      {activeTab === 'backups' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Tanggal</th>
                <th style={{ padding: '12px 16px' }}>Perangkat</th>
                <th style={{ padding: '12px 16px' }}>Jenis Backup</th>
                <th style={{ padding: '12px 16px' }}>Lokasi Penyimpanan (Drive)</th>
                <th style={{ padding: '12px 16px' }}>Pelaksana</th>
                <th style={{ padding: '12px 16px' }}>Status Verifikasi</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {backups.filter(b => b.device_name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.backup_date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#60a5fa' }}>{item.device_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', fontSize: '12px' }}>{item.backup_type}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {item.storage_location ? (
                      <a href={item.storage_location} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Google Drive Folder <ExternalLink size={14} />
                      </a>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{item.performed_by}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                      {item.verification_status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditModal('backups', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('backups', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Access Control Logs Tab */}
      {activeTab === 'access_logs' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Waktu Akses</th>
                <th style={{ padding: '12px 16px' }}>Pengakses</th>
                <th style={{ padding: '12px 16px' }}>Perangkat Diakses</th>
                <th style={{ padding: '12px 16px' }}>Tujuan Akses</th>
                <th style={{ padding: '12px 16px' }}>Metode</th>
                <th style={{ padding: '12px 16px' }}>Disetujui Oleh</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accessLogs.filter(a => a.accessor_name.toLowerCase().includes(searchTerm.toLowerCase()) || a.target_device.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{item.access_date}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{item.access_time} - {item.end_time || 'Finished'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#a78bfa' }}>{item.accessor_name}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>{item.target_device}</td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.8)' }}>{item.purpose}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', fontSize: '12px' }}>{item.access_method}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#34d399' }}>{item.approved_by || 'Admin'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditModal('access_logs', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('access_logs', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Daily Checklist Tab */}
      {activeTab === 'checklist' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {checklists.filter(c => c.inspection_item.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
              <div 
                key={item.id} 
                onClick={() => toggleChecklist(item)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', 
                  borderRadius: '8px', background: item.is_completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)', 
                  border: `1px solid ${item.is_completed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`, 
                  cursor: 'pointer', transition: 'all 0.2s ease' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.is_completed ? (
                    <CheckCircle size={20} style={{ color: '#10b981' }} />
                  ) : (
                    <XCircle size={20} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, textDecoration: item.is_completed ? 'line-through' : 'none', color: item.is_completed ? 'rgba(255,255,255,0.6)' : '#fff' }}>
                      {item.inspection_item}
                    </div>
                    {item.notes && <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '2px' }}>Catatan: {item.notes}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
                    <div><b>Oleh:</b> {item.inspected_by}</div>
                    <div>{item.inspection_time || '-'}</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); openEditModal('checklist', item); }} 
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer' }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete('checklist', item.id); }} 
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Monitoring Report Tab */}
      {activeTab === 'monitoring' && (
        <div style={{ overflowX: 'auto', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Tanggal</th>
                <th style={{ padding: '12px 16px' }}>Perangkat / Link</th>
                <th style={{ padding: '12px 16px' }}>Bandwidth Utilization</th>
                <th style={{ padding: '12px 16px' }}>CPU / Memory</th>
                <th style={{ padding: '12px 16px' }}>Latency (ms)</th>
                <th style={{ padding: '12px 16px' }}>Status (Inline Edit)</th>
                <th style={{ padding: '12px 16px' }}>Catatan</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {monitoringReports.filter(m => m.device_name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.notes || '').toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.report_date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#38bdf8' }}>{item.device_name}</td>
                  <td style={{ padding: '12px 16px', color: '#a78bfa', fontWeight: 600 }}>{item.bandwidth_util || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    CPU: {item.cpu_pct || '-'}% | Mem: {item.memory_pct || '-'}%
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#facc15' }}>{item.latency_ms ? `${item.latency_ms} ms` : '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select 
                      value={item.status} 
                      onChange={(e) => handleQuickUpdateMonitoringStatus(item, e.target.value)}
                      style={{ 
                        padding: '4px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: item.status === 'Normal' ? '#065f46' : item.status === 'Warning' ? '#92400e' : '#991b1b',
                        color: '#fff'
                      }}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Warning">Warning</option>
                      <option value="Nonaktif">Nonaktif</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '250px', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{item.notes || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditModal('monitoring', item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', marginRight: '6px' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete('monitoring', item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL FORM (Create & Edit) */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', width: '100%', maxWidth: '550px', padding: '24px', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>
              {modalMode === 'create' ? 'Tambah Record Operational' : 'Edit Record Operational'} - {modalType.toUpperCase()}
            </h3>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Form Fields for Incidents */}
              {modalType === 'incidents' && (
                <>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Perangkat Terdampak</label>
                    <input type="text" required value={formData.affected_system || ''} onChange={e => setFormData({...formData, affected_system: e.target.value})} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Severity</label>
                      <select value={formData.severity || 'Medium'} onChange={e => setFormData({...formData, severity: e.target.value})} style={inputStyle}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Status</label>
                      <select value={formData.status || 'In Progress'} onChange={e => setFormData({...formData, status: e.target.value})} style={inputStyle}>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Deskripsi Insiden</label>
                    <textarea required rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} style={inputStyle}></textarea>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Root Cause & Action</label>
                    <input type="text" placeholder="Akar masalah & tindakan" value={formData.action_taken || ''} onChange={e => setFormData({...formData, action_taken: e.target.value})} style={inputStyle} />
                  </div>
                </>
              )}

              {/* Form Fields for Change Requests */}
              {modalType === 'change_requests' && (
                <>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Kode CR</label>
                      <input type="text" required value={formData.cr_code || ''} onChange={e => setFormData({...formData, cr_code: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Status</label>
                      <select value={formData.status || 'Diajukan'} onChange={e => setFormData({...formData, status: e.target.value})} style={inputStyle}>
                        <option value="Draft">Draft</option>
                        <option value="Diajukan">Diajukan</option>
                        <option value="Disetujui">Disetujui</option>
                        <option value="Diimplementasi">Diimplementasi</option>
                        <option value="Ditolak">Ditolak</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Deskripsi Perubahan</label>
                    <textarea required rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} style={inputStyle}></textarea>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Alasan / Justifikasi</label>
                    <input type="text" value={formData.reason || ''} onChange={e => setFormData({...formData, reason: e.target.value})} style={inputStyle} />
                  </div>
                </>
              )}

              {/* Form Fields for Procurements */}
              {modalType === 'procurements' && (
                <>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Nama Barang</label>
                    <input type="text" required value={formData.item_name || ''} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Lokasi</label>
                      <input type="text" value={formData.location || 'UNTAG'} onChange={e => setFormData({...formData, location: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Merk</label>
                      <input type="text" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Harga Satuan (Rp)</label>
                      <input type="number" value={formData.unit_price || 0} onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value)})} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Jumlah Unit</label>
                      <input type="number" value={formData.quantity || 1} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})} style={inputStyle} />
                    </div>
                  </div>
                </>
              )}

              {/* Form Fields for Monitoring Report */}
              {modalType === 'monitoring' && (
                <>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Perangkat / Link</label>
                    <input type="text" required value={formData.device_name || ''} onChange={e => setFormData({...formData, device_name: e.target.value})} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Bandwidth Utilization</label>
                      <input type="text" value={formData.bandwidth_util || ''} onChange={e => setFormData({...formData, bandwidth_util: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Status</label>
                      <select value={formData.status || 'Normal'} onChange={e => setFormData({...formData, status: e.target.value})} style={inputStyle}>
                        <option value="Normal">Normal</option>
                        <option value="Warning">Warning</option>
                        <option value="Nonaktif">Nonaktif</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Catatan Operasional</label>
                    <input type="text" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} style={inputStyle} />
                  </div>
                </>
              )}

              {/* Form Fields for Generic Inputs */}
              {(modalType !== 'incidents' && modalType !== 'procurements' && modalType !== 'change_requests' && modalType !== 'monitoring') && (
                <>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Deskripsi / Item Utama</label>
                    <input type="text" required value={formData.description || formData.inspection_item || formData.device_name || formData.target_device || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        if (modalType === 'checklist') setFormData({...formData, inspection_item: val});
                        else if (modalType === 'backups') setFormData({...formData, device_name: val});
                        else if (modalType === 'access_logs') setFormData({...formData, target_device: val});
                        else setFormData({...formData, description: val});
                      }} 
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Catatan Tambahan</label>
                    <input type="text" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} style={inputStyle} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {modalMode === 'create' ? 'Simpan Record' : 'Perbarui Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#fff',
  fontSize: '14px',
  marginTop: '4px'
};
