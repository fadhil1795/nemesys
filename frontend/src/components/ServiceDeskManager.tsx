import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Star,
  Printer,
  Search,
  RefreshCw,
  Plus,
  X,
  Camera,
  Layers,
  LayoutGrid,
  List,
  User,
  Building2,
  ArrowUpRight,
  Flame,
  Zap,
  ArrowRight,
  FileText,
  UserCheck,
  CheckCircle
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { UserTicket, User as TechUser } from '../types';

interface ServiceDeskProps {
  token: string;
  currentUser: { id: number; name: string; role: 'Administrator' | 'Manager' | 'Teknisi' };
  users: TechUser[];
  onRefresh?: () => void;
}

interface KpiSummary {
  total: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  rejectedCount: number;
  breachedCount: number;
  slaComplianceRate: number;
  avgCsat: number;
  totalRatings: number;
  avgMttrMinutes: number;
  priorityBreakdown: { Low: number; Medium: number; High: number; Critical: number };
  categoryCounts: Record<string, number>;
  escalationCounts: { level1: number; level2: number; level3: number };
}

const SERVICE_TYPES = [
  'Kendala Jaringan WiFi / LAN',
  'Layanan Webmail & SSO',
  'Kendala Teknis Hardware',
  'Kendala Teknis Software',
  'Koneksi Antar Gedung / Fiber Optic',
  'Request Perubahan Data Website',
  'Request Publikasi Informasi',
  'Lainnya'
];

const CATEGORIES = [
  'Mahasiswa',
  'Dosen',
  'Staf Rektorat',
  'Staf Fakultas / Prodi',
  'Pimpinan',
  'NOC Internal',
  'Lainnya'
];

const BUILDINGS = [
  'Gedung Rektorat Lt. 1-3',
  'Gedung Fakultas Teknik',
  'Gedung Fakultas Ilmu Komputer',
  'Gedung Perpustakaan Pusat',
  'Gedung Laboratorium Terpadu',
  'Gedung Pascasarjana',
  'Auditorium Utama',
  'Asrama Mahasiswa / Rusunawa',
  'Area Outdoor Kampus'
];

export const ServiceDeskManager: React.FC<ServiceDeskProps> = ({
  token,
  currentUser: _currentUser,
  users,
  onRefresh
}) => {
  // Main Data States
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [_loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // View Controls
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'noc' | 'building' | 'watchdog' | 'csat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showCsatModal, setShowCsatModal] = useState(false);
  const [showBastModal, setShowBastModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Active Ticket Selected for Actions
  const [activeTicket, setActiveTicket] = useState<UserTicket | null>(null);

  // Forms State
  const [newTicketForm, setNewTicketForm] = useState({
    full_name: '',
    id_number: '',
    category: 'Mahasiswa',
    unit_specification: 'Gedung Rektorat Lt. 1-3',
    email: '',
    whatsapp_number: '',
    service_type: 'Kendala Jaringan WiFi / LAN',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    sla_limit_minutes: 60,
    proof_before_url: ''
  });

  const [proofForm, setProofForm] = useState({
    proof_before_url: '',
    proof_after_url: ''
  });

  const [csatForm, setCsatForm] = useState({
    csat_rating: 5,
    csat_feedback: ''
  });

  const [bastSignerName, setBastSignerName] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'Resolved' | 'Closed' | 'Rejected'>('Resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Fetch Tickets & KPI Data
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [ticketsRes, kpiRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/open-tickets?limit=150`, { headers }),
        fetch(`${BACKEND_URL}/api/open-tickets/kpi-summary`, { headers })
      ]);

      if (ticketsRes.ok) {
        const tData = await ticketsRes.json();
        setTickets(tData.tickets || []);
      }
      if (kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpi(kData);
      }
    } catch (err: any) {
      console.error('Error fetching service desk data:', err);
      setError('Gagal memuat data ticketing & SLA.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData();
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, autoRefresh]);

  // SLA Calculation Helper
  const getSlaInfo = (ticket: UserTicket) => {
    const limitMins = ticket.sla_limit_minutes || 60;
    const isCompleted = ticket.status === 'Resolved' || ticket.status === 'Closed';
    
    // Parse created_at
    let createdMs = Date.now();
    try {
      if (ticket.created_at) {
        const parts = ticket.created_at.split(' ');
        if (parts[0].includes('/')) {
          const [d, m, y] = parts[0].split('/').map(Number);
          createdMs = new Date(y, m - 1, d).getTime();
        } else {
          createdMs = new Date(ticket.created_at).getTime();
        }
      }
    } catch {
      createdMs = Date.now();
    }

    const elapsedMins = Math.max(0, Math.floor((Date.now() - createdMs) / 60000));
    const remainingMins = limitMins - elapsedMins;
    const isBreached = ticket.sla_breached === 1 || ticket.sla_breached === true || (!isCompleted && remainingMins <= 0);

    let progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / limitMins) * 100)));
    if (isCompleted) progressPercent = 100;

    let statusColor = '#10b981'; // Green
    if (isBreached) {
      statusColor = '#ef4444'; // Red
    } else if (remainingMins <= 15) {
      statusColor = '#f59e0b'; // Amber
    }

    return {
      limitMins,
      elapsedMins,
      remainingMins: Math.max(0, remainingMins),
      isBreached,
      progressPercent,
      statusColor,
      isCompleted
    };
  };

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeSubTab === 'noc') {
        if (!t.service_type?.includes('Jaringan') && !t.service_type?.includes('Koneksi') && t.category !== 'NOC Internal') {
          return false;
        }
      } else if (activeSubTab === 'watchdog') {
        const sla = getSlaInfo(t);
        if (!sla.isBreached && t.status !== 'Open' && t.status !== 'In Progress') return false;
        if (!sla.isBreached && sla.remainingMins > 20) return false;
      } else if (activeSubTab === 'csat') {
        if (!t.csat_rating || t.csat_rating <= 0) return false;
      }

      if (selectedBuilding !== 'All' && !t.unit_specification?.toLowerCase().includes(selectedBuilding.toLowerCase())) {
        return false;
      }

      if (selectedCategory !== 'All' && t.category !== selectedCategory) {
        return false;
      }

      if (selectedPriority !== 'All' && t.priority !== selectedPriority) {
        return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNumber = t.ticket_number?.toLowerCase().includes(q);
        const matchName = t.full_name?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchUnit = t.unit_specification?.toLowerCase().includes(q);
        const matchTech = t.assigned_user_name?.toLowerCase().includes(q);
        if (!matchNumber && !matchName && !matchDesc && !matchUnit && !matchTech) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, activeSubTab, selectedBuilding, selectedCategory, selectedPriority, searchQuery]);

  // Actions
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTicketForm)
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewTicketForm({
          full_name: '',
          id_number: '',
          category: 'Mahasiswa',
          unit_specification: 'Gedung Rektorat Lt. 1-3',
          email: '',
          whatsapp_number: '',
          service_type: 'Kendala Jaringan WiFi / LAN',
          description: '',
          priority: 'Medium',
          sla_limit_minutes: 60,
          proof_before_url: ''
        });
        fetchData(true);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Gagal membuat tiket.');
      }
    } catch (err) {
      alert('Gagal menghubungi server.');
    }
  };

  const handleQuickStatusChange = async (ticketId: number, targetStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.ok) {
        fetchData(true);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const handleAssignTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !selectedTechId) return;
    const selectedTech = users.find((u) => u.id === parseInt(selectedTechId));

    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${activeTicket.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'In Progress',
          assigned_user_id: parseInt(selectedTechId),
          assigned_user_name: selectedTech?.name || 'Teknisi NOC'
        })
      });
      if (res.ok) {
        setShowAssignModal(false);
        setActiveTicket(null);
        setSelectedTechId('');
        fetchData(true);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert('Gagal menugaskan teknisi.');
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${activeTicket.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution_notes: resolutionNotes || 'Penanganan teknis berhasil diselesaikan oleh tim NOC.'
        })
      });
      if (res.ok) {
        setShowResolveModal(false);
        setActiveTicket(null);
        setResolutionNotes('');
        fetchData(true);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert('Gagal menyelesaikan tiket.');
    }
  };

  const handleSaveProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${activeTicket.id}/proof`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(proofForm)
      });
      if (res.ok) {
        setShowProofModal(false);
        setActiveTicket(null);
        fetchData(true);
      }
    } catch (err) {
      alert('Gagal menyimpan bukti foto.');
    }
  };

  const handleSaveCsat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${activeTicket.id}/csat`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(csatForm)
      });
      if (res.ok) {
        setShowCsatModal(false);
        setActiveTicket(null);
        fetchData(true);
      }
    } catch (err) {
      alert('Gagal menyimpan rating CSAT.');
    }
  };

  const handleGenerateBast = async (ticket: UserTicket) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${ticket.id}/bast`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bast_signer_name: bastSignerName || ticket.full_name || 'Koordinator Ruangan / Civitas'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTicket({
          ...ticket,
          bast_number: data.bast?.bast_number,
          bast_signer_name: data.bast?.bast_signer_name,
          bast_signed_at: data.bast?.bast_signed_at
        });
        fetchData(true);
      }
    } catch (err) {
      console.error('Failed to generate BAST:', err);
    }
  };

  const handleEscalateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      const nextLevel = Math.min(3, (activeTicket.escalation_level || 1) + 1);
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${activeTicket.id}/escalate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_level: nextLevel,
          escalation_reason: escalateReason || 'Eskalasi darurat karena mendekati ambang batas SLA watchdog.'
        })
      });
      if (res.ok) {
        setShowEscalateModal(false);
        setActiveTicket(null);
        setEscalateReason('');
        fetchData(true);
      }
    } catch (err) {
      alert('Gagal melakukan eskalasi tiket.');
    }
  };

  const handlePrintBastDocument = () => {
    if (!activeTicket) return;

    const bastNum = activeTicket.bast_number || `BAST/${new Date().getFullYear()}/${String(activeTicket.id).padStart(5, '0')}`;
    const dateFormatted = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Berita Acara Serah Terima - ${bastNum}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 18mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 13px;
              line-height: 1.5;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 20px;
            }
            .kop-surat {
              display: flex;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              padding-bottom: 8px;
              border-bottom: 3px double #000000;
              margin-bottom: 16px;
            }
            .kop-seal-untag {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              background: #1e3a8a;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 13px;
              font-family: sans-serif;
              border: 2px solid #fbbf24;
            }
            .kop-seal-nemesys {
              width: 64px;
              height: 64px;
              border-radius: 10px;
              background: #0f172a;
              color: #38bdf8;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 11px;
              font-family: sans-serif;
              border: 2px solid #0284c7;
            }
            .kop-text h3 {
              margin: 0;
              font-size: 14px;
              font-weight: bold;
              color: #1e3a8a;
              font-family: sans-serif;
              letter-spacing: 0.5px;
            }
            .kop-text h4 {
              margin: 2px 0;
              font-size: 12.5px;
              font-weight: bold;
              color: #334155;
              font-family: sans-serif;
            }
            .kop-text h5 {
              margin: 2px 0;
              font-size: 11.5px;
              font-weight: bold;
              color: #0284c7;
              font-family: sans-serif;
            }
            .kop-text p {
              margin: 3px 0 0 0;
              font-size: 10px;
              color: #64748b;
              font-family: sans-serif;
            }
            .doc-title-box {
              text-align: center;
              margin-bottom: 16px;
            }
            .doc-main-title {
              font-size: 13.5px;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
              margin: 0 0 4px 0;
              font-family: sans-serif;
            }
            .doc-number {
              font-family: monospace;
              font-size: 11px;
              color: #334155;
              margin: 0;
            }
            .opening-text {
              font-size: 12.5px;
              line-height: 1.6;
              text-align: justify;
              margin-bottom: 14px;
            }
            .doc-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 16px;
            }
            .doc-table th, .doc-table td {
              border: 1px solid #cbd5e1;
              padding: 7px 10px;
              vertical-align: top;
            }
            .doc-table td.label {
              width: 28%;
              font-weight: bold;
              background-color: #f8fafc;
              color: #334155;
            }
            .sla-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 11px;
              background: #dcfce7;
              color: #15803d;
            }
            .photo-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 18px;
            }
            .photo-card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 6px;
              text-align: center;
              background: #f8fafc;
            }
            .photo-card span {
              display: block;
              font-size: 11px;
              font-weight: bold;
              margin-bottom: 4px;
              font-family: sans-serif;
              color: #475569;
            }
            .photo-card img {
              width: 100%;
              height: 120px;
              object-fit: cover;
              border-radius: 4px;
            }
            .doc-signatures {
              margin-top: 30px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              text-align: center;
              font-size: 12px;
              page-break-inside: avoid;
            }
            .sig-title {
              font-weight: bold;
              margin: 0;
              color: #1e293b;
            }
            .sig-status {
              height: 65px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #64748b;
              font-style: italic;
              font-size: 11px;
            }
            .sig-name {
              font-weight: bold;
              text-decoration: underline;
              margin: 0;
              color: #0f172a;
            }
            .sig-role {
              font-size: 11px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
          </style>
        </head>
        <body>
          <div class="kop-surat">
            <div class="kop-seal-untag">UNTAG</div>
            <div class="kop-text">
              <h3>UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI</h3>
              <h4>DIREKTORAT TEKNOLOGI INFORMASI & KOMUNIKASI (DTIK)</h4>
              <h5>PUSAT DATA & INFRASTRUKTUR JARINGAN KAMPUS (NOC)</h5>
              <p>Jl. Adi Sucipto No. 26 Banyuwangi, Jawa Timur 68416 | Telp: (0333) 412345 | Web: www.untag-banyuwangi.ac.id</p>
            </div>
            <div class="kop-seal-nemesys">NEMESYS</div>
          </div>

          <div class="doc-title-box">
            <div class="doc-main-title">BERITA ACARA SERAH TERIMA PEKERJAAN PERBAIKAN IT & JARINGAN</div>
            <div class="doc-number">Nomor: ${bastNum}</div>
          </div>

          <div class="opening-text">
            Pada hari ini, tanggal <strong>${dateFormatted}</strong>, telah dilaksanakan serah terima pekerjaan pemulihan jaringan dan fasilitas teknologi informasi dengan rincian data sebagai berikut:
          </div>

          <table class="doc-table">
            <tr>
              <td class="label">Nomor Tiket Service Desk</td>
              <td style="font-family: monospace; font-weight: bold;">${activeTicket.ticket_number}</td>
            </tr>
            <tr>
              <td class="label">Nama Pelapor / Civitas</td>
              <td><strong>${activeTicket.full_name}</strong> (${activeTicket.category || 'Civitas Akademika'})</td>
            </tr>
            <tr>
              <td class="label">Gedung / Lokasi Penanganan</td>
              <td>${activeTicket.unit_specification || '-'}</td>
            </tr>
            <tr>
              <td class="label">Jenis Layanan / Kendala</td>
              <td>${activeTicket.service_type}</td>
            </tr>
            <tr>
              <td class="label">Rincian Masalah</td>
              <td>${activeTicket.description || '-'}</td>
            </tr>
            <tr>
              <td class="label">Tindakan Resolusi Teknisi</td>
              <td style="font-style: italic;">${activeTicket.resolution_notes || 'Tindakan perbaikan dan verifikasi telah selesai dilakukan secara tuntas.'}</td>
            </tr>
            <tr>
              <td class="label">Status Kepatuhan SLA</td>
              <td>
                <span class="sla-badge">✓ Terselesaikan Sesuai Target SLA (${activeTicket.sla_limit_minutes || 60} Menit)</span>
              </td>
            </tr>
          </table>

          ${(activeTicket.proof_before_url || activeTicket.proof_after_url) ? `
            <div style="font-family: sans-serif; font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #1e293b;">
              Lampiran Dokumentasi Bukti Pekerjaan:
            </div>
            <div class="photo-grid">
              ${activeTicket.proof_before_url ? `
                <div class="photo-card">
                  <span>Foto Kondisi Gangguan Awal</span>
                  <img src="${activeTicket.proof_before_url}" alt="Foto Awal" />
                </div>
              ` : ''}
              ${activeTicket.proof_after_url ? `
                <div class="photo-card">
                  <span>Foto Hasil Perbaikan Lapangan</span>
                  <img src="${activeTicket.proof_after_url}" alt="Foto Akhir" />
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="doc-signatures">
            <div>
              <p class="sig-title">PIHAK PERTAMA (Teknisi NOC)</p>
              <div class="sig-status">[Verifikasi Digital Sistem]</div>
              <p class="sig-name">${activeTicket.assigned_user_name || 'Tim NOC'}</p>
              <p class="sig-role">Divisi Infrastruktur Jaringan</p>
            </div>
            <div>
              <p class="sig-title">PIHAK KEDUA (Pemohon / Civitas)</p>
              <div class="sig-status">[Tanda Tangan Penerima]</div>
              <p class="sig-name">${activeTicket.bast_signer_name || activeTicket.full_name}</p>
              <p class="sig-role">${activeTicket.category || 'Civitas'} / Koordinator Ruangan</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="sla-report-container">
      {/* 1. HEADER & CONTROLS (Exact SLA Report Header Aesthetic) */}
      <header className="sla-header glass-panel">
        <div className="sla-title-badge">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8' }}>
            <Ticket size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                SERVICE DESK &amp; SLA TICKETING CENTER
              </h1>
              <span className="sla-official-tag">SLA COMPLIANCE MATRIX</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Konsolidasi Layanan Civitas, NOC Dispatcher, Manajemen Lapangan &amp; Penilaian CSAT
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="sla-header-actions">
          {/* Mode Switcher */}
          <div className="sla-view-switcher">
            <button
              onClick={() => setViewMode('table')}
              className={`sla-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            >
              <List size={14} />
              <span>Tabel SLA</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`sla-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            >
              <LayoutGrid size={14} />
              <span>Kanban Board</span>
            </button>
          </div>

          {/* New Ticket Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="sla-btn sla-btn-excel"
            style={{ padding: '0.5rem 1rem' }}
          >
            <Plus size={15} />
            <span>Buat Tiket Baru</span>
          </button>

          {/* Live Sync Badge / Toggle */}
          <div
            className="sla-live-sync-badge"
            style={{ cursor: 'pointer' }}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Klik untuk toggle auto-refresh"
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: autoRefresh ? '#10b981' : '#64748b'
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: autoRefresh ? '#34d399' : '#94a3b8' }}>
              {autoRefresh ? 'Live Watchdog: 15s' : 'Live Sync: Paused'}
            </span>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`sla-btn-refresh ${refreshing ? 'rotating' : ''}`}
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* 2. 5 HERO KPI CARDS (Rich SLA Theme Grid) */}
      <section className="sla-kpi-grid-5">
        {/* Card 1: Total Tiket Masuk */}
        <div className="sla-kpi-card hero-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Layers size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">TOTAL TIKET MASUK</span>
            <div className="kpi-value-row">
              <span className="kpi-value text-cyan-300">{kpi?.total ?? tickets.length}</span>
              <span className="kpi-target-tag">Tiket Civitas</span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: '100%', background: '#38bdf8' }}
              />
            </div>
            <span className="kpi-subtext" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{kpi?.openCount ?? tickets.filter(t => t.status === 'Open').length} Open</span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{kpi?.inProgressCount ?? tickets.filter(t => t.status === 'In Progress').length} Diproses</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{kpi?.resolvedCount ?? tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length} Selesai</span>
            </span>
          </div>
        </div>

        {/* Card 2: SLA Compliance % */}
        <div className="sla-kpi-card hero-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">SLA COMPLIANCE</span>
            <div className="kpi-value-row">
              <span className="kpi-value" style={{ color: '#34d399' }}>
                {kpi?.slaComplianceRate ?? 98.4}%
              </span>
              <span className="kpi-target-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                Target: 95%
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: `${Math.min(100, kpi?.slaComplianceRate ?? 98.4)}%`, background: '#10b981' }}
              />
            </div>
            <span className="kpi-subtext">
              Watchdog: <strong style={{ color: (kpi?.breachedCount ?? 0) > 0 ? '#f43f5e' : '#34d399' }}>
                {kpi?.breachedCount ?? 0} Tiket Terlewati
              </strong>
            </span>
          </div>
        </div>

        {/* Card 3: MTTR Resolusi */}
        <div className="sla-kpi-card hero-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">MTTR RESOLUSI</span>
            <div className="kpi-value-row">
              <span className="kpi-value" style={{ color: '#818cf8' }}>{kpi?.avgMttrMinutes ?? 38}</span>
              <span className="kpi-target-tag" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                Menit / Tiket
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: '70%', background: '#6366f1' }}
              />
            </div>
            <span className="kpi-subtext">
              Respon Cepat: <strong style={{ color: '#38bdf8' }}>&lt; 15 Menit Awal</strong>
            </span>
          </div>
        </div>

        {/* Card 4: CSAT Rating Kepuasan */}
        <div className="sla-kpi-card hero-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Star size={22} className="fill-amber-400" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">CSAT KEPUASAN</span>
            <div className="kpi-value-row">
              <span className="kpi-value" style={{ color: '#fbbf24' }}>
                {kpi?.avgCsat ? Number(kpi.avgCsat).toFixed(1) : '4.9'}
              </span>
              <span className="kpi-target-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                / 5.0 ⭐
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: `${((kpi?.avgCsat ?? 4.9) / 5) * 100}%`, background: '#f59e0b' }}
              />
            </div>
            <span className="kpi-subtext">
              Ulasan Civitas: <strong style={{ color: '#fbbf24' }}>{kpi?.totalRatings ?? 0} Masuk</strong>
            </span>
          </div>
        </div>

        {/* Card 5: Escalation & Watchdog Level */}
        <div className="sla-kpi-card hero-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(225, 29, 72, 0.15)', color: '#fb7185' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">MATRIKS ESKALASI</span>
            <div className="kpi-value-row">
              <span className="kpi-value" style={{ color: '#fb7185' }}>
                {(kpi?.escalationCounts?.level2 || 0) + (kpi?.escalationCounts?.level3 || 0)}
              </span>
              <span className="kpi-target-tag" style={{ background: 'rgba(225, 29, 72, 0.15)', color: '#fb7185' }}>
                Eskalasi NOC
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: '40%', background: '#e11d48' }}
              />
            </div>
            <span className="kpi-subtext" style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#c084fc' }}>L1: {kpi?.escalationCounts?.level1 || 0}</span>
              <span style={{ color: '#fbbf24' }}>L2: {kpi?.escalationCounts?.level2 || 0}</span>
              <span style={{ color: '#f43f5e', fontWeight: 800 }}>L3: {kpi?.escalationCounts?.level3 || 0}</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. SUB-TABS & ADVANCED FILTERS (Toolbar) */}
      <section className="sla-toolbar glass-panel" style={{ justifyContent: 'space-between', gap: '0.75rem' }}>
        {/* Pill Sub-Tabs */}
        <div className="sla-pill-tabs">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`sla-pill-tab ${activeSubTab === 'all' ? 'active' : ''}`}
          >
            <Layers size={13} />
            <span>Semua Tiket Civitas</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({tickets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('noc')}
            className={`sla-pill-tab ${activeSubTab === 'noc' ? 'active' : ''}`}
          >
            <Zap size={13} />
            <span>Tiket Jaringan &amp; NOC</span>
          </button>

          <button
            onClick={() => setActiveSubTab('watchdog')}
            className={`sla-pill-tab tab-watchdog ${activeSubTab === 'watchdog' ? 'active' : ''}`}
          >
            <Flame size={13} />
            <span>SLA Breach Watchdog</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>
              ({tickets.filter((t) => getSlaInfo(t).isBreached).length})
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('csat')}
            className={`sla-pill-tab tab-csat ${activeSubTab === 'csat' ? 'active' : ''}`}
          >
            <Star size={13} className="fill-current" />
            <span>Ulasan &amp; CSAT Civitas</span>
          </button>
        </div>

        {/* Filter Dropdowns and Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Category filter */}
          <div className="sla-filter-group">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="sla-select"
            >
              <option value="All">Semua Kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div className="sla-filter-group">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="sla-select"
            >
              <option value="All">Semua Prioritas</option>
              <option value="Critical">Critical (SLA 30m)</option>
              <option value="High">High (SLA 60m)</option>
              <option value="Medium">Medium (SLA 120m)</option>
              <option value="Low">Low (SLA 240m)</option>
            </select>
          </div>

          {/* Building filter */}
          <div className="sla-filter-group">
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="sla-select"
              style={{ maxWidth: '140px' }}
            >
              <option value="All">Semua Gedung</option>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="sla-search-group">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Cari tiket / nama / gedung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sla-search-input"
            />
          </div>
        </div>
      </section>

      {/* 4. MAIN CONTENT AREA: TABLE SLA VIEW vs KANBAN BOARD VIEW */}
      {viewMode === 'table' ? (
        /* TABLE SLA VIEW (High Density Performance Matrix) */
        <section className="sla-tables-section glass-panel">
          <div className="sla-table-wrapper">
            <table className="sla-table">
              <thead>
                <tr>
                  <th>Tiket &amp; Pemohon</th>
                  <th>Gedung / Unit</th>
                  <th>Layanan &amp; Masalah</th>
                  <th>Prioritas &amp; Level</th>
                  <th style={{ minWidth: '200px' }}>SLA Countdown Watchdog</th>
                  <th>Teknisi / Status</th>
                  <th>Bukti &amp; CSAT</th>
                  <th style={{ textAlign: 'right' }}>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                      <Ticket size={36} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                      <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Tidak ada tiket yang cocok dengan filter aktif.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => {
                    const sla = getSlaInfo(ticket);
                    return (
                      <tr
                        key={ticket.id}
                        className={sla.isBreached && !sla.isCompleted ? 'row-breached' : ''}
                      >
                        {/* 1. Ticket Number & Requester */}
                        <td>
                          <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8' }}>
                            {ticket.ticket_number}
                          </div>
                          <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                            {ticket.full_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {ticket.category} ({ticket.id_number || '-'})
                          </div>
                        </td>

                        {/* 2. Building / Unit */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontWeight: 600 }}>
                            <Building2 size={13} className="text-slate-400" />
                            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.unit_specification}>
                              {ticket.unit_specification || 'Kampus Utama'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            {ticket.whatsapp_number}
                          </div>
                        </td>

                        {/* 3. Service Type & Description */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{ticket.service_type}</div>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.description}>
                            {ticket.description}
                          </p>
                        </td>

                        {/* 4. Priority & Escalation Level */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`sev-badge sev-${(ticket.priority || 'medium').toLowerCase()}`}>
                              {ticket.priority || 'Medium'}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: (ticket.escalation_level || 1) === 3 ? 'rgba(225,29,72,0.3)' : 'rgba(30,41,59,0.8)',
                                color: (ticket.escalation_level || 1) === 3 ? '#fb7185' : '#94a3b8',
                                border: '1px solid rgba(71,85,105,0.4)'
                              }}
                              title={`Tingkat Eskalasi: Level ${ticket.escalation_level || 1}`}
                            >
                              L{ticket.escalation_level || 1}
                            </span>
                          </div>
                        </td>

                        {/* 5. SLA Countdown Watchdog */}
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                            <span style={{ color: sla.statusColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {sla.isCompleted ? (
                                'Selesai Sesuai SLA'
                              ) : sla.isBreached ? (
                                'SLA BREACHED!'
                              ) : (
                                `Sisa: ${sla.remainingMins} mnt`
                              )}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Target: {sla.limitMins} mnt</span>
                          </div>
                          <div className="kpi-progress-bar" style={{ height: '6px', margin: 0 }}>
                            <div
                              className="kpi-progress-fill"
                              style={{ width: `${sla.progressPercent}%`, background: sla.statusColor }}
                            />
                          </div>
                        </td>

                        {/* 6. Technician & Status */}
                        <td>
                          <span className={`status-pill ${sla.isCompleted ? 'pill-met' : 'pill-breached'}`} style={{
                            background: ticket.status === 'Open' ? 'rgba(245,158,11,0.2)' : ticket.status === 'In Progress' ? 'rgba(56,189,248,0.2)' : 'rgba(16,185,129,0.2)',
                            color: ticket.status === 'Open' ? '#fbbf24' : ticket.status === 'In Progress' ? '#38bdf8' : '#34d399',
                            borderColor: ticket.status === 'Open' ? '#f59e0b' : ticket.status === 'In Progress' ? '#0284c7' : '#10b981'
                          }}>
                            {ticket.status}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={11} />
                            <span>{ticket.assigned_user_name || 'Belum ditugaskan'}</span>
                          </div>
                        </td>

                        {/* 7. Proof Photos & CSAT */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setActiveTicket(ticket);
                                setProofForm({
                                  proof_before_url: ticket.proof_before_url || ticket.image_url || '',
                                  proof_after_url: ticket.proof_after_url || ''
                                });
                                setShowProofModal(true);
                              }}
                              className="sla-action-btn btn-edit"
                              title="Dokumentasi Foto Lapangan (Before & After)"
                            >
                              <Camera size={12} />
                              <span>{ticket.proof_after_url ? 'Foto OK' : ticket.proof_before_url ? 'Foto Awal' : 'Foto'}</span>
                            </button>

                            {ticket.csat_rating ? (
                              <div
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setCsatForm({ csat_rating: ticket.csat_rating || 5, csat_feedback: ticket.csat_feedback || '' });
                                  setShowCsatModal(true);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  color: '#fbbf24',
                                  fontWeight: 800,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                                title={ticket.csat_feedback || 'Rating Civitas'}
                              >
                                <Star size={11} className="fill-amber-400" />
                                <span>{ticket.csat_rating}.0</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setCsatForm({ csat_rating: 5, csat_feedback: '' });
                                  setShowCsatModal(true);
                                }}
                                className="sla-action-btn"
                                style={{ background: 'rgba(30,41,59,0.8)', borderColor: 'rgba(71,85,105,0.6)', color: '#94a3b8' }}
                                title="Beri Rating Kepuasan CSAT"
                              >
                                + Rating
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 8. Quick Actions Menu */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="sla-actions-wrap" style={{ justifyContent: 'flex-end' }}>
                            {ticket.status === 'Open' && (
                              <button
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setSelectedTechId(ticket.assigned_user_id ? String(ticket.assigned_user_id) : '');
                                  setShowAssignModal(true);
                                }}
                                className="sla-action-btn btn-edit"
                              >
                                Tugaskan
                              </button>
                            )}

                            {ticket.status === 'In Progress' && (
                              <button
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setResolutionStatus('Resolved');
                                  setShowResolveModal(true);
                                }}
                                className="sla-action-btn btn-resolve-quick"
                              >
                                Selesaikan
                              </button>
                            )}

                            {(ticket.status === 'Resolved' || ticket.status === 'Closed') && (
                              <button
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setBastSignerName(ticket.bast_signer_name || ticket.full_name || '');
                                  if (!ticket.bast_number) handleGenerateBast(ticket);
                                  setShowBastModal(true);
                                }}
                                className="sla-action-btn"
                                style={{ background: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' }}
                                title="Cetak Berita Acara Serah Terima (BAST)"
                              >
                                <Printer size={13} />
                                <span>BAST</span>
                              </button>
                            )}

                            {ticket.status !== 'Closed' && ticket.status !== 'Resolved' && (
                              <button
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setShowEscalateModal(true);
                                }}
                                className="sla-action-btn btn-delete"
                                title="Eskalasi ke Level Lebih Tinggi"
                              >
                                <ArrowUpRight size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* KANBAN BOARD VIEW (4-Column Drag-and-Drop Workflow) */
        <section className="kanban-board-grid">
          {/* Column 1: OPEN */}
          <div className="kanban-column">
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
                <span>Tiket Baru (Open)</span>
              </div>
              <span className="kanban-badge-count" style={{ color: '#fbbf24', borderColor: '#f59e0b' }}>
                {filteredTickets.filter((t) => t.status === 'Open').length}
              </span>
            </div>

            <div className="kanban-cards-scroll">
              {filteredTickets
                .filter((t) => t.status === 'Open')
                .map((ticket) => {
                  const sla = getSlaInfo(ticket);
                  return (
                    <div key={ticket.id} className="kanban-card">
                      <div className="kanban-card-top">
                        <span className="kanban-card-ticket">{ticket.ticket_number}</span>
                        <span className={`sev-badge sev-${(ticket.priority || 'medium').toLowerCase()}`}>
                          {ticket.priority || 'Medium'}
                        </span>
                      </div>

                      <div className="kanban-card-name">{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.description}</div>

                      {/* Watchdog Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>
                          <span style={{ color: sla.statusColor, fontWeight: 700 }}>
                            {sla.isBreached ? 'SLA Terlewati!' : `Sisa ${sla.remainingMins}m`}
                          </span>
                          <span>Target {sla.limitMins}m</span>
                        </div>
                        <div className="kpi-progress-bar" style={{ height: '4px', margin: 0 }}>
                          <div className="kpi-progress-fill" style={{ width: `${sla.progressPercent}%`, background: sla.statusColor }} />
                        </div>
                      </div>

                      <div className="kanban-card-actions">
                        <span style={{ color: '#94a3b8' }}>{ticket.unit_specification || 'Kampus'}</span>
                        <button
                          onClick={() => handleQuickStatusChange(ticket.id, 'In Progress')}
                          className="sla-action-btn btn-edit"
                        >
                          <span>Mulai</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Column 2: IN PROGRESS */}
          <div className="kanban-column">
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                <span>Sedang Dikerjakan</span>
              </div>
              <span className="kanban-badge-count">
                {filteredTickets.filter((t) => t.status === 'In Progress').length}
              </span>
            </div>

            <div className="kanban-cards-scroll">
              {filteredTickets
                .filter((t) => t.status === 'In Progress')
                .map((ticket) => {
                  const sla = getSlaInfo(ticket);
                  return (
                    <div key={ticket.id} className="kanban-card" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
                      <div className="kanban-card-top">
                        <span className="kanban-card-ticket">{ticket.ticket_number}</span>
                        <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>
                          {ticket.assigned_user_name || 'NOC'}
                        </span>
                      </div>

                      <div className="kanban-card-name">{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.description}</div>

                      {/* Watchdog Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>
                          <span style={{ color: sla.statusColor, fontWeight: 700 }}>
                            {sla.isBreached ? 'SLA Terlewati!' : `Sisa ${sla.remainingMins}m`}
                          </span>
                          <span>Target {sla.limitMins}m</span>
                        </div>
                        <div className="kpi-progress-bar" style={{ height: '4px', margin: 0 }}>
                          <div className="kpi-progress-fill" style={{ width: `${sla.progressPercent}%`, background: sla.statusColor }} />
                        </div>
                      </div>

                      <div className="kanban-card-actions">
                        <button
                          onClick={() => {
                            setActiveTicket(ticket);
                            setProofForm({
                              proof_before_url: ticket.proof_before_url || ticket.image_url || '',
                              proof_after_url: ticket.proof_after_url || ''
                            });
                            setShowProofModal(true);
                          }}
                          className="sla-action-btn"
                          style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                        >
                          <Camera size={11} />
                          <span>{ticket.proof_after_url ? 'Foto OK' : '+ Foto'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTicket(ticket);
                            setResolutionStatus('Resolved');
                            setShowResolveModal(true);
                          }}
                          className="sla-action-btn btn-resolve-quick"
                        >
                          <CheckCircle size={11} />
                          <span>Selesaikan</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Column 3: RESOLVED */}
          <div className="kanban-column">
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
                <span>Resolved &amp; Diuji</span>
              </div>
              <span className="kanban-badge-count" style={{ color: '#34d399', borderColor: '#10b981' }}>
                {filteredTickets.filter((t) => t.status === 'Resolved').length}
              </span>
            </div>

            <div className="kanban-cards-scroll">
              {filteredTickets
                .filter((t) => t.status === 'Resolved')
                .map((ticket) => (
                  <div key={ticket.id} className="kanban-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    <div className="kanban-card-top">
                      <span className="kanban-card-ticket" style={{ color: '#34d399' }}>{ticket.ticket_number}</span>
                      <span className="pill-met" style={{ fontSize: '0.65rem' }}>Resolved</span>
                    </div>

                    <div className="kanban-card-name">{ticket.full_name}</div>
                    <div className="kanban-card-desc">{ticket.resolution_notes || 'Perbaikan selesai.'}</div>

                    <div className="kanban-card-actions">
                      {ticket.csat_rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fbbf24', fontWeight: 800 }}>
                          <Star size={11} className="fill-amber-400" />
                          <span>{ticket.csat_rating}.0 ⭐</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveTicket(ticket);
                            setCsatForm({ csat_rating: 5, csat_feedback: '' });
                            setShowCsatModal(true);
                          }}
                          className="sla-action-btn"
                          style={{ color: '#fbbf24' }}
                        >
                          + CSAT
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setActiveTicket(ticket);
                          setBastSignerName(ticket.bast_signer_name || ticket.full_name || '');
                          if (!ticket.bast_number) handleGenerateBast(ticket);
                          setShowBastModal(true);
                        }}
                        className="sla-action-btn"
                        style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}
                      >
                        <Printer size={11} />
                        <span>BAST</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Column 4: CLOSED */}
          <div className="kanban-column">
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />
                <span>Closed &amp; BAST Terbit</span>
              </div>
              <span className="kanban-badge-count" style={{ color: '#c084fc', borderColor: '#a855f7' }}>
                {filteredTickets.filter((t) => t.status === 'Closed').length}
              </span>
            </div>

            <div className="kanban-cards-scroll">
              {filteredTickets
                .filter((t) => t.status === 'Closed')
                .map((ticket) => (
                  <div key={ticket.id} className="kanban-card" style={{ opacity: 0.85 }}>
                    <div className="kanban-card-top">
                      <span className="kanban-card-ticket" style={{ color: '#c084fc' }}>{ticket.ticket_number}</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{ticket.bast_number || 'BAST'}</span>
                    </div>

                    <div className="kanban-card-name" style={{ color: '#e2e8f0' }}>{ticket.full_name}</div>
                    <div className="kanban-card-desc">{ticket.resolution_notes || 'Arsip tersimpan.'}</div>

                    <div className="kanban-card-actions">
                      <span style={{ color: '#34d399', fontWeight: 600 }}>✓ Arsip BAST</span>
                      <button
                        onClick={() => {
                          setActiveTicket(ticket);
                          setShowBastModal(true);
                        }}
                        className="sla-action-btn"
                        style={{ background: 'rgba(30,41,59,0.9)', color: '#f1f5f9' }}
                      >
                        <FileText size={11} />
                        <span>Lihat</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 5. POPUP MODALS                                              */}
      {/* ============================================================ */}

      {/* A. CREATE NEW TICKET MODAL */}
      {showCreateModal && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box">
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Ticket size={20} className="text-cyan-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Buat Tiket Layanan Civitas Baru
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <div className="sla-form-grid">
                <div className="sla-form-control">
                  <label>Nama Lengkap Civitas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dr. Budi Santoso"
                    value={newTicketForm.full_name}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, full_name: e.target.value })}
                  />
                </div>
                <div className="sla-form-control">
                  <label>NIM / NIP / ID Civitas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 19820315... / 20210801..."
                    value={newTicketForm.id_number}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, id_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="sla-form-grid">
                <div className="sla-form-control">
                  <label>Kategori Civitas</label>
                  <select
                    value={newTicketForm.category}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="sla-form-control">
                  <label>Gedung / Unit Lokasi</label>
                  <select
                    value={newTicketForm.unit_specification}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, unit_specification: e.target.value })}
                  >
                    {BUILDINGS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sla-form-grid">
                <div className="sla-form-control">
                  <label>Email Resmi *</label>
                  <input
                    type="email"
                    required
                    placeholder="civitas@kampus.ac.id"
                    value={newTicketForm.email}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, email: e.target.value })}
                  />
                </div>
                <div className="sla-form-control">
                  <label>Nomor WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="081234567890"
                    value={newTicketForm.whatsapp_number}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, whatsapp_number: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div className="sla-form-control">
                  <label>Jenis Layanan</label>
                  <select
                    value={newTicketForm.service_type}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, service_type: e.target.value })}
                  >
                    {SERVICE_TYPES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div className="sla-form-control">
                  <label>Prioritas SLA</label>
                  <select
                    value={newTicketForm.priority}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      const mins = p === 'Critical' ? 30 : p === 'High' ? 60 : p === 'Medium' ? 120 : 240;
                      setNewTicketForm({ ...newTicketForm, priority: p, sla_limit_minutes: mins });
                    }}
                  >
                    <option value="Low">Low (240 Menit)</option>
                    <option value="Medium">Medium (120 Menit)</option>
                    <option value="High">High (60 Menit)</option>
                    <option value="Critical">Critical (30 Menit)</option>
                  </select>
                </div>
                <div className="sla-form-control">
                  <label>Target SLA (Menit)</label>
                  <input
                    type="number"
                    value={newTicketForm.sla_limit_minutes}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, sla_limit_minutes: parseInt(e.target.value) || 60 })}
                  />
                </div>
              </div>

              <div className="sla-form-control">
                <label>Deskripsi Kendala *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail kendala teknis, ruangan, atau kronologi..."
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Batal
                </button>
                <button type="submit" className="sla-btn sla-btn-pdf">
                  Kirim Tiket &amp; Aktifkan SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. BUKTI FOTO PENGERJAAN MODAL (Before & After) - Feature #3 */}
      {showProofModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '700px' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={20} className="text-emerald-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Dokumentasi Foto Lapangan (Before &amp; After)
                </h3>
              </div>
              <button onClick={() => setShowProofModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProof} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="proof-compare-grid">
                {/* Before */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24' }}>1. Foto Kondisi Awal (Before)</label>
                  <input
                    type="text"
                    placeholder="URL foto kondisi awal..."
                    value={proofForm.proof_before_url}
                    onChange={(e) => setProofForm({ ...proofForm, proof_before_url: e.target.value })}
                    style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(71,85,105,0.7)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8rem' }}
                  />
                  <div className="proof-img-frame">
                    {proofForm.proof_before_url ? (
                      <img src={proofForm.proof_before_url} alt="Before" onError={(e: any) => { e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image'; }} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Belum ada foto sebelum</span>
                    )}
                  </div>
                </div>

                {/* After */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399' }}>2. Foto Hasil Perbaikan (After)</label>
                  <input
                    type="text"
                    placeholder="URL foto hasil perbaikan..."
                    value={proofForm.proof_after_url}
                    onChange={(e) => setProofForm({ ...proofForm, proof_after_url: e.target.value })}
                    style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(71,85,105,0.7)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.8rem' }}
                  />
                  <div className="proof-img-frame">
                    {proofForm.proof_after_url ? (
                      <img src={proofForm.proof_after_url} alt="After" onError={(e: any) => { e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image'; }} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Belum ada foto setelah</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Tutup
                </button>
                <button type="submit" className="sla-btn sla-btn-excel">
                  Simpan Bukti Foto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. CSAT RATING & REVIEW MODAL - Feature #7 */}
      {showCsatModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '480px' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Kepuasan Layanan (CSAT)
                </h3>
              </div>
              <button onClick={() => setShowCsatModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCsat} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px 0' }}>
                  Berapa rating kepuasan penanganan tiket?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCsatForm({ ...csatForm, csat_rating: star })}
                      className="csat-star-btn"
                    >
                      <Star
                        size={32}
                        className={star <= csatForm.csat_rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                      />
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontWeight: 800, fontSize: '0.9rem', color: '#fbbf24' }}>
                  {csatForm.csat_rating === 5 && '🌟🌟🌟🌟🌟 Sangat Puas & Cepat!'}
                  {csatForm.csat_rating === 4 && '⭐⭐⭐⭐ Puas'}
                  {csatForm.csat_rating === 3 && '⭐⭐⭐ Cukup'}
                  {csatForm.csat_rating === 2 && '⭐⭐ Kurang Memuaskan'}
                  {csatForm.csat_rating === 1 && '⭐ Sangat Mengecewakan'}
                </div>
              </div>

              <div className="sla-form-control" style={{ textAlign: 'left' }}>
                <label>Masukan / Ulasan Civitas</label>
                <textarea
                  rows={3}
                  placeholder="Kesan, saran perbaikan jaringan, atau apresiasi..."
                  value={csatForm.csat_feedback}
                  onChange={(e) => setCsatForm({ ...csatForm, csat_feedback: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowCsatModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="sla-btn"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0f172a', fontWeight: 800 }}
                >
                  Simpan Rating CSAT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* D. BERITA ACARA SERAH TERIMA (BAST) MODAL - Feature #8 */}
      {showBastModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box pdf-preview-modal">
            <div className="sla-modal-header no-print" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={20} className="text-purple-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Berita Acara Serah Terima (BAST)
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handlePrintBastDocument} className="sla-btn sla-btn-pdf">
                  <Printer size={15} />
                  <span>Cetak / PDF</span>
                </button>
                <button onClick={() => setShowBastModal(false)} className="sla-btn-refresh">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Official Printable Sheet Container */}
            <div className="printable-document-container bast-print-document" id="printable-bast-doc" style={{ padding: '2.5rem', overflowY: 'auto', background: '#ffffff', color: '#0f172a' }}>
              {/* KOP SURAT RESMI */}
              <div className="doc-kop-surat">
                <div className="kop-logo-left">
                  <div className="kop-seal-untag">UNTAG</div>
                </div>
                <div className="kop-text">
                  <h3>UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI</h3>
                  <h4>DIREKTORAT TEKNOLOGI INFORMASI &amp; KOMUNIKASI (DTIK)</h4>
                  <h5>PUSAT DATA &amp; INFRASTRUKTUR JARINGAN KAMPUS (NOC)</h5>
                  <p>Jl. Adi Sucipto No. 26 Banyuwangi, Jawa Timur 68416 | Telp: (0333) 412345 | Web: www.untag-banyuwangi.ac.id</p>
                </div>
                <div className="kop-logo-right">
                  <div className="kop-seal-nemesys">NEMESYS</div>
                </div>
              </div>
              <div className="kop-divider-double"></div>

              {/* DOCUMENT META HEADER */}
              <div className="doc-meta-header" style={{ marginBottom: '1.25rem' }}>
                <h2 className="doc-main-title" style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', textDecoration: 'underline', margin: '0 0 6px 0', textAlign: 'center' }}>
                  BERITA ACARA SERAH TERIMA PEKERJAAN PERBAIKAN IT &amp; JARINGAN
                </h2>
                <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.85rem', color: '#334155' }}>
                  Nomor: {activeTicket.bast_number || `BAST/${new Date().getFullYear()}/${String(activeTicket.id).padStart(5, '0')}`}
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, textAlign: 'justify', margin: '0 0 14px 0' }}>
                Pada hari ini, tanggal <strong>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>, telah dilaksanakan serah terima pekerjaan pemulihan jaringan / fasilitas teknologi informasi dengan rincian:
              </p>

              <table className="doc-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', margin: '14px 0', border: '1px solid #cbd5e1' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700, width: '220px' }}>Nomor Tiket:</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{activeTicket.ticket_number}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Nama Pelapor / Civitas:</td>
                    <td style={{ padding: '7px 12px' }}>{activeTicket.full_name} ({activeTicket.category || 'Civitas Akademika'})</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Gedung / Lokasi:</td>
                    <td style={{ padding: '7px 12px' }}>{activeTicket.unit_specification || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Layanan / Kendala:</td>
                    <td style={{ padding: '7px 12px' }}>{activeTicket.service_type}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Rincian Masalah:</td>
                    <td style={{ padding: '7px 12px' }}>{activeTicket.description || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Tindakan Resolusi:</td>
                    <td style={{ padding: '7px 12px', fontStyle: 'italic' }}>{activeTicket.resolution_notes || 'Tindakan perbaikan dan verifikasi telah selesai dilakukan.'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Status SLA:</td>
                    <td style={{ padding: '7px 12px', color: '#059669', fontWeight: 800 }}>✓ Terselesaikan Sesuai Target SLA ({activeTicket.sla_limit_minutes || 60} Menit)</td>
                  </tr>
                </tbody>
              </table>

              {/* Photo Proof in BAST */}
              {(activeTicket.proof_before_url || activeTicket.proof_after_url) && (
                <div style={{ margin: '16px 0' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px 0', color: '#1e293b' }}>Lampiran Dokumentasi Foto:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {activeTicket.proof_before_url && (
                      <div style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', textAlign: 'center', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#475569' }}>Foto Kondisi Awal</span>
                        <img src={activeTicket.proof_before_url} alt="Before" style={{ height: '110px', width: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                    {activeTicket.proof_after_url && (
                      <div style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', textAlign: 'center', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#475569' }}>Foto Hasil Perbaikan</span>
                        <img src={activeTicket.proof_after_url} alt="After" style={{ height: '110px', width: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="doc-signatures" style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', fontSize: '0.82rem' }}>
                <div>
                  <p style={{ fontWeight: 700, margin: 0, color: '#1e293b' }}>PIHAK PERTAMA (Teknisi NOC)</p>
                  <div style={{ height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.78rem' }}>
                    [Verifikasi Digital Sistem]
                  </div>
                  <p style={{ fontWeight: 800, textDecoration: 'underline', margin: 0, color: '#0f172a' }}>{activeTicket.assigned_user_name || 'Tim NOC'}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>Divisi Infrastruktur Jaringan</p>
                </div>
                <div>
                  <p style={{ fontWeight: 700, margin: 0, color: '#1e293b' }}>PIHAK KEDUA (Pemohon / Civitas)</p>
                  <div style={{ height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.78rem' }}>
                    [Tanda Tangan Penerima]
                  </div>
                  <p style={{ fontWeight: 800, textDecoration: 'underline', margin: 0, color: '#0f172a' }}>{activeTicket.bast_signer_name || activeTicket.full_name}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>{activeTicket.category || 'Civitas'} / Koordinator Ruangan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E. ESCALATE TICKET MODAL - Feature #5 */}
      {showEscalateModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '480px', borderColor: 'rgba(225, 29, 72, 0.6)' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} className="text-rose-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Eskalasi Jenjang &amp; Watchdog
                </h3>
              </div>
              <button onClick={() => setShowEscalateModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEscalateTicket} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(225, 29, 72, 0.15)', border: '1px solid rgba(225, 29, 72, 0.4)', padding: '10px 14px', borderRadius: '8px', color: '#fecdd3', fontSize: '0.8rem' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Jenjang Saat Ini: Level {activeTicket.escalation_level || 1}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#fda4af' }}>
                  Akan dinaikkan ke <strong>Level {Math.min(3, (activeTicket.escalation_level || 1) + 1)}</strong> (Prioritas di-upgrade ke High/Critical).
                </p>
              </div>

              <div className="sla-form-control">
                <label>Alasan Eskalasi Darurat</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Modul Switch Core perlu diganti atau butuh eskalasi NOC Tier 3..."
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="sla-btn"
                  style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#ffffff', fontWeight: 800 }}
                >
                  Eksekusi Eskalasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F. ASSIGN TECHNICIAN MODAL */}
      {showAssignModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '440px' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={20} className="text-cyan-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Tugaskan Teknisi NOC
                </h3>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAssignTech} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sla-form-control">
                <label>Pilih Teknisi</label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Teknisi Tersedia --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.status || 'Available'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Batal
                </button>
                <button type="submit" className="sla-btn sla-btn-pdf">
                  Tugaskan &amp; Mulai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* G. RESOLVE TICKET MODAL */}
      {showResolveModal && activeTicket && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '460px', borderColor: 'rgba(16, 185, 129, 0.6)' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} className="text-emerald-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Selesaikan Tiket #{activeTicket.ticket_number}
                </h3>
              </div>
              <button onClick={() => setShowResolveModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResolveTicket} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sla-form-control">
                <label>Status Akhir</label>
                <select
                  value={resolutionStatus}
                  onChange={(e: any) => setResolutionStatus(e.target.value)}
                >
                  <option value="Resolved">Resolved (Tindakan Selesai &amp; Uji Coba Normal)</option>
                  <option value="Closed">Closed (Selesai &amp; Terbit BAST Langsung)</option>
                  <option value="Rejected">Rejected (Permintaan Ditolak)</option>
                </select>
              </div>

              <div className="sla-form-control">
                <label>Catatan Resolusi / Tindakan Perbaikan</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Penggantian patch cord Cat6, restart Access Point, dan verifikasi koneksi..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Batal
                </button>
                <button type="submit" className="sla-btn sla-btn-excel">
                  Konfirmasi Selesai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
