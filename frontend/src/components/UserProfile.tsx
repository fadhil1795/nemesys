import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Shield, 
  KeyRound, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  MessageSquare, 
  Activity, 
  Award, 
  Clock,
  Briefcase,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileBadge,
  Share2
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import { openWhatsAppChat, WATemplates } from '../utils/whatsapp';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: 'Administrator' | 'Manager' | 'Teknisi';
  status?: 'Available' | 'Busy';
  telegram_chat_id?: string;
  daily_tasks_count?: number;
  mission_completed?: number;
  nipp?: string;
  division?: string;
  jabatan?: string;
  phone?: string;
  email?: string;
  location?: string;
}

interface UserProfileProps {
  token: string;
  currentUser: AuthUser;
  onUserUpdate: (updatedUser: AuthUser) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ token, currentUser, onUserUpdate }) => {
  // Form fields
  const [name, setName] = useState(currentUser.name || '');
  const [nipp, setNipp] = useState(currentUser.nipp || '');
  const [division, setDivision] = useState(currentUser.division || '');
  const [jabatan, setJabatan] = useState(currentUser.jabatan || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [telegramChatId, setTelegramChatId] = useState(currentUser.telegram_chat_id || '');
  const [status, setStatus] = useState<'Available' | 'Busy'>(currentUser.status || 'Available');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [profileData, setProfileData] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch complete user profile from backend
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setProfileData(data);
        setName(data.name || '');
        setNipp(data.nipp || '');
        setDivision(data.division || '');
        setJabatan(data.jabatan || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setLocation(data.location || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setStatus(data.status || 'Available');
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Konfirmasi password baru tidak cocok!' });
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setMsg({ type: 'error', text: 'Password baru minimal 4 karakter!' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          nipp,
          division,
          jabatan,
          phone,
          email,
          location,
          telegram_chat_id: telegramChatId,
          status,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMsg({ type: 'success', text: 'Profil & data kepegawaian berhasil diperbarui!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        if (data.user) {
          setProfileData(data.user);
          onUserUpdate({
            ...currentUser,
            name: data.user.name,
            role: data.user.role,
            status: data.user.status,
            telegram_chat_id: data.user.telegram_chat_id,
            nipp: data.user.nipp,
            division: data.user.division,
            jabatan: data.user.jabatan,
            phone: data.user.phone,
            email: data.user.email,
            location: data.user.location
          });
        }
      } else {
        setMsg({ type: 'error', text: data.error || 'Gagal memperbarui profil.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal menghubungi server backend.' });
    } finally {
      setSaving(false);
    }
  };

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'Administrator':
        return <span className="menu-item-badge badge-amber" style={{ fontSize: '11.5px', padding: '4px 12px' }}><Shield size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Administrator</span>;
      case 'Manager':
        return <span className="menu-item-badge badge-indigo" style={{ fontSize: '11.5px', padding: '4px 12px' }}><Activity size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Manager NOC</span>;
      default:
        return <span className="menu-item-badge badge-cyan" style={{ fontSize: '11.5px', padding: '4px 12px' }}><UserIcon size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Teknisi NOC</span>;
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {loading && (
        <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} className="animate-spin" /> Memuat data profil & kepegawaian terbaru...
        </div>
      )}

      {/* Header Profile Card */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '28px',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 28px rgba(2, 132, 199, 0.5)',
            fontSize: '32px',
            fontWeight: 800
          }}>
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>{name || 'Pengguna NEMESYS'}</h2>
              {renderRoleBadge(currentUser.role)}
              {status === 'Available' ? (
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontWeight: 700 }}>
                  ● Available
                </span>
              ) : (
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: 700 }}>
                  ● Busy
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '4px', fontSize: '13px', color: '#94a3b8' }}>
              <span>@{currentUser.username} &bull; ID: #{currentUser.id}</span>
              {nipp && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontWeight: 600 }}>
                  <FileBadge size={14} /> NIPP: {nipp}
                </span>
              )}
              {division && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                  <Building2 size={14} className="text-cyan-400" /> {division}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Badges */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            padding: '12px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '110px'
          }}>
            <Award size={20} style={{ color: '#fbbf24', margin: '0 auto 4px auto' }} />
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
              {profileData?.mission_completed || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Misi Selesai</div>
          </div>

          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            padding: '12px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '110px'
          }}>
            <Clock size={20} style={{ color: '#38bdf8', margin: '0 auto 4px auto' }} />
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
              {profileData?.daily_tasks_count || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Tugas Hari Ini</div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {msg && (
        <div className="glass-card" style={{
          borderColor: msg.type === 'success' ? '#10b981' : '#ef4444',
          backgroundColor: msg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: msg.type === 'success' ? '#34d399' : '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '12px'
        }}>
          {msg.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {msg.text}
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Section 1: Identitas & Kepegawaian */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)' }}>
          <div style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserIcon size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>1. Identitas & Data Kepegawaian</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Nama Lengkap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Nama Lengkap *</label>
              <input
                type="text"
                required
                placeholder="Masukkan nama lengkap..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* NIPP / ID Pegawai */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileBadge size={14} style={{ color: '#38bdf8' }} /> NIPP / ID Pegawai
              </label>
              <input
                type="text"
                placeholder="Contoh: NIPP-2026.04.108"
                value={nipp}
                onChange={(e) => setNipp(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#34d399',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Username (Read Only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Username Sistem <Lock size={12} style={{ color: '#64748b' }} />
              </label>
              <input
                type="text"
                disabled
                value={currentUser.username}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(51, 65, 85, 0.4)',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'not-allowed'
                }}
              />
            </div>

            {/* Role Sistem (Read Only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Role Akses Sistem <Lock size={12} style={{ color: '#64748b' }} />
              </label>
              <input
                type="text"
                disabled
                value={currentUser.role}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(51, 65, 85, 0.4)',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'not-allowed'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Unit Kerja & Jabatan */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)' }}>
          <div style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={18} style={{ color: '#06b6d4' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>2. Unit Kerja & Jabatan</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Divisi / Unit Kerja */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} style={{ color: '#38bdf8' }} /> Divisi / Unit Kerja
              </label>
              <input
                type="text"
                placeholder="Contoh: Divisi IT &amp; NOC Monitoring"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Jabatan / Posisi Pekerjaan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Briefcase size={14} style={{ color: '#fbbf24' }} /> Jabatan / Posisi Pekerjaan
              </label>
              <input
                type="text"
                placeholder="Contoh: Senior Network Engineer &amp; NOC Lead"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Lokasi Kerja / Subnet Operasional */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#f43f5e' }} /> Lokasi Kerja / Wilayah Operasional
              </label>
              <input
                type="text"
                placeholder="Contoh: Ruang Server NOC Central - Kampus Utama"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Kontak & Komunikasi */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)' }}>
          <div style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Phone size={18} style={{ color: '#34d399' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>3. Kontak & Komunikasi</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* No. Telepon / WhatsApp */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} style={{ color: '#34d399' }} /> No. Telepon / WhatsApp
                </label>
                {phone && (
                  <button
                    type="button"
                    onClick={() => openWhatsAppChat(phone, WATemplates.profileVerification(name, nipp, division, currentUser.role))}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '4px',
                      color: '#34d399',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Kirim pesan verifikasi langsung via WhatsApp Web/App (Tanpa API)"
                  >
                    <Share2 size={12} /> Kirim ke WA
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Email Resmi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} style={{ color: '#38bdf8' }} /> Email Resmi / Dinas
              </label>
              <input
                type="email"
                placeholder="Contoh: pegawai@untag.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Status Ketersediaan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Status Ketersediaan</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Available' | 'Busy')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              >
                <option value="Available" style={{ background: '#0f172a' }}>Available (Tersedia / On-Call)</option>
                <option value="Busy" style={{ background: '#0f172a' }}>Busy (Sedang Bertugas / Off-Duty)</option>
              </select>
            </div>
          </div>

          {/* WhatsApp Deep Link Integration Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800
              }}>
                <Phone size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#34d399' }}>Integrasi WA Direct (Tanpa API Gateway)</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Mengirim notifikasi & detail tugas secara langsung melalui tautan WhatsApp Web / App gratis tanpa butuh API key/berlangganan.</div>
              </div>
            </div>

            <button
              type="button"
              disabled={!phone}
              onClick={() => openWhatsAppChat(phone, WATemplates.profileVerification(name, nipp, division, currentUser.role))}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                padding: '8px 16px',
                cursor: phone ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: phone ? 1 : 0.6
              }}
            >
              <Share2 size={14} /> Kirim Profil ke WA Saya
            </button>
          </div>

          {/* Telegram Chat ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} style={{ color: '#38bdf8' }} /> Telegram Chat ID (Notifikasi Bot Sirine Alarm)
            </label>
            <input
              type="text"
              placeholder="Contoh: 12345678 (Ketik /start pada Bot Telegram untuk mendapatkan ID)"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Section 4: Keamanan (Ubah Password) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)' }}>
          <div style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.6)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KeyRound size={18} style={{ color: '#a5b4fc' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>4. Keamanan Akun (Ubah Password)</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Biarkan kolom password kosong jika Anda tidak ingin mengubah password akun Anda.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Password Saat Ini</label>
              <input
                type="password"
                placeholder="Masukkan password saat ini..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Password Baru</label>
              <input
                type="password"
                placeholder="Masukkan password baru..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Konfirmasi Password Baru</label>
              <input
                type="password"
                placeholder="Ulangi password baru..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              padding: '12px 32px',
              fontSize: '14.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
            }}
          >
            <Send size={16} />
            {saving ? 'Menyimpan Profil...' : 'Simpan Seluruh Perubahan Profil'}
          </button>
        </div>
      </form>
    </div>
  );
};
