import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Trash2, Link, X, Save, MapPin, Share2 } from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { MapItem, MapConnection } from '../types';

interface GacsPonMapProps {
  token: string;
}

const ICONS: Record<MapItem['item_type'], { color: string; emoji: string; label: string }> = {
  server:   { color: '#6366f1', emoji: '🖥️', label: 'Server'   },
  isp:      { color: '#0ea5e9', emoji: '🌐', label: 'ISP'      },
  mikrotik: { color: '#f59e0b', emoji: '📡', label: 'MikroTik' },
  olt:      { color: '#8b5cf6', emoji: '💡', label: 'OLT'      },
  odc:      { color: '#10b981', emoji: '🔵', label: 'ODC'      },
  odp:      { color: '#3b82f6', emoji: '🔶', label: 'ODP'      },
  onu:      { color: '#22c55e', emoji: '📟', label: 'ONU'      },
  other:    { color: '#94a3b8', emoji: '📌', label: 'Other'    },
};

const STATUS_COLORS: Record<MapItem['status'], string> = {
  online:  '#22c55e',
  offline: '#ef4444',
  unknown: '#94a3b8',
};

const buildIcon = (type: MapItem['item_type'], status: MapItem['status']) => {
  const { color, emoji } = ICONS[type];
  const ring = STATUS_COLORS[status];
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color}22;
      border:2.5px solid ${ring};
      display:flex;align-items:center;justify-content:center;
      font-size:16px;cursor:pointer;
      box-shadow:0 0 8px ${ring}66;
    ">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

const CONN_COLORS: Record<MapConnection['connection_type'], string> = {
  online:  '#22c55e',
  offline: '#ef4444',
  unknown: '#94a3b8',
};

function ClickCapture({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export const GacsPonMap: React.FC<GacsPonMapProps> = ({ token }) => {
  const [items, setItems] = useState<MapItem[]>([]);
  const [connections, setConnections] = useState<MapConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelMode, setPanelMode] = useState<'none' | 'add-node' | 'add-conn'>('none');

  const [newType, setNewType] = useState<MapItem['item_type']>('onu');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  // Dynamic fields
  const [selectedOnu, setSelectedOnu] = useState('');
  const [odpRatio, setOdpRatio] = useState('1:8');
  const [oltPower, setOltPower] = useState('7.0');
  const [availableOnus, setAvailableOnus] = useState<{_id: string, serialNumber: string}[]>([]);
  const [clickingMap, setClickingMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgOk, setSaveMsgOk] = useState(true);

  const [connFrom, setConnFrom] = useState('');
  const [connTo, setConnTo] = useState('');
  const [connType, setConnType] = useState<MapConnection['connection_type']>('online');
  const [connSaving, setConnSaving] = useState(false);
  const [connMsg, setConnMsg] = useState('');
  const [connMsgOk, setConnMsgOk] = useState(true);

  // GAP #3: ODP Port Manager State
  const [odpManagerModal, setOdpManagerModal] = useState(false);
  const [odpPortList, setOdpPortList] = useState<any[]>([]);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcResult, setRecalcResult] = useState<any>(null);

  // GAP #9: Server Links Edit State
  const [serverLinksModal, setServerLinksModal] = useState(false);
  const [serverNodeId, setServerNodeId] = useState<number | null>(null);
  const [ispLink, setIspLink] = useState('');
  const [mikrotikDevId, setMikrotikDevId] = useState('');
  const [oltLink, setOltLink] = useState('');
  const [serverPonPorts, setServerPonPorts] = useState<{ port_number: number; output_power: number }[]>([]);
  const [serverSaving, setServerSaving] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const handleFetchOdpPorts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/map/odp-ports`, { headers });
      const data = await res.json();
      if (data.success) {
        setOdpPortList(data.odp_list || []);
      }
    } catch {}
  };

  const handleRecalculatePower = async () => {
    setRecalcLoading(true);
    setRecalcResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/map/recalculate`, { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        setRecalcResult(data);
        handleFetchOdpPorts();
        loadData();
      } else {
        alert('Gagal recalculate: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setRecalcLoading(false);
  };

  const handleOpenServerLinks = async (nodeId: number) => {
    setServerNodeId(nodeId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/map/items/${nodeId}/server-links`, { headers });
      const data = await res.json();
      if (data.success) {
        setIspLink(data.isp_link || '');
        setMikrotikDevId(data.mikrotik_device_id || '');
        setOltLink(data.olt_link || '');
        setServerPonPorts(data.pon_ports || [{ port_number: 1, output_power: 7.0 }]);
        setServerLinksModal(true);
      }
    } catch (e: any) {
      alert('Error loading server links: ' + e.message);
    }
  };

  const handleSaveServerLinks = async () => {
    if (!serverNodeId) return;
    setServerSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/map/items/${serverNodeId}/server-links`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          isp_link: ispLink,
          mikrotik_device_id: mikrotikDevId,
          olt_link: oltLink,
          pon_ports: serverPonPorts
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✓ Server links berhasil disimpan');
        setServerLinksModal(false);
        loadData();
      } else {
        alert('Gagal: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error saving server links: ' + e.message);
    }
    setServerSaving(false);
  };


  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ri, rc] = await Promise.all([
        fetch(`${BACKEND_URL}/api/map/items`, { headers }),
        fetch(`${BACKEND_URL}/api/map/connections`, { headers }),
      ]);
      const [di, dc] = await Promise.all([ri.json(), rc.json()]);
      setItems(Array.isArray(di) ? di : []);
      setConnections(Array.isArray(dc) ? dc : []);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMapClick = (lat: number, lng: number) => {
    if (panelMode === 'add-node' && clickingMap) {
      setNewLat(lat.toFixed(6));
      setNewLng(lng.toFixed(6));
      setClickingMap(false);
    }
  };

  useEffect(() => {
    if (panelMode === 'add-node' && newType === 'onu') {
      fetch(`${BACKEND_URL}/api/map/available-onus`, { headers })
        .then(r => r.json())
        .then(d => { if (d.success) setAvailableOnus(d.available); })
        .catch(console.error);
    }
  }, [panelMode, newType, token]);

  const handleDragEnd = async (id: number, e: L.DragEndEvent) => {
    const latlng = e.target.getLatLng();
    try {
      await fetch(`${BACKEND_URL}/api/map/items/${id}/position`, {
        method: 'PUT', headers,
        body: JSON.stringify({ latitude: latlng.lat, longitude: latlng.lng })
      });
      // Silent update on client side
      setItems(items => items.map(i => i.id === id ? { ...i, latitude: latlng.lat, longitude: latlng.lng } : i));
    } catch {}
  };

  const handleAddNode = async () => {
    if (!newName.trim() || !newLat || !newLng) {
      setSaveMsg('Nama, latitude, dan longitude wajib diisi'); setSaveMsgOk(false); return;
    }
    setSaving(true); setSaveMsg('');
    try {
      let properties: any = {};
      if (newType === 'odp') properties.splitter_ratio = odpRatio;
      if (newType === 'olt' || newType === 'server') properties.output_power = parseFloat(oltPower);

      const res = await fetch(`${BACKEND_URL}/api/map/items`, {
        method: 'POST', headers,
        body: JSON.stringify({ 
          item_type: newType, 
          name: newName.trim(), 
          latitude: parseFloat(newLat), 
          longitude: parseFloat(newLng), 
          status: 'unknown',
          genieacs_device_id: newType === 'onu' ? selectedOnu : null,
          properties 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg('✓ Node berhasil ditambahkan'); setSaveMsgOk(true);
        setNewName(''); setNewLat(''); setNewLng('');
        await loadData();
      } else {
        setSaveMsg(data.error || 'Gagal menambahkan node'); setSaveMsgOk(false);
      }
    } catch { setSaveMsg('Error koneksi'); setSaveMsgOk(false); }
    setSaving(false);
  };

  const handleDeleteNode = async (id: number) => {
    if (!window.confirm('Hapus node ini? Koneksi terkait juga akan dihapus.')) return;
    try {
      await fetch(`${BACKEND_URL}/api/map/items/${id}`, { method: 'DELETE', headers });
      await loadData();
    } catch {}
  };

  const handleAddConn = async () => {
    if (!connFrom || !connTo || connFrom === connTo) {
      setConnMsg('Pilih node FROM dan TO yang berbeda'); setConnMsgOk(false); return;
    }
    setConnSaving(true); setConnMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/map/connections`, {
        method: 'POST', headers,
        body: JSON.stringify({ from_item_id: parseInt(connFrom), to_item_id: parseInt(connTo), connection_type: connType })
      });
      const data = await res.json();
      if (res.ok) {
        setConnMsg('✓ Koneksi ditambahkan'); setConnMsgOk(true);
        setConnFrom(''); setConnTo('');
        await loadData();
      } else { setConnMsg(data.error || 'Gagal'); setConnMsgOk(false); }
    } catch { setConnMsg('Error koneksi'); setConnMsgOk(false); }
    setConnSaving(false);
  };

  const handleDeleteConn = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/map/connections/${id}`, { method: 'DELETE', headers });
      await loadData();
    } catch {}
  };

  const polylines = connections.map(c => {
    const from = items.find(i => i.id === c.from_item_id);
    const to = items.find(i => i.id === c.to_item_id);
    if (!from || !to) return null;
    let positions: [number, number][] = [[from.latitude, from.longitude], [to.latitude, to.longitude]];
    if (c.path_coordinates) {
      try { positions = JSON.parse(c.path_coordinates); } catch {}
    }
    return { id: c.id, positions, color: CONN_COLORS[c.connection_type], type: c.connection_type, from: from.name, to: to.name };
  }).filter(Boolean) as { id: number; positions: [number, number][]; color: string; type: string; from: string; to: string }[];

  const center: [number, number] = items.length > 0
    ? [items.reduce((a, b) => a + b.latitude, 0) / items.length, items.reduce((a, b) => a + b.longitude, 0) / items.length]
    : [-8.2, 114.3];

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
    borderRadius: '7px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', width: '100%', outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>🗺️ Peta Topologi PON</h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            {items.length} node · {connections.length} koneksi
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => { setOdpManagerModal(true); handleFetchOdpPorts(); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            <Share2 size={13} /> ODP Port Manager
          </button>
          <button onClick={() => setPanelMode(panelMode === 'add-node' ? 'none' : 'add-node')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: panelMode === 'add-node' ? 'linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))' : 'rgba(255,255,255,0.05)',
            border: panelMode === 'add-node' ? 'none' : '1px solid var(--border-color)',
            borderRadius: '8px', color: panelMode === 'add-node' ? '#fff' : 'var(--text-secondary)',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            <Plus size={13} /> Tambah Node
          </button>
          <button onClick={() => setPanelMode(panelMode === 'add-conn' ? 'none' : 'add-conn')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: panelMode === 'add-conn' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
            border: panelMode === 'add-conn' ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border-color)',
            borderRadius: '8px', color: panelMode === 'add-conn' ? '#22c55e' : 'var(--text-secondary)',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            <Link size={13} /> Tambah Koneksi
          </button>
          <button onClick={loadData} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
            borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer'
          }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: panelMode !== 'none' ? '1fr 320px' : '1fr', gap: '16px', flex: 1 }}>
        <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)', minHeight: '540px', position: 'relative' }}>
          <button onClick={async () => {
            const btn = document.getElementById('btn-recalc');
            if (btn) btn.innerHTML = 'Recalculating...';
            try {
              await fetch(`${BACKEND_URL}/api/map/recalculate`, { method: 'POST', headers });
              await loadData();
            } finally {
              if (btn) btn.innerHTML = 'Recalculate Power';
            }
          }} id="btn-recalc" style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            background: 'var(--accent-primary)', color: '#fff', border: 'none',
            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}>
            Recalculate Power
          </button>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}>
              Memuat peta...
            </div>
          ) : (
            <MapContainer center={center} zoom={14} style={{ height: '100%', minHeight: '540px' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickCapture onMapClick={handleMapClick} />

              {polylines.map(p => (
                <Polyline key={p.id} positions={p.positions} color={p.color} weight={2.5} dashArray={p.type === 'offline' ? '6 4' : undefined}>
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
                      <strong>{p.from} → {p.to}</strong><br />
                      Status: <b style={{ color: p.color }}>{p.type}</b><br />
                      <button onClick={() => handleDeleteConn(p.id)}
                        style={{ marginTop: '6px', padding: '3px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        Hapus Koneksi
                      </button>
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {items.map(item => {
                let props = {} as any;
                try { if (item.properties) props = JSON.parse(item.properties); } catch {}
                
                return (
                  <Marker key={item.id} position={[item.latitude, item.longitude]} icon={buildIcon(item.item_type, item.status)} draggable={true} eventHandlers={{ dragend: (e) => handleDragEnd(item.id, e) }}>
                    <Popup>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', minWidth: '160px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>{item.name}</div>
                        <div style={{ color: '#666', marginBottom: '2px' }}>Tipe: {ICONS[item.item_type].label}</div>
                        <div style={{ marginBottom: '2px' }}>
                          Status: <span style={{ fontWeight: 700, color: STATUS_COLORS[item.status] }}>{item.status}</span>
                        </div>
                        {props.calculated_rx_power && (
                          <div style={{ marginBottom: '2px', color: '#0284c7' }}>
                            Rx Power: <b>{props.calculated_rx_power} dBm</b>
                          </div>
                        )}
                        <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>
                          {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {item.item_type === 'server' && (
                            <button onClick={() => handleOpenServerLinks(item.id)}
                              style={{ padding: '4px 10px', background: '#38bdf8', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                              Server Links
                            </button>
                          )}
                          <button onClick={() => handleDeleteNode(item.id)}
                            style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
                            Hapus
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {panelMode !== 'none' && (
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                {panelMode === 'add-node' ? '➕ Tambah Node' : '🔗 Tambah Koneksi'}
              </h3>
              <button onClick={() => setPanelMode('none')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={16} />
              </button>
            </div>

            {panelMode === 'add-node' && (
              <>
                <div>
                  <label style={labelStyle}>Tipe Node</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={newType} onChange={e => setNewType(e.target.value as MapItem['item_type'])}>
                    {(Object.keys(ICONS) as MapItem['item_type'][]).map(k => (
                      <option key={k} value={k}>{ICONS[k].emoji} {ICONS[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nama Node</label>
                  <input style={inputStyle} placeholder="contoh: OLT-01, ODP-Perum-A" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                {newType === 'onu' && (
                  <div>
                    <label style={labelStyle}>Pilih Perangkat (GenieACS)</label>
                    <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedOnu} onChange={e => setSelectedOnu(e.target.value)}>
                      <option value="">-- Pilih Perangkat (Opsional) --</option>
                      {availableOnus.map(onu => (
                        <option key={onu._id} value={onu._id}>{onu.serialNumber}</option>
                      ))}
                    </select>
                  </div>
                )}
                {newType === 'odp' && (
                  <div>
                    <label style={labelStyle}>Splitter Ratio</label>
                    <select style={{ ...inputStyle, cursor: 'pointer' }} value={odpRatio} onChange={e => setOdpRatio(e.target.value)}>
                      {['1:2','1:4','1:8','1:16','1:32','1:64'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                {(newType === 'olt' || newType === 'server') && (
                  <div>
                    <label style={labelStyle}>Output Power (dBm)</label>
                    <input style={inputStyle} type="number" step="0.1" value={oltPower} onChange={e => setOltPower(e.target.value)} />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input style={inputStyle} type="number" step="any" placeholder="-8.xxx" value={newLat} onChange={e => setNewLat(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input style={inputStyle} type="number" step="any" placeholder="114.xxx" value={newLng} onChange={e => setNewLng(e.target.value)} />
                  </div>
                </div>
                <button
                  onClick={() => setClickingMap(!clickingMap)}
                  style={{
                    padding: '8px 12px', background: clickingMap ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border: clickingMap ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-color)',
                    borderRadius: '7px', color: clickingMap ? '#818cf8' : 'var(--text-secondary)',
                    fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <MapPin size={13} /> {clickingMap ? '⬆️ Klik di peta untuk pilih lokasi...' : 'Pilih Lokasi di Peta'}
                </button>

                {saveMsg && (
                  <div style={{ padding: '9px 13px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                    background: saveMsgOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: saveMsgOk ? '#22c55e' : '#ef4444',
                    border: `1px solid ${saveMsgOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                    {saveMsg}
                  </div>
                )}

                <button onClick={handleAddNode} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px',
                  background: 'linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))',
                  border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer'
                }}>
                  <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Node'}
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>LEGENDA</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(Object.keys(ICONS) as MapItem['item_type'][]).map(k => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span>{ICONS[k].emoji}</span>
                        <span style={{ color: ICONS[k].color, fontWeight: 600 }}>{ICONS[k].label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {panelMode === 'add-conn' && (
              <>
                <div>
                  <label style={labelStyle}>Dari Node (FROM)</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={connFrom} onChange={e => setConnFrom(e.target.value)}>
                    <option value="">-- Pilih Node --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{ICONS[i.item_type].emoji} {i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Ke Node (TO)</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={connTo} onChange={e => setConnTo(e.target.value)}>
                    <option value="">-- Pilih Node --</option>
                    {items.filter(i => i.id !== parseInt(connFrom)).map(i => <option key={i.id} value={i.id}>{ICONS[i.item_type].emoji} {i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status Koneksi</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={connType} onChange={e => setConnType(e.target.value as MapConnection['connection_type'])}>
                    <option value="online">🟢 Online</option>
                    <option value="offline">🔴 Offline</option>
                    <option value="unknown">⚪ Unknown</option>
                  </select>
                </div>

                {connMsg && (
                  <div style={{ padding: '9px 13px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                    background: connMsgOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: connMsgOk ? '#22c55e' : '#ef4444',
                    border: `1px solid ${connMsgOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                    {connMsg}
                  </div>
                )}

                <button onClick={handleAddConn} disabled={connSaving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px',
                  background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                  borderRadius: '8px', color: '#22c55e', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer'
                }}>
                  <Link size={14} /> {connSaving ? 'Menyimpan...' : 'Tambah Koneksi'}
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>KONEKSI AKTIF ({connections.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                    {connections.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>Belum ada koneksi</p>}
                    {connections.map(c => {
                      const from = items.find(i => i.id === c.from_item_id);
                      const to = items.find(i => i.id === c.to_item_id);
                      return (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            {from?.name ?? '?'} → {to?.name ?? '?'}
                          </span>
                          <button onClick={() => handleDeleteConn(c.id)} style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '5px',
                            padding: '3px 8px', color: '#ef4444', cursor: 'pointer', fontSize: '11px'
                          }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {/* GAP #3: ODP Port Manager Modal */}
      {odpManagerModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '720px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>ODP Port Manager & Power Recalculate</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Status port terpakai dan kalkulasi daya optik PON</p>
                </div>
              </div>
              <button onClick={handleRecalculatePower} disabled={recalcLoading} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12.5px' }}>
                {recalcLoading ? 'Recalculating...' : '⚡ Recalculate Power'}
              </button>
            </div>

            {recalcResult && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px' }}>
                ✓ Recalculate selesai: {recalcResult.total_updated} ODP diperbarui, {recalcResult.total_errors} error.
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {odpPortList.map((odp: any) => {
                const usedCount = odp.occupied_ports ? odp.occupied_ports.length : 0;
                const totalCount = odp.port_count || 8;
                const pct = Math.round((usedCount / totalCount) * 100);

                return (
                  <div key={odp.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent-primary)' }}>{odp.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e' }}>
                        {usedCount} / {totalCount} Ports Used ({pct}%)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {Array.from({ length: totalCount }, (_, i) => i + 1).map(portNum => {
                        const isUsed = odp.occupied_ports && odp.occupied_ports.includes(portNum);
                        return (
                          <div key={portNum} style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: isUsed ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                            color: isUsed ? '#ef4444' : '#22c55e',
                            border: `1px solid ${isUsed ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`
                          }}>
                            P{portNum} {isUsed ? '🔴' : '🟢'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setOdpManagerModal(false)} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAP #9: Server Links Edit Modal */}
      {serverLinksModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '520px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Plus size={18} style={{ color: '#38bdf8' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Edit Server Links Management</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>ISP Link Name / URL</label>
                <input style={inputStyle} value={ispLink} onChange={e => setIspLink(e.target.value)} placeholder="Contoh: Telkom Astinet 1Gbps" />
              </div>

              <div>
                <label style={labelStyle}>MikroTik Device ID</label>
                <input style={inputStyle} value={mikrotikDevId} onChange={e => setMikrotikDevId(e.target.value)} placeholder="Contoh: CCR1036-Core" />
              </div>

              <div>
                <label style={labelStyle}>OLT Link Name</label>
                <input style={inputStyle} value={oltLink} onChange={e => setOltLink(e.target.value)} placeholder="Contoh: OLT-ZTE-C320" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={labelStyle}>Server PON Ports Power Budget</label>
                  <button type="button" onClick={() => setServerPonPorts([...serverPonPorts, { port_number: serverPonPorts.length + 1, output_power: 7.0 }])} style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    + Tambah Port
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                  {serverPonPorts.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '60px' }}>Port #{p.port_number}</span>
                      <input style={inputStyle} type="number" step="0.1" value={p.output_power} onChange={e => {
                        const updated = [...serverPonPorts];
                        updated[idx].output_power = parseFloat(e.target.value) || 0;
                        setServerPonPorts(updated);
                      }} placeholder="dBm" />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>dBm</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={() => setServerLinksModal(false)} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Batal
                </button>
                <button onClick={handleSaveServerLinks} disabled={serverSaving} style={{ padding: '9px 18px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  {serverSaving ? 'Menyimpan...' : 'Simpan Links'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

