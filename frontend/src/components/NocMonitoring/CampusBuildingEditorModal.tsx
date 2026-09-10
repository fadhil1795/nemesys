import React, { useState, useRef } from 'react';
import { 
  X, 
  Building2, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  Layers, 
  Wifi, 
  Router, 
  Link2, 
  CheckCircle2,
  Crosshair
} from 'lucide-react';
import { BACKEND_URL } from '../../App';

interface CampusBuilding {
  id: string;
  name: string;
  code: string;
  category: 'datacenter' | 'faculty' | 'lab' | 'library' | 'dormitory' | 'canteen';
  status: 'healthy' | 'warning' | 'critical';
  x: number;
  y: number;
  floorsCount: number;
  totalClients: number;
  trafficInMbps: number;
  trafficOutMbps: number;
  pingMs: number;
  uplinkSpeed: string;
  uplinkType: '10G Fiber' | '1G SFP' | '1G UTP';
  description: string;
  switchesCount: number;
  apsCount: number;
  floors: Array<{
    floorId: number;
    floorNumber: number;
    floorName: string;
    switchName: string;
    switchIp?: string;
    switchStatus: 'healthy' | 'warning' | 'down';
    activePorts: number;
    totalPorts: number;
    accessPoints: Array<{
      apId: number;
      name: string;
      ip: string;
      channel: string;
      band: string;
      clients: number;
      status: 'healthy' | 'warning' | 'down';
    }>;
  }>;
}

interface FiberLink {
  id: number;
  fromBuildingId: string;
  toBuildingId: string;
  speed: string;
  status: 'healthy' | 'warning' | 'down';
}

interface Props {
  buildings: CampusBuilding[];
  fiberLinks: FiberLink[];
  onClose: () => void;
  onRefreshData: () => void;
  token?: string;
}

export const CampusBuildingEditorModal: React.FC<Props> = ({
  buildings,
  fiberLinks,
  onClose,
  onRefreshData,
  token,
}) => {
  const [activeTab, setActiveTab] = useState<'buildings' | 'floors' | 'links'>('buildings');
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Building Form State
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [bldgName, setBldgName] = useState('');
  const [bldgCode, setBldgCode] = useState('');
  const [bldgCategory, setBldgCategory] = useState<'datacenter' | 'faculty' | 'lab' | 'library' | 'dormitory' | 'canteen'>('faculty');
  const [bldgX, setBldgX] = useState<number>(50);
  const [bldgY, setBldgY] = useState<number>(50);
  const [bldgUplinkSpeed, setBldgUplinkSpeed] = useState('10G SFP+ Trunk');
  const [bldgUplinkType, setBldgUplinkType] = useState<'10G Fiber' | '1G SFP' | '1G UTP'>('10G Fiber');
  const [bldgDescription, setBldgDescription] = useState('');

  // Selected Building for Floors Management
  const [selectedBldgForFloor, setSelectedBldgForFloor] = useState<string>(buildings[0]?.id || '');
  const [newFloorNumber, setNewFloorNumber] = useState<number>(2);
  const [newFloorName, setNewFloorName] = useState('');
  const [newSwitchName, setNewSwitchName] = useState('');

  // AP Form State
  const [selectedFloorIdForAp, setSelectedFloorIdForAp] = useState<number | null>(null);
  const [newApName, setNewApName] = useState('');
  const [newApIp, setNewApIp] = useState('');
  const [newApChannel, setNewApChannel] = useState('Ch 36 (5GHz)');
  const [newApBand, setNewApBand] = useState('Wi-Fi 6 AX');

  // Fiber Link Form State
  const [linkFromId, setLinkFromId] = useState(buildings[0]?.id || '');
  const [linkToId, setLinkToId] = useState(buildings[1]?.id || '');
  const [linkSpeed, setLinkSpeed] = useState('10G FO');

  // Mini-Map Interactive Canvas Pinpoint State & Handlers
  const [isMiniDragging, setIsMiniDragging] = useState(false);
  const miniMapRef = useRef<HTMLDivElement>(null);

  const updateCoordinatesFromPointer = (clientX: number, clientY: number) => {
    if (!miniMapRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(8, Math.min(92, rawX)));
    const clampedY = Math.round(Math.max(8, Math.min(92, rawY)));
    setBldgX(clampedX);
    setBldgY(clampedY);
  };

  const handleMiniCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    updateCoordinatesFromPointer(e.clientX, e.clientY);
  };

  const handleMiniCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMiniDragging) return;
    updateCoordinatesFromPointer(e.clientX, e.clientY);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const resetBuildingForm = () => {
    setEditingBuildingId(null);
    setBldgName('');
    setBldgCode('');
    setBldgCategory('faculty');
    setBldgX(50);
    setBldgY(50);
    setBldgUplinkSpeed('10G SFP+ Trunk');
    setBldgUplinkType('10G Fiber');
    setBldgDescription('');
  };

  const handleEditBuilding = (b: CampusBuilding) => {
    setEditingBuildingId(b.id);
    setBldgName(b.name);
    setBldgCode(b.code);
    setBldgCategory(b.category);
    setBldgX(b.x);
    setBldgY(b.y);
    setBldgUplinkSpeed(b.uplinkSpeed);
    setBldgUplinkType(b.uplinkType);
    setBldgDescription(b.description || '');
  };

  // 1. SAVE / UPDATE BUILDING
  const handleSaveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldgName.trim() || !bldgCode.trim()) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (editingBuildingId) {
        // UPDATE
        const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/buildings/${editingBuildingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: bldgName,
            code: bldgCode,
            category: bldgCategory,
            x: bldgX,
            y: bldgY,
            uplinkSpeed: bldgUplinkSpeed,
            uplinkType: bldgUplinkType,
            description: bldgDescription,
          }),
        });
        if (res.ok) {
          showToast(`Gedung [${bldgName}] berhasil diperbarui!`);
          resetBuildingForm();
          onRefreshData();
        }
      } else {
        // CREATE
        const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/buildings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: bldgName,
            code: bldgCode,
            category: bldgCategory,
            x: bldgX,
            y: bldgY,
            uplinkSpeed: bldgUplinkSpeed,
            uplinkType: bldgUplinkType,
            description: bldgDescription,
          }),
        });
        if (res.ok) {
          showToast(`Gedung [${bldgName}] berhasil ditambahkan ke denah kampus!`);
          resetBuildingForm();
          onRefreshData();
        }
      }
    } catch (err) {
      console.error('Failed to save building:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. DELETE BUILDING
  const handleDeleteBuilding = async (id: string, name: string) => {
    if (!confirm(`Hapus gedung [${name}] beserta seluruh lantai dan perangkatnya?`)) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/buildings/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast(`Gedung [${name}] berhasil dihapus.`);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete building:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. ADD FLOOR
  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBldgForFloor || !newFloorName.trim()) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/buildings/${selectedBldgForFloor}/floors`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          floorNumber: newFloorNumber,
          floorName: newFloorName,
          switchName: newSwitchName || `SW-DISTRIB-LT${newFloorNumber}`,
        }),
      });

      if (res.ok) {
        showToast(`Lantai baru [${newFloorName}] berhasil ditambahkan!`);
        setNewFloorName('');
        setNewSwitchName('');
        setNewFloorNumber((prev) => prev + 1);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to add floor:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. DELETE FLOOR
  const handleDeleteFloor = async (floorId: number, floorName: string) => {
    if (!confirm(`Hapus lantai [${floorName}]?`)) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/floors/${floorId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast(`Lantai berhasil dihapus.`);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete floor:', err);
    } finally {
      setLoading(false);
    }
  };

  // 5. ADD ACCESS POINT
  const handleAddAp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloorIdForAp || !newApName.trim() || !newApIp.trim()) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/floors/${selectedFloorIdForAp}/aps`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          buildingId: selectedBldgForFloor,
          name: newApName,
          ip: newApIp,
          channel: newApChannel,
          band: newApBand,
          clientsCount: 20,
          status: 'healthy',
        }),
      });

      if (res.ok) {
        showToast(`Access Point [${newApName}] berhasil ditambahkan!`);
        setNewApName('');
        setNewApIp('');
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to add AP:', err);
    } finally {
      setLoading(false);
    }
  };

  // 6. DELETE AP
  const handleDeleteAp = async (apId: number, name: string) => {
    if (!confirm(`Hapus Access Point [${name}]?`)) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/aps/${apId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast(`AP [${name}] berhasil dihapus.`);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete AP:', err);
    } finally {
      setLoading(false);
    }
  };

  // 7. SAVE FIBER LINK
  const handleSaveFiberLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkFromId || !linkToId || linkFromId === linkToId) {
      alert('Pilih dua gedung yang berbeda untuk menghubungkan kabel FO.');
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/fiber-links`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fromBuildingId: linkFromId,
          toBuildingId: linkToId,
          speed: linkSpeed,
          status: 'healthy',
        }),
      });

      if (res.ok) {
        showToast('Jalur kabel optik antar-gedung berhasil ditambahkan!');
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to save fiber link:', err);
    } finally {
      setLoading(false);
    }
  };

  // 8. DELETE FIBER LINK
  const handleDeleteFiberLink = async (linkId: number) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/fiber-links/${linkId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast('Jalur kabel optik berhasil dihapus.');
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete fiber link:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeBuildingForFloor = buildings.find((b) => b.id === selectedBldgForFloor) || buildings[0];

  return (
    <div className="noc-modal-backdrop" onClick={onClose}>
      <div className="campus-editor-dialog glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="editor-modal-header">
          <div className="header-titles">
            <Building2 size={22} className="text-cyan-400" />
            <div>
              <h3>Kelola Infrastruktur Gedung Kampus & Jalur FO</h3>
              <span className="text-xs text-slate-400">Atur denah gedung, posisi koordinat, switch, AP, dan kabel FO</span>
            </div>
          </div>

          <button className="detail-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* TOAST ALERT */}
        {toastMsg && (
          <div className="noc-floating-toast">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* SUB-TABS */}
        <div className="editor-sub-tabs">
          <button
            className={`editor-tab-btn ${activeTab === 'buildings' ? 'active' : ''}`}
            onClick={() => setActiveTab('buildings')}
          >
            <Building2 size={16} />
            <span>1. Gedung & Posisi Peta ({buildings.length})</span>
          </button>
          <button
            className={`editor-tab-btn ${activeTab === 'floors' ? 'active' : ''}`}
            onClick={() => setActiveTab('floors')}
          >
            <Layers size={16} />
            <span>2. Lantai, Switch & Access Point</span>
          </button>
          <button
            className={`editor-tab-btn ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
          >
            <Link2 size={16} />
            <span>3. Jalur Kabel FO Antar-Gedung ({fiberLinks.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="editor-modal-body">
          {/* ========================================================= */}
          {/* TAB 1: BUILDINGS & POSITIONING */}
          {/* ========================================================= */}
          {activeTab === 'buildings' && (
            <div className="editor-tab-content">
              {/* Form Input / Edit Building */}
              <form onSubmit={handleSaveBuilding} className="editor-form-card glass-panel">
                <div className="form-card-title">
                  {editingBuildingId ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <Edit2 size={16} />
                      <span>Edit Gedung: {bldgName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Plus size={16} />
                      <span>Tambah Gedung Baru ke Kampus</span>
                    </div>
                  )}
                </div>

                <div className="form-grid-2col">
                  <div className="form-field">
                    <label>Nama Gedung Kampus *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Gedung Fakultas Teknik"
                      value={bldgName}
                      onChange={(e) => setBldgName(e.target.value)}
                      required
                      className="noc-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Kode Gedung *</label>
                    <input
                      type="text"
                      placeholder="Contoh: GDG-FT"
                      value={bldgCode}
                      onChange={(e) => setBldgCode(e.target.value)}
                      required
                      className="noc-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Kategori Gedung</label>
                    <select
                      value={bldgCategory}
                      onChange={(e) => setBldgCategory(e.target.value as any)}
                      className="noc-select"
                    >
                      <option value="faculty">Gedung Kuliah / Fakultas</option>
                      <option value="lab">Lab Komputer / Multimedia</option>
                      <option value="library">Perpustakaan</option>
                      <option value="dormitory">Asrama Mahasiswa</option>
                      <option value="datacenter">Server Room / NOC</option>
                      <option value="canteen">Kantin & Student Center</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Kecepatan Uplink Fiber Optic</label>
                    <select
                      value={bldgUplinkSpeed}
                      onChange={(e) => setBldgUplinkSpeed(e.target.value)}
                      className="noc-select"
                    >
                      <option value="10G SFP+ Trunk">10G SFP+ Trunk (Kapasitas Tinggi)</option>
                      <option value="1G SFP Direct Fiber">1G SFP Direct FO</option>
                      <option value="2x 10G LACP Trunk">2x 10G LACP Core Trunk</option>
                      <option value="1G UTP Cat6">1G UTP Cat6 Shielded</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Visual Mini Canvas Pinpoint & Sliders */}
                <div className="coordinates-picker-wrap">
                  <div className="mini-picker-header">
                    <div className="flex items-center gap-2">
                      <Crosshair size={14} className="text-cyan-400 animate-pulse" />
                      <span className="font-semibold text-slate-200 text-xs">
                        Interactive Visual Canvas Pinpoint:
                      </span>
                    </div>
                    <span className="text-[11px] text-cyan-300/80 font-mono">
                      X: <strong>{bldgX}%</strong> | Y: <strong>{bldgY}%</strong>
                    </span>
                  </div>

                  {/* Interactive Mini Map Box */}
                  <div
                    ref={miniMapRef}
                    className="mini-campus-canvas"
                    onClick={handleMiniCanvasClick}
                    onMouseDown={() => setIsMiniDragging(true)}
                    onMouseUp={() => setIsMiniDragging(false)}
                    onMouseLeave={() => setIsMiniDragging(false)}
                    onMouseMove={handleMiniCanvasMouseMove}
                    title="Klik atau geser pin di atas kanvas untuk memposisikan gedung"
                  >
                    <div className="mini-grid-bg"></div>

                    {/* Ghost markers for other buildings */}
                    {buildings
                      .filter((b) => b.id !== editingBuildingId)
                      .map((b) => (
                        <div
                          key={b.id}
                          className="mini-ghost-bldg"
                          style={{ left: `${b.x}%`, top: `${b.y}%` }}
                          title={`Gedung lain: ${b.code} (${b.name})`}
                        >
                          <span className="mini-ghost-dot"></span>
                          <span className="mini-ghost-label">{b.code}</span>
                        </div>
                      ))}

                    {/* Active Draggable Pin Target */}
                    <div
                      className="mini-active-pin"
                      style={{ left: `${bldgX}%`, top: `${bldgY}%` }}
                    >
                      <div className="pin-pulse-ring"></div>
                      <div className="pin-center-dot">
                        <Building2 size={12} className="text-cyan-200" />
                      </div>
                      <div className="pin-coord-tag">
                        {bldgCode || 'Gedung Baru'} ({bldgX}%, {bldgY}%)
                      </div>
                    </div>

                    <div className="mini-canvas-hint">
                      <Crosshair size={11} /> Klik / seret pada kanvas denah ini
                    </div>
                  </div>

                  {/* Fine-Tuning Sliders */}
                  <div className="sliders-row mt-2">
                    <div className="slider-group">
                      <span>Posisi Horizontal (X): <strong>{bldgX}%</strong></span>
                      <input
                        type="range"
                        min="8"
                        max="92"
                        value={bldgX}
                        onChange={(e) => setBldgX(Number(e.target.value))}
                        className="noc-slider"
                      />
                    </div>

                    <div className="slider-group">
                      <span>Posisi Vertikal (Y): <strong>{bldgY}%</strong></span>
                      <input
                        type="range"
                        min="8"
                        max="92"
                        value={bldgY}
                        onChange={(e) => setBldgY(Number(e.target.value))}
                        className="noc-slider"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-field mt-3">
                  <label>Keterangan / Ruangan di Gedung Ini</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ruang Dekanat, Ruang Kuliah 101-308, Ruang Dosen"
                    value={bldgDescription}
                    onChange={(e) => setBldgDescription(e.target.value)}
                    className="noc-input"
                  />
                </div>

                <div className="form-actions-row">
                  {editingBuildingId && (
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={resetBuildingForm}
                    >
                      Batal Edit
                    </button>
                  )}
                  <button type="submit" className="btn-submit" disabled={loading}>
                    <Save size={16} />
                    <span>{editingBuildingId ? 'Simpan Perubahan' : 'Tambah Gedung ke Denah'}</span>
                  </button>
                </div>
              </form>

              {/* Buildings List Table */}
              <div className="buildings-table-card glass-panel mt-3">
                <div className="table-title">Daftar Gedung Kampus ({buildings.length} Gedung)</div>
                <div className="table-responsive">
                  <table className="noc-table">
                    <thead>
                      <tr>
                        <th>Kode & Nama Gedung</th>
                        <th>Kategori</th>
                        <th>Posisi Peta</th>
                        <th>Lantai</th>
                        <th>Uplink</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildings.map((b) => (
                        <tr key={b.id} className={editingBuildingId === b.id ? 'active-row' : ''}>
                          <td>
                            <strong>{b.code}</strong>
                            <div className="text-xs text-slate-400">{b.name}</div>
                          </td>
                          <td>
                            <span className="category-tag">{b.category}</span>
                          </td>
                          <td className="font-mono text-xs">
                            X: {b.x}% | Y: {b.y}%
                          </td>
                          <td>{b.floorsCount} Lantai ({b.apsCount} AP)</td>
                          <td className="text-xs text-cyan-400">{b.uplinkSpeed}</td>
                          <td>
                            <div className="action-btns-wrap">
                              <button
                                className="icon-btn edit"
                                onClick={() => handleEditBuilding(b)}
                                title="Edit Gedung"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="icon-btn delete"
                                onClick={() => handleDeleteBuilding(b.id, b.name)}
                                title="Hapus Gedung"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: FLOORS & ACCESS POINTS */}
          {/* ========================================================= */}
          {activeTab === 'floors' && (
            <div className="editor-tab-content">
              {/* Building Selector */}
              <div className="bldg-selector-card glass-panel">
                <label className="font-semibold text-slate-200">Pilih Gedung yang Ingin Dikelola:</label>
                <select
                  value={selectedBldgForFloor}
                  onChange={(e) => {
                    setSelectedBldgForFloor(e.target.value);
                    setSelectedFloorIdForAp(null);
                  }}
                  className="noc-select mt-1"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name} ({b.floorsCount} Lantai)
                    </option>
                  ))}
                </select>
              </div>

              {activeBuildingForFloor && (
                <div className="floors-management-grid mt-3">
                  {/* Left: Add Floor Form */}
                  <form onSubmit={handleAddFloor} className="form-card-mini glass-panel">
                    <div className="mini-card-title">
                      <Plus size={14} className="text-cyan-400" />
                      <span>Tambah Lantai Baru</span>
                    </div>

                    <div className="form-field">
                      <label>Nomor Lantai</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={newFloorNumber}
                        onChange={(e) => setNewFloorNumber(Number(e.target.value))}
                        className="noc-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Nama Lantai / Ruangan *</label>
                      <input
                        type="text"
                        placeholder="Contoh: Lantai 2 - Ruang Kuliah 201-206"
                        value={newFloorName}
                        onChange={(e) => setNewFloorName(e.target.value)}
                        required
                        className="noc-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Nama Switch Distribusi</label>
                      <input
                        type="text"
                        placeholder="Contoh: SW-DISTRIB-LT2"
                        value={newSwitchName}
                        onChange={(e) => setNewSwitchName(e.target.value)}
                        className="noc-input"
                      />
                    </div>

                    <button type="submit" className="btn-submit btn-sm mt-2" disabled={loading}>
                      <Plus size={14} />
                      <span>Tambah Lantai</span>
                    </button>
                  </form>

                  {/* Right: Existing Floors and APs */}
                  <div className="existing-floors-list">
                    {activeBuildingForFloor.floors.map((fl) => (
                      <div key={fl.floorId} className="floor-card-item glass-panel">
                        <div className="floor-item-top">
                          <div>
                            <strong>Lantai {fl.floorNumber}: {fl.floorName}</strong>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <Router size={13} className="text-emerald-400" />
                              <span>{fl.switchName}</span>
                            </div>
                          </div>

                          <button
                            className="icon-btn delete"
                            onClick={() => handleDeleteFloor(fl.floorId, fl.floorName)}
                            title="Hapus Lantai Ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Access Points on this Floor */}
                        <div className="floor-aps-sublist">
                          <div className="sublist-title">Access Point Terpasang:</div>
                          {fl.accessPoints.map((ap) => (
                            <div key={ap.apId} className="ap-chip-item">
                              <div className="flex items-center gap-2">
                                <Wifi size={13} className="text-cyan-400" />
                                <span className="font-semibold text-slate-200">{ap.name}</span>
                                <code className="text-xs text-slate-400">{ap.ip}</code>
                              </div>

                              <button
                                className="icon-btn delete-mini"
                                onClick={() => handleDeleteAp(ap.apId, ap.name)}
                                title="Hapus AP"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}

                          {/* Quick Add AP Form for this Floor */}
                          {selectedFloorIdForAp === fl.floorId ? (
                            <form onSubmit={handleAddAp} className="add-ap-inline-form">
                              <div className="inline-grid">
                                <input
                                  type="text"
                                  placeholder="Nama AP (e.g. AP-KELAS-201)"
                                  value={newApName}
                                  onChange={(e) => setNewApName(e.target.value)}
                                  required
                                  className="noc-input input-sm"
                                />
                                <input
                                  type="text"
                                  placeholder="IP Address (e.g. 192.168.50.25)"
                                  value={newApIp}
                                  onChange={(e) => setNewApIp(e.target.value)}
                                  required
                                  className="noc-input input-sm"
                                />
                              </div>
                              <div className="inline-grid mt-2">
                                <select
                                  value={newApChannel}
                                  onChange={(e) => setNewApChannel(e.target.value)}
                                  className="noc-select input-sm"
                                >
                                  <option value="Ch 36 (5GHz)">Ch 36 (5GHz)</option>
                                  <option value="Ch 44 (5GHz)">Ch 44 (5GHz)</option>
                                  <option value="Ch 149 (5GHz)">Ch 149 (5GHz)</option>
                                  <option value="Ch 1 (2.4GHz)">Ch 1 (2.4GHz)</option>
                                  <option value="Ch 6 (2.4GHz)">Ch 6 (2.4GHz)</option>
                                  <option value="Ch 11 (2.4GHz)">Ch 11 (2.4GHz)</option>
                                </select>
                                <select
                                  value={newApBand}
                                  onChange={(e) => setNewApBand(e.target.value)}
                                  className="noc-select input-sm"
                                >
                                  <option value="Wi-Fi 6 AX">Wi-Fi 6 AX</option>
                                  <option value="Wi-Fi 6 HD">Wi-Fi 6 HD (High Density)</option>
                                  <option value="Wi-Fi 6 Outdoor HD">Wi-Fi 6 Outdoor HD</option>
                                  <option value="Wi-Fi 5 AC Wave 2">Wi-Fi 5 AC Wave 2</option>
                                </select>
                              </div>
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  type="button"
                                  className="btn-cancel btn-sm"
                                  onClick={() => setSelectedFloorIdForAp(null)}
                                >
                                  Batal
                                </button>
                                <button type="submit" className="btn-submit btn-sm" disabled={loading}>
                                  <Save size={13} /> Simpan AP
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="btn-add-ap-trigger"
                              onClick={() => {
                                setSelectedFloorIdForAp(fl.floorId);
                                setNewApName(`AP-${activeBuildingForFloor.code}-LT${fl.floorNumber}-0${fl.accessPoints.length + 1}`);
                                setNewApIp(`192.168.50.${50 + fl.floorNumber * 10 + fl.accessPoints.length}`);
                              }}
                            >
                              <Plus size={13} /> Tambah Access Point ke Lantai Ini
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: FIBER OPTIC LINKS */}
          {/* ========================================================= */}
          {activeTab === 'links' && (
            <div className="editor-tab-content">
              {/* Form Add Fiber Link */}
              <form onSubmit={handleSaveFiberLink} className="editor-form-card glass-panel">
                <div className="form-card-title">
                  <Link2 size={16} className="text-cyan-400" />
                  <span>Hubungkan Jalur Kabel Optik Antar-Gedung</span>
                </div>

                <div className="form-grid-3col">
                  <div className="form-field">
                    <label>Gedung Asal (Dari) *</label>
                    <select
                      value={linkFromId}
                      onChange={(e) => setLinkFromId(e.target.value)}
                      className="noc-select"
                    >
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Gedung Tujuan (Ke) *</label>
                    <select
                      value={linkToId}
                      onChange={(e) => setLinkToId(e.target.value)}
                      className="noc-select"
                    >
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Kapasitas Link</label>
                    <select
                      value={linkSpeed}
                      onChange={(e) => setLinkSpeed(e.target.value)}
                      className="noc-select"
                    >
                      <option value="10G FO">10G FO (Kabel Optik 10 Gbps)</option>
                      <option value="1G FO">1G SFP (Kabel Optik 1 Gbps)</option>
                      <option value="1G FO Ring Backup">1G FO Ring Backup</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions-row">
                  <button type="submit" className="btn-submit" disabled={loading}>
                    <Plus size={16} />
                    <span>Hubungkan Jalur FO</span>
                  </button>
                </div>
              </form>

              {/* Existing Fiber Links List */}
              <div className="buildings-table-card glass-panel mt-3">
                <div className="table-title">Jalur Kabel Fiber Optic Aktif ({fiberLinks.length} Rute)</div>
                <div className="table-responsive">
                  <table className="noc-table">
                    <thead>
                      <tr>
                        <th>Gedung Asal</th>
                        <th>Gedung Tujuan</th>
                        <th>Kapasitas Link</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiberLinks.map((link) => {
                        const b1 = buildings.find((b) => b.id === link.fromBuildingId);
                        const b2 = buildings.find((b) => b.id === link.toBuildingId);

                        return (
                          <tr key={link.id}>
                            <td>
                              <strong>{b1?.code || link.fromBuildingId}</strong>
                              <div className="text-xs text-slate-400">{b1?.name}</div>
                            </td>
                            <td>
                              <strong>{b2?.code || link.toBuildingId}</strong>
                              <div className="text-xs text-slate-400">{b2?.name}</div>
                            </td>
                            <td>
                              <span className="text-cyan-400 font-bold">{link.speed}</span>
                            </td>
                            <td>
                              <span className="badge-status-healthy">HEALTHY</span>
                            </td>
                            <td>
                              <button
                                className="icon-btn delete"
                                onClick={() => handleDeleteFiberLink(link.id)}
                                title="Hapus Jalur Kabel FO"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
