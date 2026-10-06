import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  DoorOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Layers,
  Building,
  Info
} from 'lucide-react';
import { BACKEND_URL } from '../App';

export interface Gedung {
  id: number;
  kode: string;
  nama: string;
  keterangan: string | null;
  status: 'Aktif' | 'Nonaktif';
  jumlah_ruangan?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Ruangan {
  id: number;
  gedung_id: number;
  gedung_kode?: string;
  gedung_nama?: string;
  kode: string;
  nama: string;
  lantai: string;
  keterangan: string | null;
  status: 'Aktif' | 'Nonaktif';
  created_at?: string;
  updated_at?: string;
}

interface MasterGedungRuanganProps {
  token: string;
  currentUserRole?: string;
  onRefresh?: () => void;
}

export const MasterGedungRuangan: React.FC<MasterGedungRuanganProps> = ({
  token,
  currentUserRole,
  onRefresh
}) => {
  const isAdmin = currentUserRole === 'Administrator' || currentUserRole === 'Manager' || currentUserRole === 'Pengelola Master Data';

  // Navigation View Mode: 'gedung' (Building List) or 'ruangan' (Room List for specific building)
  const [viewMode, setViewMode] = useState<'gedung' | 'ruangan'>('gedung');
  const [selectedGedung, setSelectedGedung] = useState<Gedung | null>(null);

  // Data States
  const [gedungs, setGedungs] = useState<Gedung[]>([]);
  const [ruangans, setRuangans] = useState<Ruangan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');

  // Modal States
  const [showGedungModal, setShowGedungModal] = useState<boolean>(false);
  const [editingGedung, setEditingGedung] = useState<Gedung | null>(null);
  const [gedungForm, setGedungForm] = useState({
    kode: '',
    nama: '',
    keterangan: '',
    status: 'Aktif' as 'Aktif' | 'Nonaktif'
  });
  const [gedungFormError, setGedungFormError] = useState<string>('');

  const [showRuanganModal, setShowRuanganModal] = useState<boolean>(false);
  const [editingRuangan, setEditingRuangan] = useState<Ruangan | null>(null);
  const [ruanganForm, setRuanganForm] = useState({
    kode: '',
    nama: '',
    lantai: '1',
    keterangan: '',
    status: 'Aktif' as 'Aktif' | 'Nonaktif'
  });
  const [ruanganFormError, setRuanganFormError] = useState<string>('');

  // Delete Confirmation Modal States
  const [deleteGedungTarget, setDeleteGedungTarget] = useState<Gedung | null>(null);
  const [deleteRuanganTarget, setDeleteRuanganTarget] = useState<Ruangan | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Toast Auto-clear
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Fetch Gedungs List
  const fetchGedungs = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/gedungs?status=all`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGedungs(Array.isArray(data) ? data : []);
      } else {
        setErrorMsg('Gagal mengambil data gedung dari server');
      }
    } catch (err) {
      console.error('Error fetching gedungs:', err);
      setErrorMsg('Koneksi terputus saat mengambil data gedung');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch Ruangans List (for currently selected building or all)
  const fetchRuangans = useCallback(async (gedungId?: number) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = gedungId
        ? `${BACKEND_URL}/api/ruangans?gedung_id=${gedungId}&status=all`
        : `${BACKEND_URL}/api/ruangans?status=all`;

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setRuangans(Array.isArray(data) ? data : []);
      } else {
        setErrorMsg('Gagal mengambil data ruangan dari server');
      }
    } catch (err) {
      console.error('Error fetching ruangans:', err);
      setErrorMsg('Koneksi terputus saat mengambil data ruangan');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (viewMode === 'gedung') {
      fetchGedungs();
    } else if (viewMode === 'ruangan' && selectedGedung) {
      fetchRuangans(selectedGedung.id);
    }
  }, [viewMode, selectedGedung, fetchGedungs, fetchRuangans]);

  // Switch to Room List View for a Building
  const handleOpenRuanganList = (gedung: Gedung) => {
    setSelectedGedung(gedung);
    setViewMode('ruangan');
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Switch Back to Building List View
  const handleBackToGedungs = () => {
    setViewMode('gedung');
    setSelectedGedung(null);
    setSearchQuery('');
    setStatusFilter('all');
    fetchGedungs();
  };

  // Filtered Gedung List
  const filteredGedungs = useMemo(() => {
    return gedungs.filter(g => {
      const matchSearch = g.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.keterangan || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || g.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [gedungs, searchQuery, statusFilter]);

  // Filtered Ruangan List
  const filteredRuangans = useMemo(() => {
    return ruangans.filter(r => {
      const matchSearch = r.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.lantai.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.keterangan || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [ruangans, searchQuery, statusFilter]);

  // =========================================================================
  // GEDUNG HANDLERS
  // =========================================================================
  const handleOpenAddGedungModal = () => {
    setEditingGedung(null);
    setGedungForm({ kode: '', nama: '', keterangan: '', status: 'Aktif' });
    setGedungFormError('');
    setShowGedungModal(true);
  };

  const handleOpenEditGedungModal = (gedung: Gedung) => {
    setEditingGedung(gedung);
    setGedungForm({
      kode: gedung.kode,
      nama: gedung.nama,
      keterangan: gedung.keterangan || '',
      status: gedung.status
    });
    setGedungFormError('');
    setShowGedungModal(true);
  };

  const handleSaveGedung = async (e: React.FormEvent) => {
    e.preventDefault();
    setGedungFormError('');

    if (!gedungForm.kode.trim()) {
      setGedungFormError('Kode gedung wajib diisi.');
      return;
    }
    if (!gedungForm.nama.trim()) {
      setGedungFormError('Nama gedung wajib diisi.');
      return;
    }

    setActionLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const method = editingGedung ? 'PUT' : 'POST';
      const url = editingGedung
        ? `${BACKEND_URL}/api/gedungs/${editingGedung.id}`
        : `${BACKEND_URL}/api/gedungs`;

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(gedungForm)
      });

      const data = await res.json();
      if (!res.ok) {
        setGedungFormError(data.error || 'Gagal menyimpan data gedung');
      } else {
        setShowGedungModal(false);
        setSuccessMsg(editingGedung ? 'Gedung berhasil diperbarui' : 'Gedung berhasil ditambahkan');
        fetchGedungs();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error saving gedung:', err);
      setGedungFormError('Terjadi kesalahan jaringan saat menyimpan gedung');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGedungConfirm = async () => {
    if (!deleteGedungTarget) return;

    setActionLoading(true);
    setErrorMsg('');
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/gedungs/${deleteGedungTarget.id}`, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        // Displays error message: "Gedung ini masih memiliki beberapa ruangan..."
        setErrorMsg(data.error || 'Gagal menghapus gedung');
      } else {
        setSuccessMsg(`Gedung ${deleteGedungTarget.nama} berhasil dihapus`);
        fetchGedungs();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error deleting gedung:', err);
      setErrorMsg('Gagal menghapus gedung due to network error');
    } finally {
      setActionLoading(false);
      setDeleteGedungTarget(null);
    }
  };

  // =========================================================================
  // RUANGAN HANDLERS
  // =========================================================================
  const handleOpenAddRuanganModal = () => {
    setEditingRuangan(null);
    setRuanganForm({ kode: '', nama: '', lantai: '1', keterangan: '', status: 'Aktif' });
    setRuanganFormError('');
    setShowRuanganModal(true);
  };

  const handleOpenEditRuanganModal = (ruangan: Ruangan) => {
    setEditingRuangan(ruangan);
    setRuanganForm({
      kode: ruangan.kode,
      nama: ruangan.nama,
      lantai: ruangan.lantai || '1',
      keterangan: ruangan.keterangan || '',
      status: ruangan.status
    });
    setRuanganFormError('');
    setShowRuanganModal(true);
  };

  const handleSaveRuangan = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuanganFormError('');

    if (!selectedGedung) {
      setRuanganFormError('Gedung terpilih tidak valid.');
      return;
    }
    if (!ruanganForm.kode.trim()) {
      setRuanganFormError('Kode ruangan wajib diisi.');
      return;
    }
    if (!ruanganForm.nama.trim()) {
      setRuanganFormError('Nama ruangan wajib diisi.');
      return;
    }

    setActionLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const method = editingRuangan ? 'PUT' : 'POST';
      const url = editingRuangan
        ? `${BACKEND_URL}/api/ruangans/${editingRuangan.id}`
        : `${BACKEND_URL}/api/ruangans`;

      const payload = {
        ...ruanganForm,
        gedung_id: selectedGedung.id
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setRuanganFormError(data.error || 'Gagal menyimpan data ruangan');
      } else {
        setShowRuanganModal(false);
        setSuccessMsg(editingRuangan ? 'Ruangan berhasil diperbarui' : 'Ruangan berhasil ditambahkan');
        fetchRuangans(selectedGedung.id);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error saving ruangan:', err);
      setRuanganFormError('Terjadi kesalahan jaringan saat menyimpan ruangan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRuanganConfirm = async () => {
    if (!deleteRuanganTarget || !selectedGedung) return;

    setActionLoading(true);
    setErrorMsg('');
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/ruangans/${deleteRuanganTarget.id}`, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menghapus ruangan');
      } else {
        setSuccessMsg(`Ruangan ${deleteRuanganTarget.nama} (${deleteRuanganTarget.kode}) berhasil dihapus`);
        fetchRuangans(selectedGedung.id);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error deleting ruangan:', err);
      setErrorMsg('Terjadi kesalahan saat menghapus ruangan');
    } finally {
      setActionLoading(false);
      setDeleteRuanganTarget(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main, #0b0f19)',
      color: 'var(--text-main, #f3f4f6)',
      padding: '24px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* =========================================================================
          TOP TOAST NOTIFICATIONS & MESSAGES
          ========================================================================= */}
      {successMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: '#059669',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '8px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: '#dc2626',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '8px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================================================
          HEADER BAR
          ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {viewMode === 'ruangan' && (
              <button
                onClick={handleBackToGedungs}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Kembali ke Daftar Gedung"
              >
                <ArrowLeft size={16} />
                Kembali
              </button>
            )}

            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={26} style={{ color: '#3b82f6' }} />
              {viewMode === 'gedung' ? (
                <>Master Data <span style={{ color: '#94a3b8' }}>/ Gedung</span></>
              ) : (
                <>
                  <span style={{ color: '#94a3b8', cursor: 'pointer' }} onClick={handleBackToGedungs}>Gedung /</span>
                  <span>{selectedGedung?.nama}</span>
                </>
              )}
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#94a3b8' }}>
            {viewMode === 'gedung'
              ? 'Kelola master data gedung & infrastruktur fisik lokasi kampus.'
              : `Kelola daftar ruangan pada ${selectedGedung?.nama} (${selectedGedung?.kode}).`}
          </p>
        </div>

        {isAdmin && (
          <div>
            {viewMode === 'gedung' ? (
              <button
                onClick={handleOpenAddGedungModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Plus size={18} />
                Tambah Gedung
              </button>
            ) : (
              <button
                onClick={handleOpenAddRuanganModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Plus size={18} />
                Tambah Ruangan
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          FILTER BAR & SEARCH
          ========================================================================= */}
      <div style={{
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder={viewMode === 'gedung' ? 'Cari kode, nama, atau keterangan gedung...' : 'Cari kode, nama ruangan, atau lantai...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '9px 12px 9px 36px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Status:</span>
          {(['all', 'Aktif', 'Nonaktif'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid ' + (statusFilter === st ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'),
                backgroundColor: statusFilter === st ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                color: statusFilter === st ? '#60a5fa' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              {st === 'all' ? 'Semua' : st}
            </button>
          ))}

          <button
            onClick={() => viewMode === 'gedung' ? fetchGedungs() : fetchRuangans(selectedGedung?.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              cursor: 'pointer',
              marginLeft: '6px'
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE 1: MASTER GEDUNG TABLE
          ========================================================================= */}
      {viewMode === 'gedung' && (
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: '#94a3b8',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  textTransform: 'uppercase',
                  fontSize: '11.5px',
                  letterSpacing: '0.5px'
                }}>
                  <th style={{ padding: '14px 16px', width: '50px', textAlign: 'center' }}>No</th>
                  <th style={{ padding: '14px 16px' }}>Kode Gedung</th>
                  <th style={{ padding: '14px 16px' }}>Nama Gedung</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Jumlah Ruangan</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#3b82f6' }} />
                      Memuat data gedung...
                    </td>
                  </tr>
                ) : filteredGedungs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <Building size={32} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.4 }} />
                      Belum ada data gedung yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredGedungs.map((g, idx) => (
                    <tr
                      key={g.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                        <span style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '12.5px',
                          border: '1px solid rgba(59, 130, 246, 0.25)'
                        }}>
                          {g.kode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{g.nama}</div>
                        {g.keterangan && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{g.keterangan}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <DoorOpen size={14} style={{ color: '#0284c7' }} />
                          <span>{g.jumlah_ruangan || 0} Ruangan</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: g.status === 'Aktif' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: g.status === 'Aktif' ? '#34d399' : '#f87171',
                          border: `1px solid ${g.status === 'Aktif' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {g.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                          {/* Tombol Kelola Ruangan */}
                          <button
                            onClick={() => handleOpenRuanganList(g)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: 'rgba(37, 99, 235, 0.15)',
                              color: '#3b82f6',
                              border: '1px solid rgba(37, 99, 235, 0.3)',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Kelola Daftar Ruangan"
                          >
                            <DoorOpen size={13} />
                            Kelola Ruangan
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditGedungModal(g)}
                                style={{
                                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                  color: '#eab308',
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                                title="Edit Gedung"
                              >
                                <Edit size={13} />
                              </button>

                              <button
                                onClick={() => setDeleteGedungTarget(g)}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                                title="Hapus Gedung"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: DAFTAR RUANGAN TIAP GEDUNG
          ========================================================================= */}
      {viewMode === 'ruangan' && selectedGedung && (
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}>
          {/* Info Banner Gedung Terpilih */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} style={{ color: '#38bdf8' }} />
                <span>{selectedGedung.nama}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>({selectedGedung.kode})</span>
              </div>
              {selectedGedung.keterangan && (
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>{selectedGedung.keterangan}</div>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
              Total: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{filteredRuangans.length}</span> Ruangan
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#94a3b8',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  textTransform: 'uppercase',
                  fontSize: '11.5px',
                  letterSpacing: '0.5px'
                }}>
                  <th style={{ padding: '14px 16px', width: '50px', textAlign: 'center' }}>No</th>
                  <th style={{ padding: '14px 16px' }}>Kode Ruangan</th>
                  <th style={{ padding: '14px 16px' }}>Nama Ruangan</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Lantai</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#10b981' }} />
                      Memuat daftar ruangan...
                    </td>
                  </tr>
                ) : filteredRuangans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <DoorOpen size={32} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.4 }} />
                      Belum ada ruangan pada gedung ini. Klik <strong>+ Tambah Ruangan</strong> untuk membuat data baru.
                    </td>
                  </tr>
                ) : (
                  filteredRuangans.map((r, idx) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '12.5px',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                          {r.kode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{r.nama}</div>
                        {r.keterangan && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{r.keterangan}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#cbd5e1' }}>
                        Lantai {r.lantai}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: r.status === 'Aktif' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: r.status === 'Aktif' ? '#34d399' : '#f87171',
                          border: `1px solid ${r.status === 'Aktif' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => handleOpenEditRuanganModal(r)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                  color: '#eab308',
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Edit Ruangan"
                              >
                                <Edit size={13} /> Edit
                              </button>

                              <button
                                onClick={() => setDeleteRuanganTarget(r)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Hapus Ruangan"
                              >
                                <Trash2 size={13} /> Hapus
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#64748b' }}>Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL FORM TAMBAH / EDIT GEDUNG
          ========================================================================= */}
      {showGedungModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} style={{ color: '#3b82f6' }} />
                {editingGedung ? 'Edit Data Gedung' : 'Tambah Gedung Baru'}
              </h3>
              <button
                onClick={() => setShowGedungModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveGedung} style={{ padding: '24px' }}>
              {gedungFormError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>{gedungFormError}</span>
                </div>
              )}

              {/* Kode Gedung */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Kode Gedung <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: GDG-A"
                  value={gedungForm.kode}
                  onChange={(e) => setGedungForm({ ...gedungForm, kode: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Nama Gedung */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Nama Gedung <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung A (Rektorat & BAAK)"
                  value={gedungForm.nama}
                  onChange={(e) => setGedungForm({ ...gedungForm, nama: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Keterangan
                </label>
                <textarea
                  placeholder="Deskripsi atau catatan gedung..."
                  rows={3}
                  value={gedungForm.keterangan}
                  onChange={(e) => setGedungForm({ ...gedungForm, keterangan: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Status */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={gedungForm.status}
                  onChange={(e) => setGedungForm({ ...gedungForm, status: e.target.value as 'Aktif' | 'Nonaktif' })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                >
                  <option value="Aktif" style={{ background: '#1e293b' }}>Aktif</option>
                  <option value="Nonaktif" style={{ background: '#1e293b' }}>Nonaktif</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowGedungModal(false)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: actionLoading ? 0.7 : 1
                  }}
                >
                  {actionLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL FORM TAMBAH / EDIT RUANGAN
          ========================================================================= */}
      {showRuanganModal && selectedGedung && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DoorOpen size={20} style={{ color: '#10b981' }} />
                {editingRuangan ? 'Edit Data Ruangan' : 'Tambah Ruangan Baru'}
              </h3>
              <button
                onClick={() => setShowRuanganModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRuangan} style={{ padding: '24px' }}>
              {ruanganFormError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} />
                  <span>{ruanganFormError}</span>
                </div>
              )}

              {/* Gedung (Automated Readonly Display) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Gedung
                </label>
                <input
                  type="text"
                  value={`${selectedGedung.nama} (${selectedGedung.kode})`}
                  disabled
                  readOnly
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#38bdf8',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Kode Ruangan */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Kode Ruangan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: A-101"
                  value={ruanganForm.kode}
                  onChange={(e) => setRuanganForm({ ...ruanganForm, kode: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Nama Ruangan */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Nama Ruangan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ruang Rektorat"
                  value={ruanganForm.nama}
                  onChange={(e) => setRuanganForm({ ...ruanganForm, nama: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Lantai */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Lantai
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 1, 2, atau Dasar"
                  value={ruanganForm.lantai}
                  onChange={(e) => setRuanganForm({ ...ruanganForm, lantai: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Keterangan
                </label>
                <textarea
                  placeholder="Catatan atau spesifikasi lokasi..."
                  rows={2}
                  value={ruanganForm.keterangan}
                  onChange={(e) => setRuanganForm({ ...ruanganForm, keterangan: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Status */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={ruanganForm.status}
                  onChange={(e) => setRuanganForm({ ...ruanganForm, status: e.target.value as 'Aktif' | 'Nonaktif' })}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                >
                  <option value="Aktif" style={{ background: '#1e293b' }}>Aktif</option>
                  <option value="Nonaktif" style={{ background: '#1e293b' }}>Nonaktif</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowRuanganModal(false)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: actionLoading ? 0.7 : 1
                  }}
                >
                  {actionLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL - GEDUNG
          ========================================================================= */}
      {deleteGedungTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                backgroundColor: (deleteGedungTarget.jumlah_ruangan || 0) > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: (deleteGedungTarget.jumlah_ruangan || 0) > 0 ? '#eab308' : '#ef4444',
                padding: '10px',
                borderRadius: '10px'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  {(deleteGedungTarget.jumlah_ruangan || 0) > 0 ? 'Tidak Dapat Menghapus Gedung' : 'Konfirmasi Hapus Gedung'}
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {(deleteGedungTarget.jumlah_ruangan || 0) > 0 ? (
                    <span>
                      Gedung <strong>{deleteGedungTarget.nama} ({deleteGedungTarget.kode})</strong> masih memiliki <strong>{deleteGedungTarget.jumlah_ruangan} ruangan</strong>. Hapus semua ruangan terlebih dahulu atau nonaktifkan gedung.
                    </span>
                  ) : (
                    <span>
                      Apakah Anda yakin ingin menghapus gedung <strong>{deleteGedungTarget.nama} ({deleteGedungTarget.kode})</strong>? Data yang dihapus tidak dapat dikembalikan.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => setDeleteGedungTarget(null)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {(deleteGedungTarget.jumlah_ruangan || 0) > 0 ? 'Mengerti' : 'Batal'}
              </button>

              {(deleteGedungTarget.jumlah_ruangan || 0) === 0 && (
                <button
                  onClick={handleDeleteGedungConfirm}
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: actionLoading ? 0.7 : 1
                  }}
                >
                  {actionLoading ? 'Menghapus...' : 'Ya, Hapus Gedung'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL - RUANGAN
          ========================================================================= */}
      {deleteRuanganTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '10px',
                borderRadius: '10px'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  Konfirmasi Hapus Ruangan
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  Apakah Anda yakin ingin menghapus ruangan <strong>{deleteRuanganTarget.nama} ({deleteRuanganTarget.kode})</strong> pada <strong>{selectedGedung?.nama}</strong>?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => setDeleteRuanganTarget(null)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>

              <button
                onClick={handleDeleteRuanganConfirm}
                disabled={actionLoading}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus Ruangan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
