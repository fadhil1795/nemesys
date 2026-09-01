import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight,
  Eye, Zap, RotateCcw, Signal, Thermometer, AlertCircle, Loader,
  Tag, Trash2, Server, ServerCrash, Share2, LocateFixed
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { GenieACSDevice, MapItem } from '../types';

interface GacsDeviceListProps {
  token: string;
  onSelectDevice: (device: GenieACSDevice) => void;
}

const PAGE_SIZE = 20;

type TabType = 'onu' | 'odp' | 'odc' | 'olt' | 'server';

export const GacsDeviceList: React.FC<GacsDeviceListProps> = ({ token, onSelectDevice }) => {
  const [activeTab, setActiveTab] = useState<TabType>('onu');
  
  const [devices, setDevices] = useState<GenieACSDevice[]>([]);
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [page, setPage] = useState(0);
  
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  // Uplink Stats State
  const [uplinkStats, setUplinkStats] = useState<{ excellent: number; good: number; fair: number; poor: number; no_signal: number } | null>(null);

  // ONU Locations Batch Cache
  const [onuLocations, setOnuLocations] = useState<Record<string, any>>({});

  // Bulk Selection & Modal Result
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ total: number; succeeded: number; failed: number; results: any[] } | null>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchUplinkStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/uplink-stats`, { headers });
      const data = await res.json();
      if (data.excellent !== undefined) {
        setUplinkStats(data);
      }
    } catch {}
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resGacs, resMap] = await Promise.all([
        fetch(`${BACKEND_URL}/api/gacs/devices?limit=500`, { headers }),
        fetch(`${BACKEND_URL}/api/map/items`, { headers })
      ]);
      
      if (!resGacs.ok) throw new Error('Gagal mengambil data perangkat ACS');
      
      const [dGacs, dMap] = await Promise.all([resGacs.json(), resMap.json()]);
      const devs = dGacs.devices || [];
      
      setDevices(devs);
      setMapItems(Array.isArray(dMap) ? dMap : []);
      setSelectedIds(new Set());

      fetchUplinkStats();

      // ONU Location Batch Lookup
      if (devs.length > 0) {
        const sns = devs.map((d: any) => d.serialNumber).filter((sn: string) => sn && sn !== 'N/A').slice(0, 100);
        if (sns.length > 0) {
          fetch(`${BACKEND_URL}/api/map/onu-locations/batch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ serial_numbers: sns })
          }).then(r => r.json()).then(locData => {
            if (locData.success && locData.locations) {
              setOnuLocations(locData.locations);
            }
          }).catch(() => {});
        }
      }
    } catch (e: any) { 
      setError(e.message || 'Gagal menghubungi server'); 
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (deviceId: string, action: 'summon' | 'reboot') => {
    setActionMsg({ id: deviceId, msg: action === 'summon' ? 'Mengirim summon...' : 'Mengirim reboot...', ok: true });
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${encodeURIComponent(deviceId)}/${action}`, {
        method: 'POST', headers
      });
      const d = await res.json();
      setActionMsg({ id: deviceId, msg: d.message || (d.success ? 'Berhasil' : 'Gagal'), ok: d.success });
    } catch {
      setActionMsg({ id: deviceId, msg: 'Error koneksi', ok: false });
    }
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleBulkAction = async (action: 'summon' | 'reboot' | 'tag' | 'untag' | 'delete') => {
    if (selectedIds.size === 0) return;
    if (action === 'delete' && !window.confirm(`Hapus ${selectedIds.size} perangkat dari GenieACS?`)) return;
    
    let tagValue = '';
    if (action === 'tag') {
      const t = window.prompt('Masukkan nama tag baru:');
      if (!t) return;
      tagValue = t;
    } else if (action === 'untag') {
      const t = window.prompt('Masukkan tag yang akan dihapus:');
      if (!t) return;
      tagValue = t;
    }

    setBulkLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/bulk-action`, {
        method: 'POST', headers,
        body: JSON.stringify({ action, deviceIds: Array.from(selectedIds), tag: tagValue })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setBulkResult(d);
        setSelectedIds(new Set());
        loadData();
      } else {
        alert(`Gagal: ${d.error || 'Server error'}`);
      }
    } catch (e: any) {
      alert(`Error koneksi: ${e.message}`);
    }
    setBulkLoading(false);
  };


  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedGacs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedGacs.map(d => d._id)));
    }
  };

  // Filter GACS (ONU)
  const filteredGacs = devices.filter(d => {
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d._id.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      d.productClass.toLowerCase().includes(q) ||
      d.ipAddress.toLowerCase().includes(q)
    );
  });
  
  const totalPagesGacs = Math.ceil(filteredGacs.length / PAGE_SIZE);
  const paginatedGacs = filteredGacs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Filter Map Items
  const filteredMap = mapItems.filter(m => {
    if (m.item_type !== activeTab) return false;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    return m.name.toLowerCase().includes(search.toLowerCase());
  });

  const totalPagesMap = Math.ceil(filteredMap.length / PAGE_SIZE);
  const paginatedMap = filteredMap.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total ONU', value: devices.length, color: 'var(--accent-primary)', icon: <Wifi size={18} /> },
          { label: 'Online', value: onlineCount, color: '#22c55e', icon: <Wifi size={18} /> },
          { label: 'Offline', value: offlineCount, color: '#ef4444', icon: <WifiOff size={18} /> },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card">
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 8px' }}>
          {[
            { id: 'onu', label: 'ONU (TR-069)', icon: <Wifi size={14} />, count: devices.length },
            { id: 'odp', label: 'ODP', icon: <Share2 size={14} />, count: mapItems.filter(m => m.item_type === 'odp').length },
            { id: 'odc', label: 'ODC', icon: <Share2 size={14} />, count: mapItems.filter(m => m.item_type === 'odc').length },
            { id: 'olt', label: 'OLT', icon: <Server size={14} />, count: mapItems.filter(m => m.item_type === 'olt').length },
            { id: 'server', label: 'Server', icon: <ServerCrash size={14} />, count: mapItems.filter(m => m.item_type === 'server').length },
          ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id as TabType); setPage(0); setSelectedIds(new Set()); }} style={{
              padding: '14px 16px', background: 'transparent', cursor: 'pointer',
              border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === t.id ? 700 : 600, fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {t.icon} {t.label} 
              <span style={{ 
                background: activeTab === t.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', 
                padding: '2px 6px', borderRadius: '10px', fontSize: '11px', 
                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Action Bar */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder={`Cari ${activeTab.toUpperCase()}...`}
              style={{
                width: '100%', paddingLeft: '34px', paddingRight: '12px', padding: '9px 12px 9px 34px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'online', 'offline'] as const).map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(0); }} style={{
                padding: '8px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                background: filterStatus === s
                  ? s === 'online' ? 'rgba(34,197,94,0.2)' : s === 'offline' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'
                  : 'rgba(255,255,255,0.03)',
                border: filterStatus === s
                  ? s === 'online' ? '1px solid rgba(34,197,94,0.5)' : s === 'offline' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.2)'
                  : '1px solid var(--border-color)',
                color: filterStatus === s
                  ? s === 'online' ? '#22c55e' : s === 'offline' ? '#ef4444' : 'var(--text-primary)'
                  : 'var(--text-secondary)',
              }}>
                {s === 'all' ? 'Semua' : s === 'online' ? '🟢 Online' : '🔴 Offline'}
              </button>
            ))}
          </div>
          <button onClick={loadData} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
            borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
          }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        {/* GAP #8: Uplink Signal Distribution Dedicated Panel (ONU only) */}
        {activeTab === 'onu' && uplinkStats && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Signal size={14} style={{ color: 'var(--accent-primary)' }} /> Signal Quality Distribution (Optical RxPower)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {[
                { label: 'Excellent (>= -20 dBm)', count: uplinkStats.excellent, color: '#22c55e' },
                { label: 'Good (-20 ~ -25 dBm)', count: uplinkStats.good, color: '#38bdf8' },
                { label: 'Fair (-25 ~ -27 dBm)', count: uplinkStats.fair, color: '#f59e0b' },
                { label: 'Poor (< -27 dBm)', count: uplinkStats.poor, color: '#ef4444' },
                { label: 'No Signal', count: uplinkStats.no_signal, color: '#94a3b8' },
              ].map(st => {
                const total = devices.length || 1;
                const pct = Math.round((st.count / total) * 100);
                return (
                  <div key={st.label} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>{st.label}</span>
                      <span style={{ color: st.color, fontWeight: 800 }}>{st.count} ({pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: st.color, borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GAP #6: Real Bulk Actions (ONU only) */}
        {activeTab === 'onu' && selectedIds.size > 0 && (
          <div style={{ padding: '12px 20px', background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>
              {selectedIds.size} perangkat dipilih
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => handleBulkAction('summon')} disabled={bulkLoading} style={{
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e',
                borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
              }}>
                <Zap size={13} /> Summon All
              </button>
              <button onClick={() => handleBulkAction('reboot')} disabled={bulkLoading} style={{
                background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8',
                borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
              }}>
                <RotateCcw size={13} /> Reboot All
              </button>
              <button onClick={() => handleBulkAction('tag')} disabled={bulkLoading} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Tag size={13} /> Add Tag
              </button>
              <button onClick={() => handleBulkAction('untag')} disabled={bulkLoading} style={{
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b',
                borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
              }}>
                <Tag size={13} /> Untag
              </button>
              <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
              }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}


        {error && (
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '14px' }}>Memuat data...</span>
          </div>
        )}

        {/* Tables */}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  {activeTab === 'onu' && (
                    <th style={{ padding: '12px 14px', width: '40px' }}>
                      <input type="checkbox" checked={selectedIds.size === paginatedGacs.length && paginatedGacs.length > 0} onChange={toggleSelectAll} />
                    </th>
                  )}
                  {activeTab === 'onu' 
                    ? ['Status', 'Serial / ID', 'Manufacturer', 'Product Class', 'IP Address', 'RxPower', 'Suhu', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))
                    : ['Status', 'Nama', 'Lokasi (Lat, Lng)'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {activeTab === 'onu' ? (
                  paginatedGacs.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Tidak ada perangkat ONU</td>
                    </tr>
                  ) : paginatedGacs.map(d => {
                    const isMapped = mapItems.some(m => m.genieacs_device_id === d._id);
                    return (
                    <tr key={d._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <input type="checkbox" checked={selectedIds.has(d._id)} onChange={() => toggleSelect(d._id)} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.status === 'online' ? '#22c55e' : '#ef4444', boxShadow: d.status === 'online' ? '0 0 6px #22c55e88' : 'none' }} />
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: d.status === 'online' ? '#22c55e' : '#ef4444' }}>{d.status === 'online' ? 'Online' : 'Offline'}</span>
                        </div>
                        {d.ping !== null && d.status === 'online' && (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}><Signal size={10} style={{ marginRight: '2px' }} />{d.ping}ms</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }} title={d._id}>
                          {d.serialNumber}
                          {(() => {
                            const batchLoc = onuLocations[d.serialNumber];
                            if (batchLoc && batchLoc.found) {
                              const odpName = batchLoc.odp?.name || 'ODP';
                              const port = batchLoc.onu?.port || 'N/A';
                              return (
                                <span title={`Terdaftar di Peta (${odpName} - Port ${port})`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 700 }}>
                                  <LocateFixed size={10} style={{ marginRight: '2px' }} /> {odpName} P{port}
                                </span>
                              );
                            }
                            return isMapped ? (
                              <span title="Terdaftar di Peta" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 4px', borderRadius: '4px', fontSize: '9px' }}><LocateFixed size={10} /></span>
                            ) : (
                              <span title="Belum terdaftar di Peta" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', border: '1px solid rgba(255,255,255,0.1)' }}>No Map</span>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{d._id}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{d.manufacturer}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{d.productClass}</td>
                      <td style={{ padding: '12px 14px' }}><span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{d.ipAddress}</span></td>
                      <td style={{ padding: '12px 14px' }}>
                        {d.rxPower !== null ? (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: Number(d.rxPower) < -27 ? '#ef4444' : Number(d.rxPower) < -24 ? '#f59e0b' : '#22c55e' }}>{d.rxPower} dBm</span>
                        ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {d.temperature !== null ? (
                          <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px' }}><Thermometer size={12} style={{ color: '#f59e0b' }} /> {d.temperature}°C</span>
                        ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {actionMsg?.id === d._id ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: actionMsg.ok ? '#22c55e' : '#ef4444' }}>{actionMsg.msg}</span>
                          ) : (
                            <>
                              <button onClick={() => onSelectDevice(d)} style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> Detail</button>
                              <button onClick={() => { if(window.confirm(`Yakin ingin membangunkan (summon) perangkat ${d.serialNumber}?`)) handleAction(d._id, 'summon'); }} style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12} /> Summon</button>
                              <button onClick={() => { if(window.confirm(`Yakin ingin me-reboot perangkat ${d.serialNumber}?`)) handleAction(d._id, 'reboot'); }} style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={12} /> Reboot</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                  paginatedMap.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Tidak ada data node map jenis ini.</td>
                    </tr>
                  ) : paginatedMap.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.status === 'online' ? '#22c55e' : m.status === 'offline' ? '#ef4444' : '#9ca3af' }} />
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: m.status === 'online' ? '#22c55e' : m.status === 'offline' ? '#ef4444' : '#9ca3af' }}>{m.status.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>{m.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <LocateFixed size={12} /> {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {!loading && !error && (activeTab === 'onu' ? totalPagesGacs : totalPagesMap) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Total: {activeTab === 'onu' ? filteredGacs.length : filteredMap.length} item · Halaman {page + 1} dari {activeTab === 'onu' ? totalPagesGacs : totalPagesMap}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '7px', color: page === 0 ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '13px', cursor: page === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><ChevronLeft size={14} /> Prev</button>
              <button onClick={() => setPage(p => Math.min((activeTab === 'onu' ? totalPagesGacs : totalPagesMap) - 1, p + 1))} disabled={page === (activeTab === 'onu' ? totalPagesGacs : totalPagesMap) - 1} style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '7px', color: page === (activeTab === 'onu' ? totalPagesGacs : totalPagesMap) - 1 ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '13px', cursor: page === (activeTab === 'onu' ? totalPagesGacs : totalPagesMap) - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Result Modal */}
      {bulkResult && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '560px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap size={20} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Laporan Eksekusi Bulk Action</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Target</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{bulkResult.total}</div>
              </div>
              <div style={{ background: 'rgba(34,197,94,0.1)', padding: '12px', borderRadius: '8px', textAlign: 'center', color: '#22c55e' }}>
                <div style={{ fontSize: '11px' }}>Berhasil</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{bulkResult.succeeded}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px', textAlign: 'center', color: '#ef4444' }}>
                <div style={{ fontSize: '11px' }}>Gagal</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{bulkResult.failed}</div>
              </div>
            </div>

            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {bulkResult.results.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.deviceId}</span>
                  <span style={{ fontWeight: 700, color: r.ok ? '#22c55e' : '#ef4444' }}>
                    {r.ok ? '✅ Success' : `❌ ${r.error || 'Failed'}`}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkResult(null)} className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

