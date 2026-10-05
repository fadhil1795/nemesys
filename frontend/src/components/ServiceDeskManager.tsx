import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
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
  CheckCircle,
  Calendar,
  Timer,
  Download,
  FileSpreadsheet,
  Eye,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Maximize2
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { UserTicket, User as TechUser } from '../types';

export const getPhotoUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:image')) {
    return url;
  }
  // If stored as direct S3 URL on local cluster, route via backend proxy to avoid CORS/permission errors
  if (url.includes(':30188/nemesys/')) {
    const key = url.split(':30188/nemesys/')[1];
    return `${BACKEND_URL}/api/upload/view/${key}`;
  }
  if (url.startsWith('/api/upload/view/')) {
    return `${BACKEND_URL}${url}`;
  }
  if (url.startsWith('api/upload/view/')) {
    return `${BACKEND_URL}/${url}`;
  }
  if (url.startsWith('/uploads/')) {
    return `${BACKEND_URL}${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `${BACKEND_URL}/${url}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${BACKEND_URL}/${url.replace(/^\/+/, '')}`;
};

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
  'Tendik',
  'Staf Rektorat',
  'Staf Fakultas / Prodi',
  'Pimpinan',
  'NOC Internal',
  'Lainnya'
];

const BUILDINGS = [
  'Gedung B',
  'Gedung C',
  'Gedung D',
  'Gedung F',
  'Perpustakaan',
  'Ormawa',
  'Office',
  'Rektorat',
  'PMB',
  'Perpenas',
  'BAAK'
];

export const ServiceDeskManager: React.FC<ServiceDeskProps> = ({
  token,
  currentUser,
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTicket, setDetailTicket] = useState<UserTicket | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Export Filter Parameters
  const [exportFilters, setExportFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'All',
    priority: 'All',
    category: 'All',
    building: 'All',
    slaStatus: 'All' as 'All' | 'compliant' | 'breached'
  });

  // Active Ticket Selected for Actions
  const [activeTicket, setActiveTicket] = useState<UserTicket | null>(null);

  // Forms State
  const [newTicketForm, setNewTicketForm] = useState({
    full_name: '',
    id_number: '',
    category: 'Mahasiswa',
    unit_specification: 'Gedung B',
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

  const [uploadingCreate, setUploadingCreate] = useState(false);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);

  const [bastSignerName, setBastSignerName] = useState('');
  const [bastQrCodeUrl, setBastQrCodeUrl] = useState<string>('');
  const [escalateReason, setEscalateReason] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'Resolved' | 'Closed' | 'Rejected'>('Resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Generate Digital Signature QR Code for NOC BAST
  useEffect(() => {
    if (activeTicket) {
      const bastNum = activeTicket.bast_number || `BAST/${new Date().getFullYear()}/${String(activeTicket.id).padStart(5, '0')}`;
      const qrPayload = JSON.stringify({
        dokumen: 'BERITA ACARA SERAH TERIMA (BAST) NOC',
        nomor_bast: bastNum,
        nomor_tiket: activeTicket.ticket_number,
        pemohon: activeTicket.full_name,
        lokasi: activeTicket.unit_specification || '-',
        layanan: activeTicket.service_type,
        pengesah_noc: activeTicket.assigned_user_name || 'Tim NOC Siaga',
        waktu_masuk: activeTicket.created_at,
        waktu_penyelesaian: activeTicket.resolved_at || activeTicket.updated_at,
        status: 'VERIFIED & RESOLVED BY NOC',
        institusi: 'DTIK - Universitas 17 Agustus 1945 Banyuwangi',
        sistem: 'NEMESYS Network Management System'
      }, null, 2);

      QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then((url) => {
        setBastQrCodeUrl(url);
      }).catch((err) => {
        console.error('Error generating BAST QR Code:', err);
      });
    } else {
      setBastQrCodeUrl('');
    }
  }, [activeTicket]);

  // Fetch Tickets & KPI Data with timeout and concurrency lock
  const isFetchingRef = React.useRef(false);

  const fetchData = async (isManual = false) => {
    if (isFetchingRef.current && !isManual) return;
    isFetchingRef.current = true;
    if (isManual) setRefreshing(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [ticketsRes, kpiRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/open-tickets?limit=150`, { headers, signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/open-tickets/kpi-summary`, { headers, signal: controller.signal })
      ]);

      clearTimeout(timeoutId);

      if (ticketsRes.ok) {
        const tData = await ticketsRes.json();
        setTickets(tData.tickets || []);
      }
      if (kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpi(kData);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching service desk data:', err);
        setError('Gagal memuat data ticketing & SLA.');
      }
    } finally {
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
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
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, autoRefresh]);

  // Date & Time Formatting Utilities
  const parseDateTime = (str?: string | null): Date | null => {
    if (!str) return null;
    if (typeof str === 'number') return new Date(str);
    const s = String(str).trim();
    // Match DD/MM/YYYY, HH.mm.ss or DD/MM/YYYY, HH:mm:ss
    const matchId = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2})[.:](\d{1,2})(?:[.:](\d{1,2}))?/);
    if (matchId) {
      const day = parseInt(matchId[1], 10);
      const month = parseInt(matchId[2], 10) - 1;
      const year = parseInt(matchId[3], 10);
      const hour = parseInt(matchId[4], 10);
      const min = parseInt(matchId[5], 10);
      const sec = matchId[6] ? parseInt(matchId[6], 10) : 0;
      return new Date(year, month, day, hour, min, sec);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateTimeDisplay = (str?: string | null): string => {
    const d = parseDateTime(str);
    if (!d) return str || '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${min} WIB`;
  };

  const getDurationDisplay = (startStr?: string | null, endStr?: string | null): string => {
    const start = parseDateTime(startStr);
    if (!start) return '-';
    const end = parseDateTime(endStr) || new Date();
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days > 0) return `${days}h ${remHours}j ${mins}m`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins} menit`;
  };

  // SLA Calculation Helper with accurate start & resolution time
  const getSlaInfo = (ticket: UserTicket) => {
    const limitMins = ticket.sla_limit_minutes || 60;
    const isCompleted = ticket.status === 'Resolved' || ticket.status === 'Closed';
    
    const createdDate = parseDateTime(ticket.created_at);
    const resolvedDate = parseDateTime(ticket.resolved_at || (isCompleted ? ticket.updated_at : null));
    
    const createdMs = createdDate ? createdDate.getTime() : Date.now();
    const endMs = isCompleted && resolvedDate ? resolvedDate.getTime() : Date.now();

    const elapsedMins = Math.max(0, Math.floor((endMs - createdMs) / 60000));
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

    const durationText = getDurationDisplay(ticket.created_at, isCompleted ? (ticket.resolved_at || ticket.updated_at) : null);

    return {
      limitMins,
      elapsedMins,
      remainingMins: Math.max(0, remainingMins),
      isBreached,
      progressPercent,
      statusColor,
      isCompleted,
      durationText,
      createdFormatted: formatDateTimeDisplay(ticket.created_at),
      resolvedFormatted: isCompleted ? formatDateTimeDisplay(ticket.resolved_at || ticket.updated_at) : '-'
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
          unit_specification: 'Gedung B',
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

  const handleDeleteTicket = async (ticketId: number, ticketNumber: string) => {
    const isConfirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus tiket #${ticketNumber}?\n\nPerhatian: Data tiket yang dihapus tidak dapat dipulihkan.`
    );
    if (!isConfirmed) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/open-tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
        if (showDetailModal && detailTicket?.id === ticketId) {
          setShowDetailModal(false);
          setDetailTicket(null);
        }
        fetchData(true);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Gagal menghapus tiket.');
      }
    } catch (err) {
      console.error('Failed to delete ticket:', err);
      alert('Gagal menghubungi server untuk menghapus tiket.');
    }
  };

  // Image Compression & Garage S3 / Local Storage Upload helper
  const handleUploadImage = (
    file: File,
    setLoading: (loading: boolean) => void,
    onDone: (url: string) => void
  ) => {
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          // Direct Upload to Backend (stored in Garage Object Storage or Local Physical Disk)
          const res = await fetch(`${BACKEND_URL}/api/upload/ticket-photo-base64`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ image: dataUrl, folder: 'tickets' })
          });

          if (res.ok) {
            const data = await res.json();
            onDone(data.url);
          } else {
            // Fallback to dataUrl
            onDone(dataUrl);
          }
        } catch (uploadErr) {
          console.error('Upload failed, falling back to dataUrl:', uploadErr);
          onDone(e.target?.result as string);
        } finally {
          setLoading(false);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  const handlePrintBastDocument = async () => {
    if (!activeTicket) return;

    const bastNum = activeTicket.bast_number || `BAST/${new Date().getFullYear()}/${String(activeTicket.id).padStart(5, '0')}`;
    const dateFormatted = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let currentQrUrl = bastQrCodeUrl;
    if (!currentQrUrl) {
      try {
        const qrPayload = JSON.stringify({
          dokumen: 'BERITA ACARA SERAH TERIMA (BAST) NOC',
          nomor_bast: bastNum,
          nomor_tiket: activeTicket.ticket_number,
          pemohon: activeTicket.full_name,
          lokasi: activeTicket.unit_specification || '-',
          layanan: activeTicket.service_type,
          pengesah_noc: activeTicket.assigned_user_name || 'Tim NOC Siaga',
          waktu_masuk: activeTicket.created_at,
          waktu_penyelesaian: activeTicket.resolved_at || activeTicket.updated_at,
          status: 'VERIFIED & RESOLVED BY NOC',
          institusi: 'DTIK - Universitas 17 Agustus 1945 Banyuwangi',
          sistem: 'NEMESYS Network Management System'
        }, null, 2);
        currentQrUrl = await QRCode.toDataURL(qrPayload, { width: 140, margin: 1 });
      } catch (e) {
        console.error(e);
      }
    }

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
              <td class="label">Waktu Masuk Tiket</td>
              <td style="font-weight: bold; color: #0369a1;">${formatDateTimeDisplay(activeTicket.created_at)}</td>
            </tr>
            <tr>
              <td class="label">Waktu Penyelesaian</td>
              <td style="font-weight: bold; color: #059669;">${formatDateTimeDisplay(activeTicket.resolved_at || activeTicket.updated_at)}</td>
            </tr>
            <tr>
              <td class="label">Durasi Pengerjaan</td>
              <td style="font-weight: bold; color: #7c3aed;">${getDurationDisplay(activeTicket.created_at, activeTicket.resolved_at || activeTicket.updated_at)}</td>
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
                  <img src="${getPhotoUrl(activeTicket.proof_before_url)}" alt="Foto Awal" />
                </div>
              ` : ''}
              ${activeTicket.proof_after_url ? `
                <div class="photo-card">
                  <span>Foto Hasil Perbaikan Lapangan</span>
                  <img src="${getPhotoUrl(activeTicket.proof_after_url)}" alt="Foto Akhir" />
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- PENGESAHAN ELEKTRONIK DENGAN TANDA TANGAN QR CODE NOC -->
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; text-align: center; page-break-inside: avoid;">
            <div style="width: 250px; padding: 12px; border: 1px dashed #94a3b8; border-radius: 8px; background: #f8fafc;">
              <p style="font-family: sans-serif; font-weight: bold; margin: 0 0 2px 0; color: #1e293b; font-size: 11px; text-transform: uppercase;">
                Pengesahan Elektronik NOC
              </p>
              <p style="font-family: sans-serif; margin: 0 0 8px 0; font-size: 10px; color: #64748b;">
                Direktorat TIK - Divisi Jaringan
              </p>
              <div style="display: flex; justify-content: center; margin: 6px 0;">
                ${currentQrUrl ? `
                  <img src="${currentQrUrl}" width="110" height="110" alt="QR Digital Signature NOC" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px; background: #ffffff;" />
                ` : `
                  <div style="width: 110px; height: 110px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b;">
                    [QR TTD NOC]
                  </div>
                `}
              </div>
              <p style="font-family: sans-serif; font-weight: bold; text-decoration: underline; margin: 6px 0 2px 0; color: #0f172a; font-size: 11.5px;">
                ${activeTicket.assigned_user_name || 'Tim NOC Siaga'}
              </p>
              <p style="font-family: sans-serif; font-size: 9.5px; color: #059669; font-weight: bold; margin: 0;">
                ✓ Terverifikasi Digital NEMESYS
              </p>
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

  // Filtering Helper for Export
  const getFilteredTicketsForExport = () => {
    return tickets.filter((ticket) => {
      // 1. Date filtering based on created_at
      const ticketDate = parseDateTime(ticket.created_at);
      if (ticketDate) {
        if (exportFilters.startDate) {
          const [sYear, sMonth, sDay] = exportFilters.startDate.split('-').map(Number);
          const startBound = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
          if (ticketDate < startBound) return false;
        }
        if (exportFilters.endDate) {
          const [eYear, eMonth, eDay] = exportFilters.endDate.split('-').map(Number);
          const endBound = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
          if (ticketDate > endBound) return false;
        }
      }

      // 2. Status Filter
      if (exportFilters.status !== 'All' && ticket.status !== exportFilters.status) {
        return false;
      }

      // 3. Priority Filter
      if (exportFilters.priority !== 'All' && (ticket.priority || 'Medium') !== exportFilters.priority) {
        return false;
      }

      // 4. Category Filter
      if (exportFilters.category !== 'All' && (ticket.category || '') !== exportFilters.category) {
        return false;
      }

      // 5. Building Filter
      if (exportFilters.building !== 'All' && !(ticket.unit_specification || '').includes(exportFilters.building)) {
        return false;
      }

      // 6. SLA Status Filter
      if (exportFilters.slaStatus !== 'All') {
        const sla = getSlaInfo(ticket);
        if (exportFilters.slaStatus === 'compliant') {
          if (sla.isBreached || !sla.isCompleted) return false;
        } else if (exportFilters.slaStatus === 'breached') {
          if (!sla.isBreached) return false;
        }
      }

      return true;
    });
  };

  // Export to Excel (.xlsx) Handler
  const handleExportToExcel = () => {
    const filtered = getFilteredTicketsForExport();
    if (filtered.length === 0) {
      alert('Tidak ada data tiket yang cocok dengan kriteria filter yang dipilih.');
      return;
    }

    const exportData = filtered.map((t, idx) => {
      const sla = getSlaInfo(t);
      return {
        'No': idx + 1,
        'Nomor Tiket': t.ticket_number,
        'Waktu Masuk Tiket': sla.createdFormatted,
        'Nama Pelapor': t.full_name,
        'ID / NIM / NIP': t.id_number || '-',
        'Kategori Civitas': t.category || '-',
        'Lokasi / Gedung': t.unit_specification || '-',
        'No WhatsApp': t.whatsapp_number || '-',
        'Email': t.email || '-',
        'Jenis Layanan / Kendala': t.service_type,
        'Prioritas': t.priority || 'Medium',
        'Jenjang Eskalasi': `Level ${t.escalation_level || 1}`,
        'Status Tiket': t.status,
        'Teknisi NOC': t.assigned_user_name || 'Belum ditugaskan',
        'Waktu Penyelesaian': sla.resolvedFormatted,
        'Total Durasi Pengerjaan': sla.durationText,
        'Target SLA (Menit)': t.sla_limit_minutes || 60,
        'Status Kepatuhan SLA': sla.isBreached ? 'MELANGGAR SLA (Terlambat)' : (sla.isCompleted ? 'SESUAI SLA (Tepat Waktu)' : 'Sedang Berjalan'),
        'Rating CSAT (Bintang)': t.csat_rating ? `${t.csat_rating} / 5` : 'Belum dinilai',
        'Ulasan Civitas': t.csat_feedback || '-',
        'Catatan Resolusi': t.resolution_notes || '-',
        'Foto Sebelum (Before URL)': getPhotoUrl(t.proof_before_url || t.image_url) || '-',
        'Foto Sesudah (After URL)': getPhotoUrl(t.proof_after_url) || '-',
        'Nomor BAST': t.bast_number || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Tiket Service Desk');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(workbook, `Rekap_Service_Desk_NEMESYS_${timestamp}.xlsx`);
    setShowExportModal(false);
  };

  // Export to PDF / Printable Document Handler
  const handleExportToPdf = async () => {
    const filtered = getFilteredTicketsForExport();
    if (filtered.length === 0) {
      alert('Tidak ada data tiket yang cocok dengan kriteria filter yang dipilih.');
      return;
    }

    const total = filtered.length;
    const resolvedCount = filtered.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
    const compliantCount = filtered.filter((t) => {
      const s = getSlaInfo(t);
      return !s.isBreached && s.isCompleted;
    }).length;
    const slaRate = resolvedCount > 0 ? Math.round((compliantCount / resolvedCount) * 100) : 100;
    
    const ratedTickets = filtered.filter((t) => t.csat_rating && t.csat_rating > 0);
    const avgCsat = ratedTickets.length > 0
      ? (ratedTickets.reduce((acc, t) => acc + (t.csat_rating || 0), 0) / ratedTickets.length).toFixed(1)
      : '-';

    const datePrinted = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    let reportQrUrl = '';
    try {
      const reportPayload = JSON.stringify({
        dokumen: 'LAPORAN REKAPITULASI SERVICE DESK & SLA NOC',
        tanggal_cetak: datePrinted,
        total_tiket: total,
        tiket_selesai: resolvedCount,
        sla_rate: `${slaRate}%`,
        petugas_pencetak: currentUser.name || 'Koordinator DTIK',
        institusi: 'DTIK - Universitas 17 Agustus 1945 Banyuwangi',
        sistem: 'NEMESYS'
      }, null, 2);
      reportQrUrl = await QRCode.toDataURL(reportPayload, { width: 120, margin: 1 });
    } catch (e) {
      console.error(e);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Laporan Rekapitulasi Service Desk & SLA - NEMESYS</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 10px;
              line-height: 1.35;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 10px;
            }
            .kop-surat {
              display: flex;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              padding-bottom: 6px;
              border-bottom: 3px double #000000;
              margin-bottom: 10px;
            }
            .kop-seal-untag {
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: #1e3a8a;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 11px;
              font-family: sans-serif;
              border: 2px solid #fbbf24;
            }
            .kop-seal-nemesys {
              width: 52px;
              height: 52px;
              border-radius: 8px;
              background: #0f172a;
              color: #38bdf8;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 10px;
              font-family: sans-serif;
              border: 2px solid #0284c7;
            }
            .kop-text h3 {
              margin: 0;
              font-size: 13px;
              font-weight: bold;
              color: #1e3a8a;
              font-family: sans-serif;
            }
            .kop-text h4 {
              margin: 2px 0;
              font-size: 11.5px;
              font-weight: bold;
              color: #334155;
              font-family: sans-serif;
            }
            .kop-text h5 {
              margin: 2px 0;
              font-size: 10.5px;
              font-weight: bold;
              color: #0284c7;
              font-family: sans-serif;
            }
            .kop-text p {
              margin: 2px 0 0 0;
              font-size: 9px;
              color: #64748b;
              font-family: sans-serif;
            }
            .report-title-box {
              text-align: center;
              margin-bottom: 10px;
            }
            .report-title {
              font-size: 12.5px;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
              margin: 0 0 3px 0;
              font-family: sans-serif;
            }
            .report-sub {
              font-size: 10px;
              color: #475569;
              font-family: sans-serif;
            }
            .kpi-summary-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin-bottom: 12px;
              font-family: sans-serif;
            }
            .kpi-card {
              border: 1px solid #cbd5e1;
              padding: 6px;
              border-radius: 6px;
              text-align: center;
              background: #f8fafc;
            }
            .kpi-val {
              font-size: 13px;
              font-weight: bold;
              color: #0f172a;
            }
            .kpi-lbl {
              font-size: 9px;
              color: #64748b;
              text-transform: uppercase;
            }
            .table-report {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5px;
              margin-bottom: 14px;
            }
            .table-report th, .table-report td {
              border: 1px solid #cbd5e1;
              padding: 4px 5px;
              vertical-align: middle;
            }
            .table-report th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: bold;
              text-align: left;
              font-family: sans-serif;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 5px;
              border-radius: 4px;
              font-size: 8.5px;
              font-weight: bold;
              font-family: sans-serif;
            }
            .status-resolved { background: #dcfce7; color: #166534; }
            .status-open { background: #e0f2fe; color: #075985; }
            .status-progress { background: #fef3c7; color: #92400e; }
            .photo-thumb {
              width: 52px;
              height: 40px;
              object-fit: cover;
              border-radius: 3px;
              border: 1px solid #cbd5e1;
              display: block;
              margin: 0 auto;
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

          <div class="report-title-box">
            <div class="report-title">LAPORAN REKAPITULASI SERVICE DESK &amp; KINERJA SLA NOC</div>
            <div class="report-sub">Dicetak pada: <strong>${datePrinted}</strong> | Total Data: <strong>${total} Tiket</strong></div>
          </div>

          <div class="kpi-summary-grid">
            <div class="kpi-card">
              <div class="kpi-val">${total}</div>
              <div class="kpi-lbl">Total Tiket</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val" style="color: #059669;">${resolvedCount}</div>
              <div class="kpi-lbl">Tiket Selesai</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val" style="color: #0284c7;">${slaRate}%</div>
              <div class="kpi-lbl">Kepatuhan SLA</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val" style="color: #d97706;">★ ${avgCsat}</div>
              <div class="kpi-lbl">Rata-rata CSAT</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${kpi?.avgMttrMinutes || 24} Mnt</div>
              <div class="kpi-lbl">Rata-rata MTTR</div>
            </div>
          </div>

          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 22px; text-align: center;">No</th>
                <th>No. Tiket</th>
                <th>Pelapor &amp; Unit</th>
                <th>Layanan / Kendala</th>
                <th>Waktu Masuk</th>
                <th>Waktu Selesai</th>
                <th>Durasi</th>
                <th>Status SLA</th>
                <th style="width: 58px; text-align: center;">Foto Awal</th>
                <th style="width: 58px; text-align: center;">Foto Akhir</th>
                <th>Status</th>
                <th>Teknisi NOC</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((t, idx) => {
                const sla = getSlaInfo(t);
                const badgeClass = t.status === 'Resolved' || t.status === 'Closed' ? 'status-resolved' : (t.status === 'In Progress' ? 'status-progress' : 'status-open');
                const beforeUrl = getPhotoUrl(t.proof_before_url || t.image_url);
                const afterUrl = getPhotoUrl(t.proof_after_url);

                return `
                  <tr>
                    <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                    <td style="font-family: monospace; font-weight: bold; font-size: 9px;">${t.ticket_number}</td>
                    <td><strong>${t.full_name}</strong><br><span style="color: #64748b; font-size: 8.5px;">${t.unit_specification || t.category}</span></td>
                    <td>${t.service_type}</td>
                    <td style="color: #0369a1; font-weight: bold; font-size: 9px;">${sla.createdFormatted}</td>
                    <td style="color: #059669; font-weight: bold; font-size: 9px;">${sla.resolvedFormatted}</td>
                    <td style="color: #7c3aed; font-weight: bold; font-size: 9px;">${sla.durationText}</td>
                    <td style="font-weight: bold; font-size: 9px; color: ${sla.isBreached ? '#dc2626' : '#16a34a'};">
                      ${sla.isBreached ? 'Melanggar' : (sla.isCompleted ? 'Sesuai SLA' : 'Berjalan')}
                    </td>
                    <td style="text-align: center;">
                      ${beforeUrl ? `
                        <img src="${beforeUrl}" class="photo-thumb" alt="Before" />
                      ` : '<span style="color: #94a3b8; font-size: 8px;">-</span>'}
                    </td>
                    <td style="text-align: center;">
                      ${afterUrl ? `
                        <img src="${afterUrl}" class="photo-thumb" alt="After" />
                      ` : '<span style="color: #94a3b8; font-size: 8px;">-</span>'}
                    </td>
                    <td><span class="status-badge ${badgeClass}">${t.status}</span></td>
                    <td>${t.assigned_user_name || '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- LAMPIRAN DOKUMENTASI BUKTI FOTO PENGERJAAN (BEFORE & AFTER) -->
          ${filtered.some((t) => t.proof_before_url || t.image_url || t.proof_after_url) ? `
            <div style="margin-top: 22px; page-break-inside: avoid;">
              <div style="font-family: sans-serif; font-weight: bold; font-size: 12px; margin-bottom: 10px; color: #1e293b; border-bottom: 2px solid #0284c7; padding-bottom: 4px; text-transform: uppercase;">
                Lampiran Dokumentasi Bukti Foto Lapangan (Before &amp; After)
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
                ${filtered.filter((t) => t.proof_before_url || t.image_url || t.proof_after_url).map((t) => {
                  const bUrl = getPhotoUrl(t.proof_before_url || t.image_url);
                  const aUrl = getPhotoUrl(t.proof_after_url);
                  return `
                    <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; font-family: sans-serif; font-size: 9.5px; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                      <div style="font-weight: bold; color: #0284c7; margin-bottom: 4px; display: flex; justify-content: space-between; font-size: 11px;">
                        <span>${t.ticket_number}</span>
                        <span style="color: #475569; font-size: 9.5px;">${t.service_type}</span>
                      </div>
                      <div style="color: #1e293b; margin-bottom: 8px; font-weight: 600; font-size: 10px;">
                        ${t.full_name} <span style="color: #64748b; font-weight: normal;">— ${t.unit_specification || t.category}</span>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center;">
                        <div style="background: #ffffff; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
                          <span style="display: block; font-size: 9px; font-weight: bold; color: #b45309; margin-bottom: 4px; text-transform: uppercase;">1. Foto Awal (Before)</span>
                          ${bUrl ? `
                            <img src="${bUrl}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; display: block;" alt="Before" />
                          ` : '<div style="height: 160px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 9px; font-style: italic;">Tidak Ada Foto</div>'}
                        </div>
                        <div style="background: #ffffff; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
                          <span style="display: block; font-size: 9px; font-weight: bold; color: #047857; margin-bottom: 4px; text-transform: uppercase;">2. Foto Akhir (After)</span>
                          ${aUrl ? `
                            <img src="${aUrl}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; display: block;" alt="After" />
                          ` : '<div style="height: 160px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 9px; font-style: italic;">Tidak Ada Foto</div>'}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin-top: 16px; display: flex; justify-content: flex-end; text-align: center; page-break-inside: avoid;">
            <div style="width: 240px; padding: 10px; border: 1px dashed #94a3b8; border-radius: 6px; background: #f8fafc;">
              <p style="font-family: sans-serif; font-weight: bold; margin: 0 0 2px 0; color: #1e293b; font-size: 10.5px; text-transform: uppercase;">
                Pengesahan Rekapitulasi NOC
              </p>
              <p style="font-family: sans-serif; margin: 0 0 6px 0; font-size: 9.5px; color: #64748b;">
                Direktorat TIK - UNTAG Banyuwangi
              </p>
              ${reportQrUrl ? `
                <div style="display: flex; justify-content: center; margin: 4px 0;">
                  <img src="${reportQrUrl}" width="85" height="85" alt="QR Pengesahan Laporan" style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; background: #ffffff;" />
                </div>
              ` : ''}
              <p style="font-family: sans-serif; font-weight: bold; text-decoration: underline; margin: 4px 0 1px 0; color: #0f172a; font-size: 11px;">
                ${currentUser.name || 'Koordinator DTIK / NOC'}
              </p>
              <p style="font-family: sans-serif; font-size: 9px; color: #059669; font-weight: bold; margin: 0;">
                ✓ Dokumen Laporan Sah NEMESYS
              </p>
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

          {/* Export Report Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="sla-btn sla-btn-pdf"
            style={{ padding: '0.5rem 1rem' }}
            title="Export Rekap Tiket ke Excel atau PDF"
          >
            <Download size={15} />
            <span>Export Laporan</span>
          </button>

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
                  <th style={{ minWidth: '220px' }}>SLA &amp; Waktu Pengerjaan</th>
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
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#38bdf8', marginTop: '4px', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                            <Calendar size={11} />
                            <span>Masuk: {sla.createdFormatted}</span>
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

                        {/* 5. SLA & Waktu Pengerjaan */}
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                            <span style={{ color: sla.statusColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {sla.isCompleted ? (
                                'Selesai'
                              ) : sla.isBreached ? (
                                'SLA BREACHED!'
                              ) : (
                                `Sisa: ${sla.remainingMins} mnt`
                              )}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target: {sla.limitMins} mnt</span>
                          </div>
                          <div className="kpi-progress-bar" style={{ height: '6px', margin: '0 0 5px 0' }}>
                            <div
                              className="kpi-progress-fill"
                              style={{ width: `${sla.progressPercent}%`, background: sla.statusColor }}
                            />
                          </div>
                          {sla.isCompleted ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                              <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                <CheckCircle2 size={11} />
                                <span>Selesai: {sla.resolvedFormatted}</span>
                              </div>
                              <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Timer size={11} className="text-cyan-400" />
                                <span>Total Waktu: <strong style={{ color: '#e2e8f0' }}>{sla.durationText}</strong></span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#fbbf24' }}>
                              <Timer size={11} />
                              <span>Berjalan: <strong style={{ color: '#f8fafc' }}>{sla.durationText}</strong></span>
                            </div>
                          )}
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
                          <div className="sla-actions-wrap" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                            <button
                              onClick={() => {
                                setDetailTicket(ticket);
                                setShowDetailModal(true);
                              }}
                              className="sla-action-btn"
                              style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 700 }}
                              title="Lihat Detail Lengkap Tiket"
                            >
                              <Eye size={12} />
                              <span>Detail</span>
                            </button>

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

                            <button
                              onClick={() => handleDeleteTicket(ticket.id, ticket.ticket_number)}
                              className="sla-action-btn"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                              title="Hapus Tiket"
                            >
                              <Trash2 size={13} />
                            </button>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className={`sev-badge sev-${(ticket.priority || 'medium').toLowerCase()}`}>
                            {ticket.priority || 'Medium'}
                          </span>
                          <button
                            onClick={() => {
                              setDetailTicket(ticket);
                              setShowDetailModal(true);
                            }}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                            title="Detail Tiket"
                          >
                            <Eye size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id, ticket.ticket_number)}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                            title="Hapus Tiket"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="kanban-card-name">{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.description}</div>

                      {/* Timestamps */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#38bdf8', margin: '4px 0' }}>
                        <Calendar size={10} />
                        <span>Masuk: {sla.createdFormatted}</span>
                      </div>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>
                            {ticket.assigned_user_name || 'NOC'}
                          </span>
                          <button
                            onClick={() => {
                              setDetailTicket(ticket);
                              setShowDetailModal(true);
                            }}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                            title="Detail Tiket"
                          >
                            <Eye size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id, ticket.ticket_number)}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                            title="Hapus Tiket"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="kanban-card-name">{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.description}</div>

                      {/* Timestamps */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '4px 0', fontSize: '0.68rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                          <Calendar size={10} />
                          <span>Masuk: {sla.createdFormatted}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontWeight: 700 }}>
                          <Timer size={10} />
                          <span>Waktu Berjalan: {sla.durationText}</span>
                        </div>
                      </div>

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
                .map((ticket) => {
                  const sla = getSlaInfo(ticket);
                  return (
                    <div key={ticket.id} className="kanban-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                      <div className="kanban-card-top">
                        <span className="kanban-card-ticket" style={{ color: '#34d399' }}>{ticket.ticket_number}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="pill-met" style={{ fontSize: '0.65rem' }}>Resolved</span>
                          <button
                            onClick={() => {
                              setDetailTicket(ticket);
                              setShowDetailModal(true);
                            }}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                            title="Detail Tiket"
                          >
                            <Eye size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id, ticket.ticket_number)}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                            title="Hapus Tiket"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="kanban-card-name">{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.resolution_notes || 'Perbaikan selesai.'}</div>

                      {/* Timestamps & Duration */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '4px 0', fontSize: '0.68rem', background: 'rgba(15,23,42,0.6)', padding: '4px 6px', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                          <Calendar size={10} />
                          <span>Masuk: {sla.createdFormatted}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                          <CheckCircle2 size={10} />
                          <span>Selesai: {sla.resolvedFormatted}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                          <Timer size={10} />
                          <span>Total Durasi: <strong>{sla.durationText}</strong></span>
                        </div>
                      </div>

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
                  );
                })}
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
                .map((ticket) => {
                  const sla = getSlaInfo(ticket);
                  return (
                    <div key={ticket.id} className="kanban-card" style={{ opacity: 0.9 }}>
                      <div className="kanban-card-top">
                        <span className="kanban-card-ticket" style={{ color: '#c084fc' }}>{ticket.ticket_number}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{ticket.bast_number || 'BAST'}</span>
                          <button
                            onClick={() => {
                              setDetailTicket(ticket);
                              setShowDetailModal(true);
                            }}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                            title="Detail Tiket"
                          >
                            <Eye size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id, ticket.ticket_number)}
                            className="sla-action-btn"
                            style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                            title="Hapus Tiket"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="kanban-card-name" style={{ color: '#e2e8f0' }}>{ticket.full_name}</div>
                      <div className="kanban-card-desc">{ticket.resolution_notes || 'Arsip tersimpan.'}</div>

                      {/* Timestamps & Duration */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '4px 0', fontSize: '0.68rem', background: 'rgba(15,23,42,0.6)', padding: '4px 6px', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                          <Calendar size={10} />
                          <span>Masuk: {sla.createdFormatted}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                          <CheckCircle2 size={10} />
                          <span>Selesai: {sla.resolvedFormatted}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc' }}>
                          <Timer size={10} />
                          <span>Total Durasi: <strong>{sla.durationText}</strong></span>
                        </div>
                      </div>

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
                  );
                })}
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

              {/* Lampiran Foto Kendala */}
              <div className="sla-form-control">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Lampiran Foto Kendala (Cloud/Storage)</span>
                  {newTicketForm.proof_before_url && (
                    <button
                      type="button"
                      onClick={() => setNewTicketForm({ ...newTicketForm, proof_before_url: '' })}
                      style={{ fontSize: '0.72rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="file"
                    id="new-ticket-photo-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadImage(e.target.files[0], setUploadingCreate, (url) => {
                          setNewTicketForm({ ...newTicketForm, proof_before_url: url });
                        });
                      }
                    }}
                  />
                  <label
                    htmlFor="new-ticket-photo-upload"
                    className="sla-btn"
                    style={{ 
                      background: uploadingCreate ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.15)', 
                      color: '#38bdf8', 
                      border: '1px solid rgba(56, 189, 248, 0.4)', 
                      cursor: uploadingCreate ? 'wait' : 'pointer', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.78rem' 
                    }}
                  >
                    <Camera size={14} className={uploadingCreate ? 'animate-spin' : ''} />
                    <span>{uploadingCreate ? 'Mengunggah ke Storage...' : newTicketForm.proof_before_url ? 'Ganti Foto' : 'Unggah / Ambil Foto'}</span>
                  </label>
                  {newTicketForm.proof_before_url && !uploadingCreate && (
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>✓ File fisik tersimpan</span>
                  )}
                </div>
                {newTicketForm.proof_before_url && (
                  <div style={{ marginTop: '8px', maxHeight: '120px', overflow: 'hidden', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.8)' }}>
                    <img src={getPhotoUrl(newTicketForm.proof_before_url)} alt="Preview" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                  </div>
                )}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}>1. Foto Kondisi Awal (Before)</label>
                    <input
                      type="file"
                      id="proof-before-file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadImage(e.target.files[0], setUploadingBefore, (url) => {
                            setProofForm({ ...proofForm, proof_before_url: url });
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor="proof-before-file"
                      style={{ fontSize: '0.72rem', color: '#fbbf24', background: uploadingBefore ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '4px', padding: '3px 8px', cursor: uploadingBefore ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                    >
                      <Camera size={12} className={uploadingBefore ? 'animate-spin' : ''} /> {uploadingBefore ? 'Mengunggah...' : 'Ambil / Upload Foto'}
                    </label>
                  </div>
                  <div className="proof-img-frame" style={{ minHeight: '140px', background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.7)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {proofForm.proof_before_url ? (
                      <img src={getPhotoUrl(proofForm.proof_before_url)} alt="Before" style={{ width: '100%', height: '160px', objectFit: 'cover' }} onError={(e: any) => { e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image'; }} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Belum ada foto sebelum</span>
                    )}
                  </div>
                </div>

                {/* After */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', margin: 0 }}>2. Foto Hasil Perbaikan (After)</label>
                    <input
                      type="file"
                      id="proof-after-file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadImage(e.target.files[0], setUploadingAfter, (url) => {
                            setProofForm({ ...proofForm, proof_after_url: url });
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor="proof-after-file"
                      style={{ fontSize: '0.72rem', color: '#34d399', background: uploadingAfter ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '4px', padding: '3px 8px', cursor: uploadingAfter ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                    >
                      <Camera size={12} className={uploadingAfter ? 'animate-spin' : ''} /> {uploadingAfter ? 'Mengunggah...' : 'Ambil / Upload Foto'}
                    </label>
                  </div>
                  <div className="proof-img-frame" style={{ minHeight: '140px', background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.7)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {proofForm.proof_after_url ? (
                      <img src={getPhotoUrl(proofForm.proof_after_url)} alt="After" style={{ width: '100%', height: '160px', objectFit: 'cover' }} onError={(e: any) => { e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image'; }} />
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
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Waktu Masuk Tiket:</td>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0369a1' }}>{formatDateTimeDisplay(activeTicket.created_at)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Waktu Penyelesaian:</td>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: '#059669' }}>{formatDateTimeDisplay(activeTicket.resolved_at || activeTicket.updated_at)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700 }}>Durasi Pengerjaan:</td>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: '#7c3aed' }}>{getDurationDisplay(activeTicket.created_at, activeTicket.resolved_at || activeTicket.updated_at)}</td>
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
                        <img src={getPhotoUrl(activeTicket.proof_before_url)} alt="Before" style={{ height: '110px', width: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                    {activeTicket.proof_after_url && (
                      <div style={{ border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', textAlign: 'center', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#475569' }}>Foto Hasil Perbaikan</span>
                        <img src={getPhotoUrl(activeTicket.proof_after_url)} alt="After" style={{ height: '110px', width: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pengesahan Elektronik Single QR Code NOC */}
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', textAlign: 'center' }}>
                <div style={{ width: '250px', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                  <p style={{ fontWeight: 800, margin: '0 0 2px 0', color: '#1e293b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    Pengesahan Elektronik NOC
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Direktorat TIK - Divisi Jaringan
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                    {bastQrCodeUrl ? (
                      <img
                        src={bastQrCodeUrl}
                        alt="QR Tanda Tangan Digital NOC"
                        style={{ width: '110px', height: '110px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px', background: '#ffffff' }}
                      />
                    ) : (
                      <div style={{ width: '110px', height: '110px', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b', background: '#ffffff' }}>
                        [QR TTD NOC]
                      </div>
                    )}
                  </div>
                  <p style={{ fontWeight: 800, textDecoration: 'underline', margin: '6px 0 2px 0', color: '#0f172a', fontSize: '0.82rem' }}>
                    {activeTicket.assigned_user_name || 'Tim NOC Siaga'}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, margin: 0 }}>
                    ✓ Terverifikasi Digital NEMESYS
                  </p>
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
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>Waktu Masuk Tiket:</span>
                  <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{formatDateTimeDisplay(activeTicket.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>Durasi Pengerjaan Berjalan:</span>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>{getDurationDisplay(activeTicket.created_at, null)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>Target SLA:</span>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>{activeTicket.sla_limit_minutes || 60} Menit</span>
                </div>
              </div>

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

      {/* H. EXPORT REPORT MODAL - Excel & PDF with Date Range */}
      {showExportModal && (
        <div className="sla-modal-overlay">
          <div className="sla-modal-box" style={{ maxWidth: '620px', borderColor: 'rgba(56, 189, 248, 0.5)' }}>
            <div className="sla-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={20} className="text-sky-400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Export Rekapitulasi Tiket &amp; SLA
                </h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="sla-btn-refresh">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* 1. Date Range Filter Section with <input type="date"> */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <Calendar size={15} /> Rentang Tanggal Tiket (Date Range)
                  </label>
                  {(exportFilters.startDate || exportFilters.endDate) && (
                    <button
                      type="button"
                      onClick={() => setExportFilters({ ...exportFilters, startDate: '', endDate: '' })}
                      style={{ fontSize: '0.72rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Reset Tanggal
                    </button>
                  )}
                </div>

                {/* Direct Date Range Pickers (type="date") */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div className="sla-form-control">
                    <label style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Dari Tanggal (Mulai)</label>
                    <input
                      type="date"
                      value={exportFilters.startDate}
                      onChange={(e) => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                      style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                    />
                  </div>
                  <div className="sla-form-control">
                    <label style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Sampai Tanggal (Selesai)</label>
                    <input
                      type="date"
                      value={exportFilters.endDate}
                      onChange={(e) => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                      style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                    />
                  </div>
                </div>

                {/* Quick Date Shortcuts that auto-fill the date inputs */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginRight: '4px' }}>Preset Cepat:</span>
                  {[
                    {
                      label: 'Semua Waktu',
                      action: () => setExportFilters({ ...exportFilters, startDate: '', endDate: '' })
                    },
                    {
                      label: 'Hari Ini',
                      action: () => {
                        const today = new Date().toISOString().split('T')[0];
                        setExportFilters({ ...exportFilters, startDate: today, endDate: today });
                      }
                    },
                    {
                      label: '7 Hari Terakhir',
                      action: () => {
                        const today = new Date();
                        const past = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        setExportFilters({
                          ...exportFilters,
                          startDate: past.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        });
                      }
                    },
                    {
                      label: 'Bulan Ini',
                      action: () => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                        const today = now.toISOString().split('T')[0];
                        setExportFilters({ ...exportFilters, startDate: start, endDate: today });
                      }
                    },
                    {
                      label: 'Bulan Lalu',
                      action: () => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                        const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                        setExportFilters({ ...exportFilters, startDate: start, endDate: end });
                      }
                    },
                    {
                      label: 'Tahun 2026',
                      action: () => {
                        setExportFilters({ ...exportFilters, startDate: '2026-01-01', endDate: '2026-12-31' });
                      }
                    }
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={p.action}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'rgba(30,41,59,0.8)',
                        border: '1px solid rgba(71,85,105,0.7)',
                        color: '#94a3b8'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Additional Filter Selectors Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="sla-form-control">
                  <label>Status Tiket</label>
                  <select
                    value={exportFilters.status}
                    onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value })}
                  >
                    <option value="All">Semua Status</option>
                    <option value="Open">Open (Baru Masuk)</option>
                    <option value="In Progress">In Progress (Sedang Dikerjakan)</option>
                    <option value="Resolved">Resolved (Tindakan Selesai)</option>
                    <option value="Closed">Closed (Ditutup &amp; BAST)</option>
                    <option value="Rejected">Rejected (Ditolak)</option>
                  </select>
                </div>

                <div className="sla-form-control">
                  <label>Prioritas Layanan</label>
                  <select
                    value={exportFilters.priority}
                    onChange={(e) => setExportFilters({ ...exportFilters, priority: e.target.value })}
                  >
                    <option value="All">Semua Prioritas</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="sla-form-control">
                  <label>Kategori Civitas</label>
                  <select
                    value={exportFilters.category}
                    onChange={(e) => setExportFilters({ ...exportFilters, category: e.target.value })}
                  >
                    <option value="All">Semua Kategori</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="sla-form-control">
                  <label>Lokasi / Gedung Kampus</label>
                  <select
                    value={exportFilters.building}
                    onChange={(e) => setExportFilters({ ...exportFilters, building: e.target.value })}
                  >
                    <option value="All">Semua Lokasi / Gedung</option>
                    {BUILDINGS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="sla-form-control" style={{ gridColumn: 'span 2' }}>
                  <label>Kepatuhan SLA</label>
                  <select
                    value={exportFilters.slaStatus}
                    onChange={(e: any) => setExportFilters({ ...exportFilters, slaStatus: e.target.value })}
                  >
                    <option value="All">Semua Kepatuhan (Sesuai &amp; Melanggar)</option>
                    <option value="compliant">Hanya yang Sesuai SLA (Tepat Waktu)</option>
                    <option value="breached">Hanya yang Melanggar SLA (Terlambat)</option>
                  </select>
                </div>
              </div>

              {/* 4. Live Counter Match Banner */}
              {(() => {
                const count = getFilteredTicketsForExport().length;
                return (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: count > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: count > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}>
                    <span style={{ color: count > 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>
                      {count > 0 ? `🎯 Ditemukan ${count} tiket yang siap diekspor` : '⚠️ Tidak ada tiket yang cocok dengan kriteria filter saat ini'}
                    </span>
                    <span style={{ fontWeight: 800, color: '#ffffff', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                      {count} / {tickets.length} Tiket
                    </span>
                  </div>
                );
              })()}

              {/* 5. Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.8)', color: '#cbd5e1' }}
                >
                  Tutup
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleExportToPdf}
                    className="sla-btn sla-btn-pdf"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff', fontWeight: 700 }}
                    title="Cetak atau simpan sebagai dokumen PDF"
                  >
                    <Printer size={15} />
                    <span>Export PDF / Cetak</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportToExcel}
                    className="sla-btn sla-btn-excel"
                    style={{ fontWeight: 800 }}
                    title="Download file spreadsheet Excel (.xlsx)"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Export Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G. TICKET DETAIL MODAL (INSPECTOR MODAL) */}
      {showDetailModal && detailTicket && (
        <div className="sla-modal-overlay">
          <div
            className="sla-modal-box"
            style={{
              maxWidth: '880px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}
          >
            {/* 1. Modal Header */}
            <div
              className="sla-modal-header"
              style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(51, 65, 85, 0.8)',
                background: 'rgba(15, 23, 42, 0.6)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8'
                    }}
                  >
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'monospace' }}>
                      {detailTicket.ticket_number}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Detail Lengkap &amp; Status Pelacakan Tiket</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className={`status-pill ${
                      detailTicket.status === 'Open'
                        ? 'pill-breached'
                        : detailTicket.status === 'In Progress'
                        ? 'pill-breached'
                        : 'pill-met'
                    }`}
                    style={{
                      background:
                        detailTicket.status === 'Open'
                          ? 'rgba(245,158,11,0.2)'
                          : detailTicket.status === 'In Progress'
                          ? 'rgba(56,189,248,0.2)'
                          : 'rgba(16,185,129,0.2)',
                      color:
                        detailTicket.status === 'Open'
                          ? '#fbbf24'
                          : detailTicket.status === 'In Progress'
                          ? '#38bdf8'
                          : '#34d399',
                      borderColor:
                        detailTicket.status === 'Open'
                          ? '#f59e0b'
                          : detailTicket.status === 'In Progress'
                          ? '#0284c7'
                          : '#10b981',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    {detailTicket.status}
                  </span>

                  <span className={`sev-badge sev-${(detailTicket.priority || 'medium').toLowerCase()}`}>
                    Prioritas {detailTicket.priority || 'Medium'}
                  </span>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: (detailTicket.escalation_level || 1) === 3 ? 'rgba(225,29,72,0.3)' : 'rgba(30,41,59,0.8)',
                      color: (detailTicket.escalation_level || 1) === 3 ? '#fb7185' : '#94a3b8',
                      border: '1px solid rgba(71,85,105,0.4)'
                    }}
                  >
                    Level {detailTicket.escalation_level || 1}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="sla-modal-close"
                style={{
                  background: 'rgba(51, 65, 85, 0.5)',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Modal Body Scrollable */}
            <div
              style={{
                padding: '1.5rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                maxHeight: 'calc(90vh - 145px)'
              }}
            >
              {/* SLA Metric Bar & Duration Banner */}
              {(() => {
                const sla = getSlaInfo(detailTicket);
                return (
                  <div
                    style={{
                      background: sla.isBreached && !sla.isCompleted ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.8)',
                      border: `1px solid ${sla.statusColor}44`,
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Timer size={18} style={{ color: sla.statusColor }} />
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>
                          SLA Watchdog: {sla.isCompleted ? 'Tiket Telah Selesai' : sla.isBreached ? '⚠️ SLA BREACHED (Terlambat)' : '🟢 SLA Berjalan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem' }}>
                        <span style={{ color: '#94a3b8' }}>Target: <strong style={{ color: '#e2e8f0' }}>{sla.limitMins} Menit</strong></span>
                        <span style={{ color: sla.statusColor, fontWeight: 700 }}>
                          {sla.isCompleted ? `Total Durasi: ${sla.durationText}` : sla.isBreached ? `Melewati Target SLA` : `Sisa Waktu: ${sla.remainingMins} Menit`}
                        </span>
                      </div>
                    </div>

                    <div className="kpi-progress-bar" style={{ height: '8px', margin: 0, background: 'rgba(51, 65, 85, 0.6)', borderRadius: '4px' }}>
                      <div
                        className="kpi-progress-fill"
                        style={{
                          width: `${sla.progressPercent}%`,
                          background: sla.statusColor,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#94a3b8', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} className="text-cyan-400" />
                        <span>Masuk: <strong style={{ color: '#f1f5f9' }}>{sla.createdFormatted}</strong></span>
                      </div>
                      {sla.isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span>Selesai: <strong style={{ color: '#34d399' }}>{sla.resolvedFormatted}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2-Column Grid of Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {/* Column Left: Requester & Problem Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Card 1: Data Pemohon */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <User size={16} className="text-sky-400" />
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Identitas Pemohon / Civitas
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#94a3b8' }}>Nama Lengkap</span>
                      <span style={{ color: '#ffffff', fontWeight: 700 }}>{detailTicket.full_name}</span>

                      <span style={{ color: '#94a3b8' }}>NIM / NIP / ID</span>
                      <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{detailTicket.id_number || '-'}</span>

                      <span style={{ color: '#94a3b8' }}>Kategori Civitas</span>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>{detailTicket.category || 'Mahasiswa'}</span>

                      <span style={{ color: '#94a3b8' }}>Lokasi / Gedung</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e2e8f0', fontWeight: 600 }}>
                        <MapPin size={13} className="text-rose-400" />
                        <span>{detailTicket.unit_specification || '-'}</span>
                      </div>

                      <span style={{ color: '#94a3b8' }}>WhatsApp</span>
                      <div>
                        {detailTicket.whatsapp_number ? (
                          <a
                            href={`https://wa.me/${detailTicket.whatsapp_number.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#34d399',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 700
                            }}
                          >
                            <Phone size={12} />
                            <span>{detailTicket.whatsapp_number}</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ color: '#64748b' }}>-</span>
                        )}
                      </div>

                      <span style={{ color: '#94a3b8' }}>Email</span>
                      <div>
                        {detailTicket.email ? (
                          <a
                            href={`mailto:${detailTicket.email}`}
                            style={{
                              color: '#38bdf8',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Mail size={12} />
                            <span>{detailTicket.email}</span>
                          </a>
                        ) : (
                          <span style={{ color: '#64748b' }}>-</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Layanan & Deskripsi Masalah */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <FileText size={16} className="text-amber-400" />
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Detail Kendala &amp; Permintaan
                      </h4>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                        Kategori Layanan
                      </span>
                      <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
                        {detailTicket.service_type}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                        Uraian Masalah / Kebutuhan
                      </span>
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '10px 12px',
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid rgba(51, 65, 85, 0.8)',
                          borderRadius: '8px',
                          fontSize: '0.84rem',
                          color: '#e2e8f0',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '160px',
                          overflowY: 'auto'
                        }}
                      >
                        {detailTicket.description || 'Tidak ada uraian masalah.'}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Penanganan Teknis */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <UserCheck size={16} className="text-emerald-400" />
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Penanganan &amp; Teknisi NOC
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#94a3b8' }}>Teknisi PIC</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{detailTicket.assigned_user_name || 'Belum ditugaskan'}</span>

                      <span style={{ color: '#94a3b8' }}>Catatan Tindakan</span>
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          border: '1px solid rgba(51, 65, 85, 0.6)',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {detailTicket.resolution_notes || 'Belum ada catatan penyelesaian teknis.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column Right: Photos, CSAT, & BAST */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Card 4: Dokumentasi Foto Bukti Lapangan */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Camera size={16} className="text-emerald-400" />
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dokumentasi Foto Lapangan
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTicket(detailTicket);
                          setProofForm({
                            proof_before_url: detailTicket.proof_before_url || detailTicket.image_url || '',
                            proof_after_url: detailTicket.proof_after_url || ''
                          });
                          setShowProofModal(true);
                        }}
                        className="sla-action-btn"
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                      >
                        Kelola Foto
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {/* Photo Before */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24' }}>
                          1. Kondisi Awal (Before)
                        </span>
                        <div
                          style={{
                            height: '160px',
                            background: '#0f172a',
                            borderRadius: '8px',
                            border: '1px solid rgba(51,65,85,0.7)',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: (detailTicket.proof_before_url || detailTicket.image_url) ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => {
                            const url = detailTicket.proof_before_url || detailTicket.image_url;
                            if (url) {
                              setLightboxImage({ url: getPhotoUrl(url), title: `Foto Kondisi Awal (Before) - ${detailTicket.ticket_number}` });
                            }
                          }}
                        >
                          {(detailTicket.proof_before_url || detailTicket.image_url) ? (
                            <>
                              <img
                                src={getPhotoUrl(detailTicket.proof_before_url || detailTicket.image_url)}
                                alt="Before"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e: any) => {
                                  e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image';
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '6px',
                                  right: '6px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Maximize2 size={10} />
                                <span>Perbesar</span>
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Tidak ada foto awal</span>
                          )}
                        </div>
                      </div>

                      {/* Photo After */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399' }}>
                          2. Hasil Selesai (After)
                        </span>
                        <div
                          style={{
                            height: '160px',
                            background: '#0f172a',
                            borderRadius: '8px',
                            border: '1px solid rgba(51,65,85,0.7)',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: detailTicket.proof_after_url ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => {
                            if (detailTicket.proof_after_url) {
                              setLightboxImage({ url: getPhotoUrl(detailTicket.proof_after_url), title: `Foto Hasil Selesai (After) - ${detailTicket.ticket_number}` });
                            }
                          }}
                        >
                          {detailTicket.proof_after_url ? (
                            <>
                              <img
                                src={getPhotoUrl(detailTicket.proof_after_url)}
                                alt="After"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e: any) => {
                                  e.target.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Invalid+Image';
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '6px',
                                  right: '6px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Maximize2 size={10} />
                                <span>Perbesar</span>
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Belum ada foto selesai</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Rating Civitas (CSAT) */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={16} className="text-amber-400" />
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Rating Kepuasan (CSAT)
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTicket(detailTicket);
                          setCsatForm({ csat_rating: detailTicket.csat_rating || 5, csat_feedback: detailTicket.csat_feedback || '' });
                          setShowCsatModal(true);
                        }}
                        className="sla-action-btn"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fbbf24' }}
                      >
                        {detailTicket.csat_rating ? 'Ubah Rating' : '+ Beri Rating'}
                      </button>
                    </div>

                    {detailTicket.csat_rating ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={18}
                              className={star <= (detailTicket.csat_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                            />
                          ))}
                          <span style={{ fontWeight: 800, color: '#fbbf24', marginLeft: '6px', fontSize: '0.9rem' }}>
                            {detailTicket.csat_rating}.0 / 5.0
                          </span>
                        </div>
                        {detailTicket.csat_feedback && (
                          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                            "{detailTicket.csat_feedback}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Pemohon belum memberikan rating kepuasan CSAT.</span>
                    )}
                  </div>

                  {/* Card 6: Informasi BAST */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.7)',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={16} className="text-purple-400" />
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Berita Acara (BAST)
                        </h4>
                      </div>
                      {(detailTicket.status === 'Resolved' || detailTicket.status === 'Closed') && (
                        <button
                          onClick={() => {
                            setActiveTicket(detailTicket);
                            setBastSignerName(detailTicket.bast_signer_name || detailTicket.full_name || '');
                            if (!detailTicket.bast_number) handleGenerateBast(detailTicket);
                            setShowBastModal(true);
                          }}
                          className="sla-action-btn"
                          style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}
                        >
                          Cetak BAST
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#94a3b8' }}>Nomor BAST</span>
                      <span style={{ color: '#c084fc', fontWeight: 700, fontFamily: 'monospace' }}>
                        {detailTicket.bast_number || 'Belum Diterbitkan'}
                      </span>

                      <span style={{ color: '#94a3b8' }}>Penandatangan</span>
                      <span style={{ color: '#e2e8f0' }}>{detailTicket.bast_signer_name || detailTicket.full_name || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Modal Footer Actions */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid rgba(51, 65, 85, 0.8)',
                background: 'rgba(15, 23, 42, 0.8)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleDeleteTicket(detailTicket.id, detailTicket.ticket_number)}
                className="sla-btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#f87171',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={15} />
                <span>Hapus Tiket</span>
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {detailTicket.status === 'Open' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTicket(detailTicket);
                      setSelectedTechId(detailTicket.assigned_user_id ? String(detailTicket.assigned_user_id) : '');
                      setShowAssignModal(true);
                    }}
                    className="sla-btn"
                    style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700 }}
                  >
                    Tugaskan Teknisi
                  </button>
                )}

                {detailTicket.status === 'In Progress' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTicket(detailTicket);
                      setResolutionStatus('Resolved');
                      setShowResolveModal(true);
                    }}
                    className="sla-btn sla-btn-excel"
                    style={{ fontWeight: 700 }}
                  >
                    <CheckCircle size={15} />
                    <span>Selesaikan Tiket</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="sla-btn"
                  style={{ background: 'rgba(30,41,59,0.9)', color: '#cbd5e1' }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* H. PHOTO LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="sla-modal-overlay"
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                color: '#ffffff'
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lightboxImage.title}</span>
              <button
                onClick={() => setLightboxImage(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
