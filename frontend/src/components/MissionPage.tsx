import React, { useState } from 'react';
import QRCode from 'qrcode';
import type { CustomMission, User, MissionChecklistItem } from '../types';
import { 
  Search, X, RefreshCw, Plus, CheckSquare, Square, UserPlus, LogOut, 
  FileText, Printer, Clock, Users, 
  Edit, Trash2, Layers, CheckCircle2, ShieldCheck, QrCode as QrIcon
} from 'lucide-react';
import { BACKEND_URL } from '../App';

interface MissionPageProps {
  customMissions: CustomMission[];
  users: User[];
  token: string;
  onRefresh: () => void;
  isAdmin: boolean;
  currentUser?: User | null;
}

export const MissionPage: React.FC<MissionPageProps> = ({
  customMissions,
  users,
  token,
  onRefresh,
  isAdmin,
  currentUser
}) => {
  // View Toggle: Grid vs Table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Create / Edit Admin Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missionId, setMissionId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [createdBy, setCreatedBy] = useState('');
  const [dateFinished, setDateFinished] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [note, setNote] = useState('');
  const [missionImage, setMissionImage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [status, setStatus] = useState('Active');
  const [checklists, setChecklists] = useState<MissionChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // BAST Custom Header Config
  const [customLogo, setCustomLogo] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');

  // Progress Update Modal State (For Technician)
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [activeMission, setActiveMission] = useState<CustomMission | null>(null);
  const [tempChecklists, setTempChecklists] = useState<MissionChecklistItem[]>([]);
  const [tempProgress, setTempProgress] = useState(0);
  const [tempNote, setTempNote] = useState('');
  const [tempImage, setTempImage] = useState('');

  // BAST Document Modal State
  const [isBastModalOpen, setIsBastModalOpen] = useState(false);
  const [bastMission, setBastMission] = useState<CustomMission | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [bastNotes, setBastNotes] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [techSignatureDataUrl, setTechSignatureDataUrl] = useState('');

  // BAST Digital Verification Modal State
  const [bastQrImageSrc, setBastQrImageSrc] = useState<string>('');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyData, setVerifyData] = useState<any>(null);
  const [isVerifyingLoading, setIsVerifyingLoading] = useState(false);

  // Filters State
  const [searchTitle, setSearchTitle] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [msg, setMsg] = useState('');
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);

  // Reset Admin Form
  const resetForm = () => {
    setMissionId(null);
    setTitle('');
    setDescription('');
    setSlots(1);
    setSelectedUserIds([]);
    setCreatedBy(currentUser?.name || '');
    setDateFinished('');
    setDurationStr('');
    setNote('');
    setMissionImage('');
    setProgressPercent(0);
    setStatus('Active');
    setChecklists([
      { id: '1', text: 'Survey titik lokasi & kebutuhan jalur', completed: false },
      { id: '2', text: 'Pelaksanaan pekerjaan fisik / instalasi', completed: false },
      { id: '3', text: 'Pengujian konektivitas & verifikasi hasil', completed: false }
    ]);
    setCustomLogo('');
    setCustomTitle('PERKUMPULAN GEMA PENDIDIKAN NASIONAL');
    setCustomSubtitle('TEKNOLOGI INFORMASI (TI)');
  };

  // Add Item to Admin Form Checklist
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    const newItem: MissionChecklistItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      completed: false
    };
    setChecklists([...checklists, newItem]);
    setNewChecklistText('');
  };

  // Remove Item from Admin Form Checklist
  const handleRemoveChecklistItem = (id: string) => {
    setChecklists(checklists.filter(c => c.id !== id));
  };

  // Handle Create/Edit Mission (Admin)
  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');

    if (title.length > 80) {
      alert('Judul maksimal 80 karakter.');
      return;
    }

    const url = missionId 
      ? `${BACKEND_URL}/api/custom-missions/${missionId}` 
      : `${BACKEND_URL}/api/custom-missions`;
    
    const method = missionId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          slots,
          user_ids: selectedUserIds,
          progress_percent: progressPercent,
          status,
          created_by: createdBy || currentUser?.name || 'Admin',
          date_finished: dateFinished,
          duration_str: durationStr,
          note,
          mission_image: missionImage,
          checklists,
          custom_header_logo: customLogo,
          custom_header_title: customTitle,
          custom_header_subtitle: customSubtitle
        })
      });

      if (response.ok) {
        setMsg(missionId ? 'Misi berhasil diperbarui.' : 'Misi berhasil dibuat dan disiarkan!');
        resetForm();
        setIsModalOpen(false);
        onRefresh();
      } else {
        const err = await response.json();
        setMsg(`Error: ${err.error}`);
      }
    } catch (error) {
      setMsg('Gagal menghubungi server.');
    }
  };

  // Handle Edit Mission Click
  const handleEditMission = (m: CustomMission) => {
    setMissionId(m.id);
    setTitle(m.title);
    setDescription(m.description || '');
    setSlots(m.slots);
    setSelectedUserIds(m.personnels.map(p => p.id));
    setCreatedBy(m.created_by || '');
    setDateFinished(m.date_finished || '');
    setDurationStr(m.duration_str || '');
    setNote(m.note || '');
    setMissionImage(m.mission_image || '');
    setProgressPercent(m.progress_percent || 0);
    setStatus(m.status || 'Active');
    setChecklists(m.checklists && m.checklists.length > 0 ? m.checklists : [
      { id: '1', text: 'Survey lokasi', completed: false },
      { id: '2', text: 'Pelaksanaan fisik', completed: false }
    ]);
    setCustomLogo(m.custom_header_logo || '');
    setCustomTitle(m.custom_header_title || 'PERKUMPULAN GEMA PENDIDIKAN NASIONAL');
    setCustomSubtitle(m.custom_header_subtitle || 'TEKNOLOGI INFORMASI (TI)');
    setIsModalOpen(true);
  };

  // Delete Mission
  const handleDeleteMission = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus misi ini?')) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/custom-missions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete mission:', error);
    }
  };

  // Join Mission (Self-Service)
  const handleJoinMission = async (m: CustomMission) => {
    if (!currentUser) {
      alert('Silakan login terlebih dahulu.');
      return;
    }
    setLoadingActionId(m.id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${m.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Berhasil bergabung ke misi "${m.title}"!`);
        onRefresh();
      } else {
        alert(data.error || 'Gagal bergabung.');
      }
    } catch (err) {
      alert('Error menghubungi server.');
    } finally {
      setLoadingActionId(null);
    }
  };

  // Leave Mission
  const handleLeaveMission = async (m: CustomMission) => {
    if (!currentUser) return;
    if (!confirm(`Keluar dari slot misi "${m.title}"?`)) return;
    setLoadingActionId(m.id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${m.id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      if (res.ok) {
        setMsg(`Telah keluar dari misi "${m.title}".`);
        onRefresh();
      }
    } catch (err) {
      alert('Gagal keluar dari misi.');
    } finally {
      setLoadingActionId(null);
    }
  };

  // Open Progress Modal for Technician
  const handleOpenProgressModal = (m: CustomMission) => {
    setActiveMission(m);
    setTempChecklists(m.checklists && m.checklists.length > 0 ? [...m.checklists] : [
      { id: '1', text: 'Pengerjaan Utama', completed: false }
    ]);
    setTempProgress(m.progress_percent || 0);
    setTempNote(m.note || '');
    setTempImage(m.mission_image || '');
    setIsProgressModalOpen(true);
  };

  // Toggle Checklist Item in Progress Modal
  const handleToggleTempChecklist = (id: string) => {
    const updated = tempChecklists.map(c => {
      if (c.id === id) {
        return { ...c, completed: !c.completed, completed_by: currentUser?.name };
      }
      return c;
    });
    setTempChecklists(updated);

    // Auto recalculate progress %
    if (updated.length > 0) {
      const doneCount = updated.filter(c => c.completed).length;
      const pct = Math.round((doneCount / updated.length) * 100);
      setTempProgress(pct);
    }
  };

  // Save Progress Update (Technician)
  const handleSaveProgress = async () => {
    if (!activeMission) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${activeMission.id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progress_percent: tempProgress,
          checklists: tempChecklists,
          note: tempNote,
          mission_image: tempImage,
          status: tempProgress === 100 ? 'Completed' : 'In Progress'
        })
      });
      if (res.ok) {
        setMsg('Progress misi berhasil diperbarui!');
        setIsProgressModalOpen(false);
        onRefresh();

        // If progress reached 100%, prompt BAST modal
        if (tempProgress === 100) {
          setTimeout(() => handleOpenBastModal(activeMission), 400);
        }
      }
    } catch (err) {
      alert('Gagal memperbarui progress.');
    }
  };

  // Open BAST Modal & Generate QR Code
  const handleOpenBastModal = (m: CustomMission) => {
    setBastMission(m);
    setSignerName(m.bast_signer_name || (currentUser && !isAdmin ? currentUser.name : ''));
    setSignerRole(m.bast_signer_role || (!isAdmin ? 'Teknisi Lapangan / Penerima' : 'Penanggung Jawab Lokasi'));
    setBastNotes(m.bast_notes || '');
    setSignatureDataUrl(m.bast_signature_url || '');
    setTechSignatureDataUrl(m.bast_tech_signature_url || '');

    // Generate Verification QR Code
    const verifyUrl = `${BACKEND_URL}/api/custom-missions/${m.id}/bast-verify`;
    QRCode.toDataURL(verifyUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    }).then(url => {
      setBastQrImageSrc(url);
    }).catch(err => {
      console.error('Failed to generate BAST QR code:', err);
    });

    setIsBastModalOpen(true);
  };

  // Digital Approval Handler (Administrator / Manager BTI or Lead Technician)
  const handleDigitalApproval = async (roleType: 'admin' | 'tech') => {
    if (!bastMission || !currentUser) return;
    const now = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' pukul', ' -');
    const hash = `SHA256-NEMESYS-${bastMission.id}-${Date.now().toString(36).toUpperCase()}`;

    const updateBody: any = {
      status: 'Completed',
      progress_percent: 100,
      bast_notes: bastNotes,
      bast_signer_name: signerName,
      bast_signer_role: signerRole,
      bast_signature_url: signatureDataUrl,
      bast_tech_signature_url: techSignatureDataUrl,
      bast_hash: hash
    };

    if (roleType === 'admin') {
      updateBody.bast_admin_approved_by = currentUser.name;
      updateBody.bast_admin_approved_at = now;
    } else {
      updateBody.bast_tech_approved_by = currentUser.name;
      updateBody.bast_tech_approved_at = now;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${bastMission.id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateBody)
      });
      if (res.ok) {
        setMsg(`Pengesahan Digital BAST oleh ${roleType === 'admin' ? 'Manager/Admin' : 'Teknisi'} berhasil disahkan!`);
        onRefresh();
        setIsBastModalOpen(false);
      } else {
        alert('Gagal menyimpan pengesahan digital BAST.');
      }
    } catch (err) {
      alert('Error menghubungi server.');
    }
  };

  // Handle Verify BAST QR Code Click
  const handleVerifyBast = async (id: number) => {
    setIsVerifyingLoading(true);
    setIsVerifyModalOpen(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${id}/bast-verify`);
      const data = await res.json();
      if (res.ok) {
        setVerifyData(data);
      } else {
        alert(data.error || 'Gagal memverifikasi dokumen BAST.');
      }
    } catch (err) {
      alert('Gagal memverifikasi dokumen BAST.');
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  // Save BAST Document
  const handleSaveBast = async () => {
    if (!bastMission) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-missions/${bastMission.id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Completed',
          progress_percent: 100,
          bast_signer_name: signerName,
          bast_signer_role: signerRole,
          bast_signature_url: signatureDataUrl,
          bast_tech_signature_url: techSignatureDataUrl,
          bast_notes: bastNotes
        })
      });
      if (res.ok) {
        setMsg('Dokumen BAST & Laporan Pekerjaan berhasil diterbitkan!');
        onRefresh();
      }
    } catch (err) {
      alert('Gagal menyimpan BAST.');
    }
  };

  // Trigger Print Document BAST
  const handlePrintBast = () => {
    window.print();
  };

  // Technicians List from users prop
  const technicians = users.filter(u => u.role === 'Teknisi');

  const handleToggleUserSelect = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  // Filter Logic
  const filteredMissions = customMissions.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(searchTitle.toLowerCase()) || 
                        (m.description && m.description.toLowerCase().includes(searchTitle.toLowerCase()));
    const matchStatus = statusFilter === 'All' ? true : m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate Metrics
  const totalMissions = customMissions.length;
  const activeCount = customMissions.filter(m => m.status === 'Active' || m.status === 'In Progress').length;
  const completedCount = customMissions.filter(m => m.status === 'Completed').length;
  const totalOpenSlots = customMissions.reduce((acc, m) => acc + Math.max(0, m.slots - m.personnels.length), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Banner Notifikasi Telegram */}
      <div style={{
        backgroundColor: 'rgba(251, 191, 36, 0.08)',
        border: '1px solid rgba(251, 191, 36, 0.25)',
        color: '#fbbf24',
        padding: '12px 18px',
        borderRadius: '10px',
        fontSize: '13.5px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span>Setiap Misi baru & penyelesaian BAST disiarkan otomatis ke Telegram Bot <strong>@zabbix_unej_bot</strong></span>
        </div>
      </div>

      {msg && (
        <div style={{
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          fontSize: '13.5px',
          textAlign: 'center',
          fontWeight: 600
        }}>
          {msg}
        </div>
      )}

      {/* Header Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL MISI</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{totalMissions}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>AKTIF / BERJALAN</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#facc15' }}>{activeCount}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>MISI SELESAI</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80' }}>{completedCount}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>SLOT TERSEDIA</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#60a5fa' }}>{totalOpenSlots} Slot</div>
          </div>
        </div>
      </div>

      {/* Main Bar Actions & Controls */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            {/* Search Box */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari Judul / Deskripsi Misi..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 12px 8px 36px',
                  color: '#fff',
                  fontSize: '13.5px',
                  width: '260px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13.5px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="All">Semua Status</option>
              <option value="Active">Active / Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  backgroundColor: viewMode === 'grid' ? '#6366f1' : 'transparent',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Grid Card
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  backgroundColor: viewMode === 'table' ? '#6366f1' : 'transparent',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Tabel
              </button>
            </div>

            <button
              onClick={onRefresh}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>

            {isAdmin && (
              <button
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                style={{
                  backgroundColor: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}
              >
                <Plus size={16} /> Buat Misi Baru +
              </button>
            )}
          </div>
        </div>

        {/* Content View: GRID or TABLE */}
        {filteredMissions.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Layers size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Tidak ada Misi ditemukan.</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Klik "Buat Misi Baru" di atas untuk menambahkan tugas tim khusus.
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px', marginTop: '8px' }}>
            {filteredMissions.map((m) => {
              const filledSlots = m.personnels.length;
              const slotsTotal = m.slots;
              const isFull = filledSlots >= slotsTotal;
              const hasJoined = currentUser ? m.personnels.some(p => p.id === currentUser.id) : false;
              const completedChecklists = m.checklists ? m.checklists.filter(c => c.completed).length : 0;
              const totalChecklists = m.checklists ? m.checklists.length : 0;

              return (
                <div
                  key={m.id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                    transition: 'transform 0.2s, border-color 0.2s'
                  }}
                >
                  <div>
                    {/* Status Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{
                        backgroundColor: m.status === 'Completed' ? 'rgba(34, 197, 94, 0.15)' : m.status === 'In Progress' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: m.status === 'Completed' ? '#4ade80' : m.status === 'In Progress' ? '#facc15' : '#818cf8',
                        border: `1px solid ${m.status === 'Completed' ? 'rgba(34, 197, 94, 0.3)' : m.status === 'In Progress' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {m.status}
                      </span>

                      <span style={{
                        backgroundColor: isFull ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: isFull ? '#f87171' : '#60a5fa',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px'
                      }}>
                        👥 Slot: {filledSlots}/{slotsTotal} {isFull ? '(Penuh)' : ''}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                      {m.title}
                    </h4>
                    {m.description && (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, height: '38px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {m.description}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Progress Pekerjaan</span>
                        <span style={{ color: '#4ade80', fontWeight: 700 }}>{m.progress_percent || 0}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${m.progress_percent || 0}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #22c55e)', borderRadius: '4px', transition: 'width 0.4s' }} />
                      </div>
                    </div>

                    {/* Checklist Sub-tasks summary */}
                    {totalChecklists > 0 && (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={14} style={{ color: '#818cf8' }} />
                        <span>Sub-task: <strong>{completedChecklists}/{totalChecklists}</strong> Selesai</span>
                      </div>
                    )}
                  </div>

                  {/* Personnels Footer & Actions */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Tim Pelaksana:</div>
                      <div style={{ display: 'flex', gap: '-6px' }}>
                        {m.personnels.map((p) => (
                          <div
                            key={p.id}
                            title={`${p.name} (${p.role})`}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              border: '2px solid #0f172a',
                              marginLeft: '-6px'
                            }}
                          >
                            {p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        ))}
                        {m.personnels.length === 0 && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {/* Self-Service Join/Leave for Technicians */}
                      {!isFull && !hasJoined && m.status !== 'Completed' && (
                        <button
                          onClick={() => handleJoinMission(m)}
                          disabled={loadingActionId === m.id}
                          style={{
                            flex: 1,
                            backgroundColor: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <UserPlus size={14} /> Join Slot
                        </button>
                      )}

                      {hasJoined && m.status !== 'Completed' && (
                        <button
                          onClick={() => handleLeaveMission(m)}
                          disabled={loadingActionId === m.id}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Keluar dari Slot Misi ini"
                        >
                          <LogOut size={14} />
                        </button>
                      )}

                      {/* Update Progress Button */}
                      {(hasJoined || isAdmin) && m.status !== 'Completed' && (
                        <button
                          onClick={() => handleOpenProgressModal(m)}
                          style={{
                            flex: 1,
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '6px',
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckSquare size={14} /> Update Progress
                        </button>
                      )}

                      {/* View BAST Document Button */}
                      <button
                        onClick={() => handleOpenBastModal(m)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <FileText size={14} /> {m.status === 'Completed' ? 'Dokumen BAST' : 'Detail'}
                      </button>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEditMission(m)}
                            style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Edit Misi"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMission(m.id)}
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Hapus Misi"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="table-container" style={{ marginTop: '8px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>NO</th>
                  <th>JUDUL MISI</th>
                  <th>PERSONEL</th>
                  <th>SLOT</th>
                  <th>PROGRESS</th>
                  <th>STATUS</th>
                  <th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredMissions.map((m, idx) => {
                  const filledSlots = m.personnels.length;
                  const slotsTotal = m.slots;
                  const hasJoined = currentUser ? m.personnels.some(p => p.id === currentUser.id) : false;
                  return (
                    <tr key={m.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{m.title}</span>
                        {m.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {m.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {m.personnels.map(p => (
                            <span key={p.id} style={{ fontSize: '12px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px' }}>
                              {p.name}
                            </span>
                          ))}
                          {m.personnels.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Belum ada</span>}
                        </div>
                      </td>
                      <td>{filledSlots} / {slotsTotal}</td>
                      <td>
                        <span style={{ color: '#4ade80', fontWeight: 700 }}>
                          {m.progress_percent}%
                        </span>
                      </td>
                      <td>
                        <span style={{
                          backgroundColor: m.status === 'Completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: m.status === 'Completed' ? '#4ade80' : '#facc15',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600
                        }}>
                          {m.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!hasJoined && filledSlots < slotsTotal && m.status !== 'Completed' && (
                            <button onClick={() => handleJoinMission(m)} style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>
                              Join
                            </button>
                          )}
                          <button onClick={() => handleOpenBastModal(m)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>
                            BAST / Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: CREATE / EDIT MISSION (ADMIN)                       */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.95)', color: '#fff',
            width: '100%', maxWidth: '680px', borderRadius: '12px', padding: '24px',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', position: 'relative'
          }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              {missionId ? 'Edit Misi Tim' : 'Buat Misi Tim Baru'}
            </h3>

            <form onSubmit={handleSaveMission} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Judul Misi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Judul Misi *</label>
                <input
                  type="text" required placeholder="misal: Pemasangan AP Wi-Fi Gedung F..."
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', color: '#fff', outline: 'none' }}
                />
              </div>

              {/* Deskripsi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Deskripsi & Rincian Tugas</label>
                <textarea
                  placeholder="Jelaskan detail proyek atau instruksi penanganan..."
                  value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Slots & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kapasitas Slot Teknisi</label>
                  <input
                    type="number" min={1} required value={slots} onChange={(e) => setSlots(parseInt(e.target.value) || 1)}
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status Misi</label>
                  <select
                    value={status} onChange={(e) => setStatus(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', color: '#fff', outline: 'none' }}
                  >
                    <option value="Active">Active / Open Slot</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Pre-assign Teknisi (Opsional) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pre-assign Teknisi Pelaksana (Opsional)</label>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', maxHeight: '120px', overflowY: 'auto', padding: '6px' }}>
                  {technicians.map(t => {
                    const isSelected = selectedUserIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleToggleUserSelect(t.id)}
                        style={{
                          padding: '6px 10px', borderRadius: '4px', cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                          color: isSelected ? '#818cf8' : '#fff', fontWeight: isSelected ? 600 : 400,
                          fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span>{t.name} (@{t.username})</span>
                        {isSelected && <span style={{ fontSize: '11px', color: '#4ade80' }}>✓ Terpilih</span>}
                      </div>
                    );
                  })}
                  {technicians.length === 0 && (
                    <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Tidak ada data teknisi
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Checklist Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={16} /> Sub-Task / Checklist Pekerjaan
                </label>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" placeholder="Tambah checklist item (misal: 1. Survey lokasi)..."
                    value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }}
                    style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', color: '#fff', outline: 'none' }}
                  />
                  <button type="button" onClick={handleAddChecklistItem} style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    + Tambah
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {checklists.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '6px 10px', borderRadius: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#cbd5e1' }}>• {item.text}</span>
                      <button type="button" onClick={() => handleRemoveChecklistItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customizable BAST Header Options */}
              <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#facc15' }}>⚙️ Custom Kop Surat BAST (Opsional)</label>
                <input
                  type="text" placeholder="URL Logo Kampus (e.g. https://domain.com/logo.png)..."
                  value={customLogo} onChange={(e) => setCustomLogo(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '12.5px', color: '#fff' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input
                    type="text" placeholder="Judul Institusi (default: UNIVERSITAS 17...)"
                    value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '12.5px', color: '#fff' }}
                  />
                  <input
                    type="text" placeholder="Sub-Judul Unit (default: BIRO TEKNOLOGI...)"
                    value={customSubtitle} onChange={(e) => setCustomSubtitle(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '12.5px', color: '#fff' }}
                  />
                </div>
              </div>

              {/* Submit / Close */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Simpan & Siarkan Misi
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  Tutup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: UPDATE PROGRESS & CHECKLIST (TECHNICIAN)            */}
      {/* ============================================================ */}
      {isProgressModalOpen && activeMission && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.95)', color: '#fff',
            width: '100%', maxWidth: '600px', borderRadius: '12px', padding: '24px',
            border: '1px solid var(--border-color)', position: 'relative', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <button onClick={() => setIsProgressModalOpen(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Update Progress Lapangan
            </h3>
            <div style={{ fontSize: '13px', color: '#818cf8', marginBottom: '16px', fontWeight: 600 }}>
              {activeMission.title}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Checklists Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Centang Sub-task yang telah rampung:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tempChecklists.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleToggleTempChecklist(c.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: c.completed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                        border: `1px solid ${c.completed ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {c.completed ? <CheckSquare size={18} style={{ color: '#4ade80' }} /> : <Square size={18} style={{ color: '#94a3b8' }} />}
                        <span style={{ fontSize: '13.5px', color: c.completed ? '#4ade80' : '#fff', fontWeight: c.completed ? 600 : 400, textDecoration: c.completed ? 'line-through' : 'none' }}>
                          {c.text}
                        </span>
                      </div>
                      {c.completed && c.completed_by && (
                        <span style={{ fontSize: '11px', color: '#818cf8' }}>✓ {c.completed_by}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Manual Progress Percent</label>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>{tempProgress}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={tempProgress} onChange={(e) => setTempProgress(parseInt(e.target.value))}
                  style={{ accentColor: '#22c55e', cursor: 'pointer' }}
                />
              </div>

              {/* Foto Bukti Pekerjaan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>URL / Link Foto Bukti Pekerjaan</label>
                <input
                  type="text" placeholder="https://example.com/foto-bukti.jpg..."
                  value={tempImage} onChange={(e) => setTempImage(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#fff', outline: 'none' }}
                />
              </div>

              {/* Catatan Lapangan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Catatan Lapangan</label>
                <textarea
                  placeholder="Tambahkan catatan pengerjaan..."
                  value={tempNote} onChange={(e) => setTempNote(e.target.value)} rows={2}
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#fff', outline: 'none' }}
                />
              </div>

              {/* Save & Finish Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button" onClick={handleSaveProgress}
                  style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Simpan Progress
                </button>
                {tempProgress === 100 && (
                  <button
                    type="button" onClick={() => { handleSaveProgress(); }}
                    style={{ flex: 1, backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <FileText size={16} /> Selesaikan & Terbitkan BAST
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: BAST & OFFICIAL MISSION REPORT (PRINTABLE LAYOUT)   */}
      {/* ============================================================ */}
      {isBastModalOpen && bastMission && (
        <div className="bast-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div className="bast-modal-card" style={{
            backgroundColor: '#ffffff', color: '#0f172a',
            width: '100%', maxWidth: '820px', borderRadius: '8px', padding: '32px',
            maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', position: 'relative'
          }}>
            {/* Close Button (Hidden on Print) */}
            <button
              className="no-print"
              onClick={() => setIsBastModalOpen(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}
            >
              &times;
            </button>

            {/* Print Header Actions (Hidden on Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#2563eb" />
                <span>Dokumen Berita Acara Serah Terima (BAST) & Laporan Pekerjaan</span>
              </div>
              <button
                onClick={handlePrintBast}
                style={{
                  backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Printer size={16} /> Cetak / Export PDF
              </button>
            </div>

            {/* PANEL CONTROL PENGESAHAN DIGITAL (LUAR DOKUMEN - Hidden on Print) */}
            <div className="no-print" style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} color="#16a34a" /> Panel Pengesahan & Approval BAST Digital (100% Paperless)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleVerifyBast(bastMission.id)}
                    style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', border: '1px solid #16a34a', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <QrIcon size={14} /> Portal Scan QR
                  </button>
                  <button
                    onClick={handleSaveBast}
                    style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <CheckCircle2 size={14} /> Simpan Pengesahan
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Data Penerima / Pihak II */}
                <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    👤 Data Penanggung Jawab / Penerima Pekerjaan (Pihak II)
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text" placeholder="Nama Penerima / User *"
                      value={signerName} onChange={(e) => setSignerName(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                    />
                    <input
                      type="text" placeholder="Jabatan"
                      value={signerRole} onChange={(e) => setSignerRole(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Tombol Approval Digital */}
                <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    🛡️ Pengesahan Digital Stempel System
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isAdmin && (
                      <button
                        onClick={() => handleDigitalApproval('admin')}
                        style={{ flex: 1, backgroundColor: '#1e40af', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      >
                        <ShieldCheck size={14} /> Sahkan (Manager BTI)
                      </button>
                    )}
                    <button
                      onClick={() => handleDigitalApproval('tech')}
                      style={{ flex: 1, backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <CheckCircle2 size={14} /> Sahkan (Teknisi)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PURE PRINTABLE AREA CONTENT */}
            <div id="bast-print-area">
              {/* KOP SURAT INSTITUSI */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '3px double #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
                <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img
                    src={bastMission.custom_header_logo || '/logo_perpenas.png'}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo_perpenas.png';
                    }}
                    alt="Logo Institusi Perpenas"
                    style={{ width: '75px', height: '75px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                    {bastMission.custom_header_title || 'UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI'}
                  </h3>
                  <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>
                    {bastMission.custom_header_subtitle || 'BIRO TEKNOLOGI INFORMASI (BTI)'}
                  </h4>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Jl. Lintas Selatan No. 1, Banyuwangi, Jawa Timur | Telp: (0333) 417618 | Email: bti@untag-banyuwangi.ac.id
                  </div>
                </div>
              </div>

              {/* DOKUMEN TITLE */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, textDecoration: 'underline', color: '#0f172a' }}>
                  BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)
                </h3>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', fontWeight: 600 }}>
                  Nomor: {bastMission.bast_number || `BAST-MIS/${new Date().getFullYear()}/${bastMission.id.toString().padStart(3, '0')}`}
                </div>
              </div>

              {/* DEKLARASI & RINCIAN MISI */}
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#334155', marginBottom: '16px' }}>
                Pada hari ini <strong>{bastMission.date_finished || bastMission.created_at}</strong>, telah diselesaikan pekerjaan tim IT Helpdesk dengan rincian sebagai berikut:
              </div>

              {/* TABLE METADATA */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#475569', width: '160px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Nama Misi / Pekerjaan</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{bastMission.title}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Deskripsi Pekerjaan</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{bastMission.description || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Tim Pelaksana (Teknisi)</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>
                      {bastMission.personnels.map(p => `${p.name} (${p.role})`).join(', ') || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Durasi Pelaksanaan</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#16a34a' }}>
                      {bastMission.duration_str || 'Selesai'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TABEL CHECKLIST SUB-TASK */}
              {bastMission.checklists && bastMission.checklists.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    Rincian Item Pekerjaan yang Diselesaikan:
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                        <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '40px' }}>NO</th>
                        <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'left' }}>ITEM PEKERJAAN</th>
                        <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '100px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bastMission.checklists.map((c, i) => (
                        <tr key={c.id}>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.text}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                            {c.completed ? '✓ SELESAI' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* LAMPIRAN FOTO & CATATAN */}
              {bastMission.mission_image && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    Lampiran Foto Bukti Pekerjaan:
                  </div>
                  <img
                    src={bastMission.mission_image} alt="Foto Bukti Pekerjaan"
                    style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {/* CATATAN BAST */}
              {bastMission.note && (
                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <strong>Catatan Tambahan:</strong> {bastMission.note}
                </div>
              )}

              {/* KOLOM PENGESAHAN DUA PIHAK (100% PURE DIGITAL STAMP - A4 PRINT VIEW) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px', textAlign: 'center' }}>
                {/* Pihak I: Admin / Manager */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>PIHAK PERTAMA (Penyerah / IT Team)</div>
                  <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px' }}>
                    {bastMission.bast_admin_approved_by ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #16a34a', padding: '6px 16px', borderRadius: '6px', backgroundColor: '#f0fdf4' }}>
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> [ PENGESAHAN DIGITAL SYSTEM ]
                        </span>
                        <span style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
                          {bastMission.bast_admin_approved_at}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #f59e0b', padding: '6px 16px', borderRadius: '6px', backgroundColor: '#fffbeb' }}>
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>⏳ Menunggu Pengesahan Admin</span>
                        <span style={{ fontSize: '9.5px', color: '#92400e', marginTop: '2px' }}>Belum disetujui</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                    {bastMission.bast_admin_approved_by || '— Menunggu —'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Biro Teknologi Informasi (BTI)</div>
                </div>

                {/* Pihak II: Penerima / Lead Teknisi */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>PIHAK KEDUA (Penerima Pekerjaan)</div>
                  <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px' }}>
                    {bastMission.bast_tech_approved_by ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #16a34a', padding: '6px 16px', borderRadius: '6px', backgroundColor: '#f0fdf4' }}>
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> [ PENGESAHAN DIGITAL SYSTEM ]
                        </span>
                        <span style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
                          {bastMission.bast_tech_approved_at}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #f59e0b', padding: '6px 16px', borderRadius: '6px', backgroundColor: '#fffbeb' }}>
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>⏳ Menunggu Konfirmasi Teknisi</span>
                        <span style={{ fontSize: '9.5px', color: '#92400e', marginTop: '2px' }}>Belum dikonfirmasi</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                    {bastMission.bast_tech_approved_by || signerName || bastMission.bast_signer_name || '— Menunggu —'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {bastMission.bast_tech_approved_by ? (signerRole || bastMission.bast_signer_role || 'Teknisi Pelaksana') : 'Menunggu Konfirmasi'}
                  </div>
                </div>
              </div>

              {/* EMBEDDED VERIFICATION QR CODE BLOCK - Only shown when BOTH parties have approved */}
              {bastMission.bast_admin_approved_by && bastMission.bast_tech_approved_by ? (
                <div style={{ marginTop: '24px', borderTop: '2px dashed #cbd5e1', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '10px', paddingRight: '10px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} color="#16a34a" /> VERIFIKASI DIGITAL DOKUMEN BAST RESMI
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px', maxWidth: '420px' }}>
                      Dokumen ini telah disahkan secara digital oleh Tim Teknisi & Administrator Biro TI. Pindai QR Code untuk menguji keaslian dokumen dan audit trail pengesahan.
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>
                      HASH: {bastMission.bast_hash || `SHA256-NEMESYS-${bastMission.id}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {bastQrImageSrc ? (
                      <img
                        src={bastQrImageSrc}
                        alt="QR Code Verifikasi BAST"
                        onClick={() => handleVerifyBast(bastMission.id)}
                        style={{ width: '90px', height: '90px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '3px', backgroundColor: '#fff', cursor: 'pointer' }}
                      />
                    ) : (
                      <div style={{ width: '90px', height: '90px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>
                        QR Code
                      </div>
                    )}
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                      ID: VERIFY-{bastMission.id}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '24px', borderTop: '2px dashed #fde68a', paddingTop: '14px', backgroundColor: '#fffbeb', borderRadius: '6px', padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                    ⏳ QR Code Verifikasi belum tersedia
                  </div>
                  <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
                    QR Code & Hash Digital akan muncul setelah <strong>kedua pihak</strong> (Manager BTI & Teknisi) menyelesaikan pengesahan digital.
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Modal Close & Print Controls */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <button
                onClick={() => handleVerifyBast(bastMission.id)}
                style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <QrIcon size={16} /> Pratinjau Tampilan Scan QR Code
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setIsBastModalOpen(false)}
                  style={{ backgroundColor: '#64748b', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Tutup Dokumen
                </button>
                <button
                  onClick={handlePrintBast}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Cetak BAST (A4)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL PORTAL VERIFIKASI QR CODE (SCAN RESULTS SIMULATOR) */}
      {isVerifyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: '#0f172a', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '16px', padding: '24px', color: '#fff', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.9)' }}>
            
            {/* Header Status Banner */}
            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#16a34a', color: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px' }}>
                <ShieldCheck size={18} /> 🟢 DOKUMEN RESMI TERVERIFIKASI SISTEM
              </div>
              <h3 style={{ margin: '12px 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#4ade80' }}>
                BERITA ACARA SERAH TERIMA (BAST)
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nemesys IT Infrastructure Management System • Keaslian Dokumen Terjamin</span>
            </div>

            {isVerifyingLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                <div>Memverifikasi tanda tangan digital & enkripsi dokumen...</div>
              </div>
            ) : verifyData ? (
              <div>
                {/* Informasi Misi & Dokumen */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>📌 Rincian Dokumen Penugasan</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                    {verifyData.bast_number}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                    {verifyData.title}
                  </div>
                  {verifyData.description && (
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '4px' }}>
                      {verifyData.description}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                    📅 Diselesaikan pada: <strong>{verifyData.date_finished}</strong>
                  </div>
                </div>

                {/* Audit Trail Pengesahan Digital (Approvals) */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>👥 Riwayat Pengesahan Digital (Audit Trail)</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Admin / Manager Approval */}
                    <div style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 700, marginBottom: '4px' }}>👑 PEMBERI TUGAS / MANAGER BTI</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{verifyData.approvals?.admin?.approved_by}</div>
                      <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px', fontWeight: 600 }}>
                        ✅ {verifyData.approvals?.admin?.status}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                        {verifyData.approvals?.admin?.approved_at}
                      </div>
                    </div>

                    {/* Teknisi Approval */}
                    <div style={{ backgroundColor: 'rgba(20, 83, 45, 0.3)', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#86efac', fontWeight: 700, marginBottom: '4px' }}>👷 PELAKSANA / LEAD TEKNISI</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{verifyData.approvals?.tech?.approved_by}</div>
                      <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px', fontWeight: 600 }}>
                        ✅ {verifyData.approvals?.tech?.status}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                        {verifyData.approvals?.tech?.approved_at}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist Pekerjaan Selesai */}
                {verifyData.checklists && verifyData.checklists.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>🛠️ Rincian Checklist Terverifikasi ({verifyData.checklists.length} Item)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {verifyData.checklists.map((c: any, i: number) => (
                        <div key={i} style={{ fontSize: '12px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Cryptographic Hash */}
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px', fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}>
                  🔒 DIGITAL SECURITY HASH: <br/>
                  <strong style={{ color: '#fbbf24' }}>{verifyData.hash}</strong>
                </div>
              </div>
            ) : null}

            {/* Modal Close Button */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsVerifyModalOpen(false)}
                style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Tutup Hasil Verifikasi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Embedded CSS for Clean A4 Printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          #bast-print-area, #bast-print-area * {
            visibility: visible !important;
          }

          .bast-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .bast-modal-card {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          #bast-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
