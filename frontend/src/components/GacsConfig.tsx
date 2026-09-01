import React, { useState, useEffect } from 'react';
import { Settings, Wifi, MessageSquare, CheckCircle, XCircle, Save, TestTube, Server } from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { GenieACSCredentials, MikroTikCredentials, TelegramBotConfig } from '../types';

interface GacsConfigProps {
  token: string;
}

type Tab = 'acs' | 'mikrotik' | 'telegram' | 'reports' | 'webhook';

const STATUS_BADGE = {
  connected: { color: '#22c55e', icon: <CheckCircle size={13} />, label: 'Connected' },
  disconnected: { color: '#ef4444', icon: <XCircle size={13} />, label: 'Disconnected' },
  unknown: { color: '#94a3b8', icon: <XCircle size={13} />, label: 'Belum ditest' },
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '10px 13px',
  color: 'var(--text-primary)',
  fontSize: '13.5px',
  width: '100%',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12.5px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '5px',
  display: 'block',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
};

export const GacsConfig: React.FC<GacsConfigProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<Tab>('acs');

  // ---- ACS State ----
  const [acsHost, setAcsHost] = useState('');
  const [acsPort, setAcsPort] = useState('7557');
  const [acsUser, setAcsUser] = useState('');
  const [acsPass, setAcsPass] = useState('');
  const [acsCfg, setAcsCfg] = useState<GenieACSCredentials | null>(null);
  const [acsMsg, setAcsMsg] = useState('');
  const [acsMsgOk, setAcsMsgOk] = useState(true);
  const [acsSaving, setAcsSaving] = useState(false);
  const [acsTesting, setAcsTesting] = useState(false);

  // ---- MikroTik State ----
  const [mtHost, setMtHost] = useState('');
  const [mtPort, setMtPort] = useState('8728');
  const [mtUser, setMtUser] = useState('');
  const [mtPass, setMtPass] = useState('');
  const [mtCfg, setMtCfg] = useState<MikroTikCredentials | null>(null);
  const [mtMsg, setMtMsg] = useState('');
  const [mtMsgOk, setMtMsgOk] = useState(true);
  const [mtSaving, setMtSaving] = useState(false);
  const [mtTesting, setMtTesting] = useState(false);

  // ---- Telegram State ----
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [tgCfg, setTgCfg] = useState<TelegramBotConfig | null>(null);
  const [tgMsg, setTgMsg] = useState('');
  const [tgMsgOk, setTgMsgOk] = useState(true);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);

  // ---- GAP #11: Scheduled Reports State ----
  const [schedules, setSchedules] = useState<any[]>([]);
  const [newRepType, setNewRepType] = useState<'daily' | 'weekly'>('daily');
  const [newRepTime, setNewRepTime] = useState('08:00');
  const [newRepDay, setNewRepDay] = useState('1');
  const [newRepChat, setNewRepChat] = useState('');
  const [repSaving, setRepSaving] = useState(false);

  // ---- GAP #12: Webhook Logs State ----
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/report-schedules`, { headers });
      const data = await res.json();
      if (data.success) setSchedules(data.schedules || []);
    } catch {}
  };

  const handleAddSchedule = async () => {
    setRepSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/report-schedules`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          report_type: newRepType,
          schedule_time: newRepTime,
          schedule_day: newRepType === 'weekly' ? parseInt(newRepDay) : null,
          chat_id: newRepChat || null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✓ Jadwal laporan berhasil ditambahkan');
        fetchSchedules();
      } else alert('Gagal: ' + data.error);
    } catch (e: any) { alert('Error: ' + e.message); }
    setRepSaving(false);
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!window.confirm('Hapus jadwal laporan ini?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/report-schedules/${id}`, { method: 'DELETE', headers });
      fetchSchedules();
    } catch {}
  };

  const handleSendScheduleNow = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/report-schedules/${id}/send`, { method: 'POST', headers });
      const data = await res.json();
      alert(data.message || (data.success ? 'Laporan terkirim' : 'Gagal'));
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const fetchWebhookLogs = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/webhook-logs`, { headers });
      const data = await res.json();
      if (data.success) setWebhookLogs(data.logs || []);
    } catch {}
    setLoadingWebhooks(false);
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchSchedules();
    if (activeTab === 'webhook') fetchWebhookLogs();
  }, [activeTab]);


  // Load ACS config
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/config/acs`, { headers })
      .then(r => r.json())
      .then((data: any[]) => {
        if (data && data.length > 0) {
          setAcsCfg(data[0]);
          setAcsHost(data[0].host ?? '');
          setAcsPort(String(data[0].port ?? 7557));
          setAcsUser(data[0].username ?? '');
        }
      })
      .catch(() => {});
  }, []);

  // Load MikroTik config
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/config/mikrotik`, { headers })
      .then(r => r.json())
      .then((data: any[]) => {
        if (data && data.length > 0) {
          setMtCfg(data[0]);
          setMtHost(data[0].host ?? '');
          setMtPort(String(data[0].port ?? 8728));
          setMtUser(data[0].username ?? '');
        }
      })
      .catch(() => {});
  }, []);

  // Load Telegram config
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/config/telegram-bot`, { headers })
      .then(r => r.json())
      .then((data: any[]) => {
        if (data && data.length > 0) {
          setTgCfg(data[0]);
          setTgChat(data[0].chat_id ?? '');
        }
      })
      .catch(() => {});
  }, []);

  // ---- ACS Handlers ----
  const handleSaveACS = async () => {
    if (!acsHost) { setAcsMsg('Host wajib diisi'); setAcsMsgOk(false); return; }
    setAcsSaving(true); setAcsMsg('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/acs`, {
        method: 'POST', headers,
        body: JSON.stringify({ host: acsHost, port: parseInt(acsPort), username: acsUser, password: acsPass }),
      });
      const d = await r.json();
      if (r.ok) { setAcsMsg('✓ Konfigurasi ACS disimpan'); setAcsMsgOk(true); }
      else { setAcsMsg(d.error || 'Gagal menyimpan'); setAcsMsgOk(false); }
    } catch { setAcsMsg('Error koneksi ke server'); setAcsMsgOk(false); }
    setAcsSaving(false);
  };

  const handleTestACS = async () => {
    setAcsTesting(true); setAcsMsg('Sedang menguji koneksi...');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/acs/test`, { method: 'POST', headers });
      const d = await r.json();
      setAcsMsg(d.success ? '✓ ' + d.message : '✗ ' + (d.message || d.error));
      setAcsMsgOk(d.success);
      if (d.success) setAcsCfg(prev => prev ? { ...prev, is_connected: 1 } : prev);
    } catch { setAcsMsg('Error koneksi ke server'); setAcsMsgOk(false); }
    setAcsTesting(false);
  };

  // ---- MikroTik Handlers ----
  const handleSaveMT = async () => {
    if (!mtHost || !mtUser || !mtPass) { setMtMsg('Host, username, dan password wajib diisi'); setMtMsgOk(false); return; }
    setMtSaving(true); setMtMsg('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/mikrotik`, {
        method: 'POST', headers,
        body: JSON.stringify({ host: mtHost, port: parseInt(mtPort), username: mtUser, password: mtPass }),
      });
      const d = await r.json();
      if (r.ok) { setMtMsg('✓ Konfigurasi MikroTik disimpan'); setMtMsgOk(true); }
      else { setMtMsg(d.error || 'Gagal menyimpan'); setMtMsgOk(false); }
    } catch { setMtMsg('Error koneksi ke server'); setMtMsgOk(false); }
    setMtSaving(false);
  };

  const handleTestMT = async () => {
    setMtTesting(true); setMtMsg('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/mikrotik/test`, { method: 'POST', headers });
      const d = await r.json();
      setMtMsg(d.success ? '✓ ' + d.message : '✗ ' + (d.message || d.error));
      setMtMsgOk(d.success);
      if (d.success) setMtCfg(prev => prev ? { ...prev, is_connected: 1 } : prev);
    } catch { setMtMsg('Error koneksi ke server'); setMtMsgOk(false); }
    setMtTesting(false);
  };

  // ---- Telegram Handlers ----
  const handleSaveTG = async () => {
    if (!tgToken || !tgChat) { setTgMsg('Bot Token dan Chat ID wajib diisi'); setTgMsgOk(false); return; }
    setTgSaving(true); setTgMsg('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/telegram-bot`, {
        method: 'POST', headers,
        body: JSON.stringify({ bot_token: tgToken, chat_id: tgChat }),
      });
      const d = await r.json();
      if (r.ok) { setTgMsg('✓ Konfigurasi Telegram disimpan'); setTgMsgOk(true); }
      else { setTgMsg(d.error || 'Gagal menyimpan'); setTgMsgOk(false); }
    } catch { setTgMsg('Error koneksi ke server'); setTgMsgOk(false); }
    setTgSaving(false);
  };

  const handleTestTG = async () => {
    setTgTesting(true); setTgMsg('Mengirim pesan test...');
    try {
      const r = await fetch(`${BACKEND_URL}/api/config/telegram-bot/test`, { method: 'POST', headers });
      const d = await r.json();
      setTgMsg(d.success ? '✓ ' + d.message : '✗ ' + (d.message || d.error));
      setTgMsgOk(d.success);
    } catch { setTgMsg('Error koneksi ke server'); setTgMsgOk(false); }
    setTgTesting(false);
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'acs', label: 'ACS Config', icon: <Server size={15} /> },
    { key: 'mikrotik', label: 'MikroTik Config', icon: <Wifi size={15} /> },
    { key: 'telegram', label: 'Telegram Bot', icon: <MessageSquare size={15} /> },
    { key: 'reports', label: 'Scheduled Reports', icon: <Settings size={15} /> },
    { key: 'webhook', label: 'Webhook Receiver', icon: <Server size={15} /> },
  ];

  const statusInfo = (connected?: number) => {
    if (connected === 1) return STATUS_BADGE.connected;
    if (connected === 0) return STATUS_BADGE.disconnected;
    return STATUS_BADGE.unknown;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Konfigurasi Sistem</h2>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13.5px' }}>
          Atur koneksi ke GenieACS, MikroTik API, Telegram Bot, Scheduled Reports, dan Webhook Receiver.
        </p>

        {/* Tab Header */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px',
                borderRadius: '8px', border: activeTab === tab.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                background: activeTab === tab.key ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- ACS Tab ---- */}
      {activeTab === 'acs' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>GenieACS NBI API</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Koneksi ke GenieACS Northbound Interface (default port 7557)</p>
            </div>
            {acsCfg !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 600, color: statusInfo(acsCfg.is_connected).color }}>
                {statusInfo(acsCfg.is_connected).icon} {statusInfo(acsCfg.is_connected).label}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ gridColumn: '1 / -1', ...rowStyle }}>
              <label style={labelStyle}>Host / IP GenieACS</label>
              <input style={inputStyle} placeholder="contoh: 127.0.0.1 atau 192.168.1.10" value={acsHost} onChange={e => setAcsHost(e.target.value)} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Port NBI</label>
              <input style={inputStyle} type="number" value={acsPort} onChange={e => setAcsPort(e.target.value)} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Username (opsional)</label>
              <input style={inputStyle} placeholder="kosongkan jika tidak ada auth" value={acsUser} onChange={e => setAcsUser(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1', ...rowStyle }}>
              <label style={labelStyle}>Password (opsional)</label>
              <input style={inputStyle} type="password" value={acsPass} onChange={e => setAcsPass(e.target.value)} />
            </div>
          </div>

          {acsMsg && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: acsMsgOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: acsMsgOk ? '#22c55e' : '#ef4444',
              border: `1px solid ${acsMsgOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {acsMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSaveACS} disabled={acsSaving} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <Save size={14} /> {acsSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={handleTestACS} disabled={acsTesting} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-primary)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <TestTube size={14} /> {acsTesting ? 'Testing...' : 'Test Koneksi'}
            </button>
          </div>
        </div>
      )}

      {/* ---- MikroTik Tab ---- */}
      {activeTab === 'mikrotik' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>MikroTik RouterOS API</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Koneksi ke MikroTik API (default port 8728)</p>
            </div>
            {mtCfg !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 600, color: statusInfo(mtCfg.is_connected).color }}>
                {statusInfo(mtCfg.is_connected).icon} {statusInfo(mtCfg.is_connected).label}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ gridColumn: '1 / -1', ...rowStyle }}>
              <label style={labelStyle}>Host / IP MikroTik</label>
              <input style={inputStyle} placeholder="contoh: 10.0.0.1" value={mtHost} onChange={e => setMtHost(e.target.value)} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Port API</label>
              <input style={inputStyle} type="number" value={mtPort} onChange={e => setMtPort(e.target.value)} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Username</label>
              <input style={inputStyle} placeholder="admin" value={mtUser} onChange={e => setMtUser(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1', ...rowStyle }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={mtPass} onChange={e => setMtPass(e.target.value)} />
            </div>
          </div>

          {mtMsg && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: mtMsgOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: mtMsgOk ? '#22c55e' : '#ef4444',
              border: `1px solid ${mtMsgOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {mtMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSaveMT} disabled={mtSaving} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <Save size={14} /> {mtSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={handleTestMT} disabled={mtTesting} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-primary)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <TestTube size={14} /> {mtTesting ? 'Testing...' : 'Test Koneksi'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Telegram Tab ---- */}
      {activeTab === 'telegram' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>Telegram Bot Config</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                Buat bot via <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>@BotFather</a> dan dapatkan Chat ID via <a href="https://t.me/ChatidinfoBot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>@ChatidinfoBot</a>.
              </p>
            </div>
            {tgCfg !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 600, color: statusInfo(tgCfg.is_connected).color }}>
                {statusInfo(tgCfg.is_connected).icon} {statusInfo(tgCfg.is_connected).label}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            <div style={rowStyle}>
              <label style={labelStyle}>Bot Token</label>
              <input style={inputStyle} type="password" placeholder="1234567890:AABBCCDDeeffgghhiijj..." value={tgToken} onChange={e => setTgToken(e.target.value)} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Chat ID</label>
              <input style={inputStyle} placeholder="contoh: -1001234567890 atau 123456789" value={tgChat} onChange={e => setTgChat(e.target.value)} />
            </div>
          </div>

          {tgMsg && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: tgMsgOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: tgMsgOk ? '#22c55e' : '#ef4444',
              border: `1px solid ${tgMsgOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {tgMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSaveTG} disabled={tgSaving} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <Save size={14} /> {tgSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={handleTestTG} disabled={tgTesting} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-primary)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer'
            }}>
              <TestTube size={14} /> {tgTesting ? 'Mengirim...' : 'Test Kirim Pesan'}
            </button>
          </div>
        </div>
      )}

      {/* ---- GAP #11: Scheduled Reports Tab ---- */}
      {activeTab === 'reports' && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>Scheduled System Reports (Telegram)</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Konfigurasi jadwal pengiriman laporan otomatis status GenieACS & MikroTik</p>
          </div>

          {/* Form Tambah Schedule */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '13.5px' }}>Tambah Jadwal Baru</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Tipe Laporan</label>
                <select style={inputStyle} value={newRepType} onChange={e => setNewRepType(e.target.value as any)}>
                  <option value="daily">Daily (Harian)</option>
                  <option value="weekly">Weekly (Mingguan)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Jam Pengiriman (HH:MM)</label>
                <input style={inputStyle} type="time" value={newRepTime} onChange={e => setNewRepTime(e.target.value)} />
              </div>
              {newRepType === 'weekly' && (
                <div>
                  <label style={labelStyle}>Hari (0=Minggu, 1=Senin)</label>
                  <select style={inputStyle} value={newRepDay} onChange={e => setNewRepDay(e.target.value)}>
                    <option value="1">Senin</option>
                    <option value="2">Selasa</option>
                    <option value="3">Rabu</option>
                    <option value="4">Kamis</option>
                    <option value="5">Jumat</option>
                    <option value="6">Sabtu</option>
                    <option value="0">Minggu</option>
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Custom Chat ID (Opsional)</label>
                <input style={inputStyle} placeholder="Default Telegram Chat ID" value={newRepChat} onChange={e => setNewRepChat(e.target.value)} />
              </div>
              <div>
                <button onClick={handleAddSchedule} disabled={repSaving} className="btn-primary" style={{ padding: '9px 16px', fontSize: '13px', width: '100%' }}>
                  + Tambah Jadwal
                </button>
              </div>
            </div>
          </div>

          {/* List Schedule */}
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipe</th>
                <th>Waktu</th>
                <th>Hari (Weekly)</th>
                <th>Target Chat ID</th>
                <th>Terakhir Terkirim</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Belum ada jadwal laporan khusus (menggunakan jadwal harian default 08:00)</td></tr>
              ) : (
                schedules.map(s => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{s.report_type}</td>
                    <td>{s.schedule_time}</td>
                    <td>{s.report_type === 'weekly' ? ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][s.schedule_day || 0] : '—'}</td>
                    <td>{s.chat_id || 'Default Chat ID'}</td>
                    <td>{s.last_sent_at ? new Date(s.last_sent_at).toLocaleString('id-ID') : 'Belum pernah'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleSendScheduleNow(s.id)} style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', color: '#22c55e', cursor: 'pointer' }}>Kirim Sekarang</button>
                        <button onClick={() => handleDeleteSchedule(s.id)} style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', cursor: 'pointer' }}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- GAP #12: Webhook Receiver Tab ---- */}
      {activeTab === 'webhook' && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>Webhook Receiver & Integrasi External</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Terima HTTP push notification dari Zabbix, Telegram, GenieACS, atau sistem external.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#38bdf8', marginBottom: '6px' }}>Zabbix Webhook</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11.5px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '8px' }}>
                {BACKEND_URL}/webhook/zabbix
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Header: <code>X-Webhook-Secret: [Secret]</code></div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0088cc', marginBottom: '6px' }}>Telegram Bot Webhook</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11.5px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '8px' }}>
                {BACKEND_URL}/webhook/telegram
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Standard Telegram Bot API Callback</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#22c55e', marginBottom: '6px' }}>Generic External Webhook</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11.5px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '8px' }}>
                {BACKEND_URL}/webhook/generic
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Header: <code>X-Source: [SystemName]</code></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px' }}>Live Webhook Request Logs (50 Terakhir)</h4>
              <button onClick={fetchWebhookLogs} disabled={loadingWebhooks} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}>
                Refresh Logs
              </button>
            </div>

            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source</th>
                  <th>Payload Preview</th>
                  <th>Waktu Menerima</th>
                </tr>
              </thead>
              <tbody>
                {webhookLogs.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Belum ada webhook log yang masuk</td></tr>
                ) : (
                  webhookLogs.map(l => (
                    <tr key={l.id}>
                      <td>#{l.id}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{l.source}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {typeof l.payload === 'string' ? l.payload.substring(0, 100) : JSON.stringify(l.payload).substring(0, 100)}...
                        </span>
                      </td>
                      <td>{new Date(l.created_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


