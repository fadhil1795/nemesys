import React, { useState, useEffect } from 'react';
import { Terminal, Shield, User, Clock, Search, AlertCircle } from 'lucide-react';
import { BACKEND_URL } from '../App';

interface SystemLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export const SystemLogs: React.FC<{ token: string }> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'system' | 'client'>('system');

  // System Audit Logs
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Client Logs (Gap #4)
  const [clientLogs, setClientLogs] = useState<any[]>([]);
  const [loadingClient, setLoadingClient] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/system-logs`, { headers });
      if (!res.ok) throw new Error('Failed to fetch system logs');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientLogs = async () => {
    setLoadingClient(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/client-logs?level=${filterLevel}`, { headers });
      const data = await res.json();
      if (data.success) setClientLogs(data.logs || []);
    } catch {}
    setLoadingClient(false);
  };

  const handleClearClientLogs = async () => {
    if (!window.confirm('Yakin ingin menghapus seluruh log client?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/client-logs`, { method: 'DELETE', headers });
      fetchClientLogs();
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'system') fetchLogs();
    if (activeTab === 'client') fetchClientLogs();
  }, [activeTab, filterLevel, token]);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.username && l.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.details && l.details.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={24} color="var(--accent-primary)" /> System & Client Logs
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Mencatat setiap tindakan audit pengguna dan log/error JavaScript dari browser client.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('system')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: activeTab === 'system' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: activeTab === 'system' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'system' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '13px'
            }}
          >
            Audit Logs (Internal)
          </button>
          <button
            onClick={() => setActiveTab('client')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: activeTab === 'client' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: activeTab === 'client' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'client' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '13px'
            }}
          >
            Client Browser Logs
          </button>
        </div>
      </div>

      {activeTab === 'system' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Cari audit log..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>
          </div>

          {error ? (
            <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> {error}
            </div>
          ) : loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat catatan audit...</div>
          ) : (
            <div className="glass-card table-container">
              <table className="custom-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th style={{ width: '180px' }}>Waktu</th>
                    <th style={{ width: '150px' }}>Pengguna</th>
                    <th>Tindakan (Action)</th>
                    <th>Keterangan (Details)</th>
                    <th style={{ width: '130px' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Tidak ada log ditemukan</td>
                    </tr>
                  ) : filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>#{log.id}</td>
                      <td style={{ fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} color="var(--text-secondary)" />
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <User size={14} color="var(--accent-primary)" />
                          {log.username || 'System / Guest'}
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 600, color: '#818cf8' }}>{log.action}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{log.details || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={12} /> {log.ip_address || '127.0.0.1'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* GAP #4: Client Logs View */}
      {activeTab === 'client' && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    background: filterLevel === lvl ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    color: filterLevel === lvl ? '#818cf8' : 'var(--text-secondary)',
                    border: filterLevel === lvl ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-color)'
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button
              onClick={handleClearClientLogs}
              style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Clear Client Logs
            </button>
          </div>

          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Level</th>
                <th>Pesan / Error</th>
                <th>URL Source</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {loadingClient ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>Memuat client logs...</td></tr>
              ) : clientLogs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px' }}>Belum ada client log yang tercatat</td></tr>
              ) : (
                clientLogs.map(l => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                        background: l.level === 'ERROR' ? 'rgba(239,68,68,0.2)' : l.level === 'WARN' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                        color: l.level === 'ERROR' ? '#ef4444' : l.level === 'WARN' ? '#f59e0b' : '#22c55e'
                      }}>
                        {l.level}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)' }}>{l.message}</td>
                    <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{l.url || '—'}</td>
                    <td>{new Date(l.created_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


