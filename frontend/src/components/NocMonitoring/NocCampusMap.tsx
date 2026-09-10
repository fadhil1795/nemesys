import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Server, 
  Wifi, 
  Router, 
  Users, 
  ArrowDownRight, 
  CheckCircle2, 
  Layers, 
  Search, 
  Zap, 
  Cpu, 
  Terminal, 
  Radio, 
  Settings2, 
  RefreshCw, 
  Move, 
  Save, 
  RotateCcw 
} from 'lucide-react';
import type { NocDevice } from '../../types/noc';
import { BACKEND_URL } from '../../App';
import { CampusBuildingEditorModal } from './CampusBuildingEditorModal';

export interface CampusBuilding {
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

export interface FiberLink {
  id: number;
  fromBuildingId: string;
  toBuildingId: string;
  speed: string;
  status: 'healthy' | 'warning' | 'down';
}

interface Props {
  devices?: NocDevice[];
  onSelectDevice?: (dev: NocDevice) => void;
  onOpenDiagnostics?: (targetIp: string) => void;
  token?: string;
}

const DEFAULT_BUILDINGS: CampusBuilding[] = [
  {
    id: 'bldg-noc',
    name: 'Server Room & NOC HQ',
    code: 'NOC-HQ',
    category: 'datacenter',
    status: 'healthy',
    x: 20,
    y: 35,
    floorsCount: 2,
    totalClients: 35,
    trafficInMbps: 920,
    trafficOutMbps: 740,
    pingMs: 0.4,
    uplinkSpeed: '2x 10G LACP Trunk',
    uplinkType: '10G Fiber',
    description: 'Core Gateway MikroTik CCR2116, OLT GPON, ISP Uplink Transit & Server Farm',
    switchesCount: 4,
    apsCount: 2,
    floors: [
      {
        floorId: 1,
        floorNumber: 1,
        floorName: 'Lantai 1 - Main Server Room & NOC Operations',
        switchName: 'SW-CORE-NOC-01 (48-Port 10G)',
        switchStatus: 'healthy',
        activePorts: 42,
        totalPorts: 48,
        accessPoints: [
          { apId: 1, name: 'AP-NOC-ROOM-01', ip: '192.168.50.10', channel: 'Ch 36 (5GHz)', band: 'Wi-Fi 6 AX', clients: 18, status: 'healthy' },
          { apId: 2, name: 'AP-RUANG-OPERATOR', ip: '192.168.50.11', channel: 'Ch 1 (2.4GHz)', band: 'Wi-Fi 6 AX', clients: 17, status: 'healthy' },
        ],
      },
    ],
  },
  {
    id: 'bldg-fac-a',
    name: 'Gedung Kuliah A (Rektorat & Kelas)',
    code: 'GDG-A',
    category: 'faculty',
    status: 'healthy',
    x: 48,
    y: 20,
    floorsCount: 3,
    totalClients: 128,
    trafficInMbps: 145,
    trafficOutMbps: 38,
    pingMs: 0.9,
    uplinkSpeed: '10G SFP+ Trunk',
    uplinkType: '10G Fiber',
    description: 'Ruang Rektorat, Ruang Dekanat, Ruang Dosen & Ruang Kelas Teori 101 - 308',
    switchesCount: 3,
    apsCount: 5,
    floors: [
      {
        floorId: 2,
        floorNumber: 1,
        floorName: 'Lantai 1 - Ruang Dekanat & Tata Usaha',
        switchName: 'SW-DISTRIB-GDGA-LT1 (24-Port)',
        switchStatus: 'healthy',
        activePorts: 19,
        totalPorts: 24,
        accessPoints: [
          { apId: 3, name: 'AP-REKTORAT-LOBBY', ip: '192.168.50.21', channel: 'Ch 44 (5GHz)', band: 'Wi-Fi 6', clients: 24, status: 'healthy' },
          { apId: 4, name: 'AP-RUANG-DEKANAT', ip: '192.168.50.22', channel: 'Ch 6 (2.4GHz)', band: 'Wi-Fi 6', clients: 16, status: 'healthy' },
        ],
      },
      {
        floorId: 3,
        floorNumber: 2,
        floorName: 'Lantai 2 - Ruang Kelas Teori 201 - 206',
        switchName: 'SW-DISTRIB-GDGA-LT2 (24-Port)',
        switchStatus: 'healthy',
        activePorts: 22,
        totalPorts: 24,
        accessPoints: [
          { apId: 5, name: 'AP-KELAS-201-203', ip: '192.168.50.23', channel: 'Ch 149 (5GHz)', band: 'Wi-Fi 6', clients: 38, status: 'healthy' },
          { apId: 6, name: 'AP-KELAS-204-206', ip: '192.168.50.24', channel: 'Ch 11 (2.4GHz)', band: 'Wi-Fi 6', clients: 26, status: 'healthy' },
        ],
      },
    ],
  },
  {
    id: 'bldg-lab',
    name: 'Gedung Kuliah & Lab Komputer B',
    code: 'GDG-B-LAB',
    category: 'lab',
    status: 'healthy',
    x: 80,
    y: 28,
    floorsCount: 3,
    totalClients: 164,
    trafficInMbps: 285,
    trafficOutMbps: 84,
    pingMs: 1.1,
    uplinkSpeed: '10G SFP+ Trunk',
    uplinkType: '10G Fiber',
    description: 'Lab Komputer Jaringan, Lab Multimedia, Server Ujian CBT, & Ruang Kuliah',
    switchesCount: 5,
    apsCount: 5,
    floors: [
      {
        floorId: 5,
        floorNumber: 1,
        floorName: 'Lantai 1 - Lab Jaringan & Sistem Informasi',
        switchName: 'SW-LAB-KOMP-LT1 (48-Port GbE)',
        switchStatus: 'healthy',
        activePorts: 44,
        totalPorts: 48,
        accessPoints: [
          { apId: 8, name: 'AP-LAB-KOMP-01', ip: '192.168.50.31', channel: 'Ch 36 (5GHz)', band: 'Wi-Fi 6 AX', clients: 42, status: 'healthy' },
          { apId: 9, name: 'AP-LAB-KOMP-02', ip: '192.168.50.32', channel: 'Ch 1 (2.4GHz)', band: 'Wi-Fi 6 AX', clients: 36, status: 'healthy' },
        ],
      },
      {
        floorId: 6,
        floorNumber: 2,
        floorName: 'Lantai 2 - Lab Multimedia & Server CBT',
        switchName: 'SW-LAB-KOMP-LT2 (48-Port GbE)',
        switchStatus: 'healthy',
        activePorts: 40,
        totalPorts: 48,
        accessPoints: [
          { apId: 10, name: 'AP-LAB-MULTIMEDIA', ip: '192.168.50.33', channel: 'Ch 149 (5GHz)', band: 'Wi-Fi 6 HD', clients: 48, status: 'healthy' },
          { apId: 11, name: 'AP-RUANG-SERVER-CBT', ip: '192.168.50.34', channel: 'Ch 6 (2.4GHz)', band: 'Wi-Fi 6', clients: 12, status: 'healthy' },
        ],
      },
    ],
  },
  {
    id: 'bldg-lib',
    name: 'Perpustakaan Pusat (Central Library)',
    code: 'LIB-PUSAT',
    category: 'library',
    status: 'healthy',
    x: 52,
    y: 52,
    floorsCount: 2,
    totalClients: 76,
    trafficInMbps: 95,
    trafficOutMbps: 22,
    pingMs: 0.8,
    uplinkSpeed: '1G SFP Direct Fiber',
    uplinkType: '1G SFP',
    description: 'Area Belajar Mandiri, Digital Library, E-Resource Center, & Ruang Diskusi',
    switchesCount: 2,
    apsCount: 3,
    floors: [
      {
        floorId: 8,
        floorNumber: 1,
        floorName: 'Lantai 1 - Sirkulasi & Ruang Baca Umum',
        switchName: 'SW-PERPUS-LT1 (24-Port GbE)',
        switchStatus: 'healthy',
        activePorts: 16,
        totalPorts: 24,
        accessPoints: [
          { apId: 13, name: 'AP-PERPUS-LOBBY', ip: '192.168.50.41', channel: 'Ch 36 (5GHz)', band: 'Wi-Fi 6 HD', clients: 34, status: 'healthy' },
          { apId: 14, name: 'AP-RUANG-BACA-TIMUR', ip: '192.168.50.42', channel: 'Ch 1 (2.4GHz)', band: 'Wi-Fi 6', clients: 22, status: 'healthy' },
        ],
      },
    ],
  },
  {
    id: 'bldg-dorm',
    name: 'Asrama Mahasiswa (Dormitory)',
    code: 'ASRAMA-PUTRA',
    category: 'dormitory',
    status: 'warning',
    x: 24,
    y: 72,
    floorsCount: 4,
    totalClients: 198,
    trafficInMbps: 340,
    trafficOutMbps: 62,
    pingMs: 1.4,
    uplinkSpeed: '10G SFP+ Trunk',
    uplinkType: '10G Fiber',
    description: 'Kamar Mahasiswa 101 - 420 (PPPoE / Hotspot Voucher) & Lorong Access Point',
    switchesCount: 4,
    apsCount: 4,
    floors: [
      {
        floorId: 10,
        floorNumber: 1,
        floorName: 'Lantai 1 - Kamar 101-120 & Hall Utama',
        switchName: 'SW-ASRAMA-LT1 (24-Port GbE)',
        switchStatus: 'healthy',
        activePorts: 22,
        totalPorts: 24,
        accessPoints: [
          { apId: 16, name: 'AP-ASRAMA-LT1-A', ip: '192.168.50.51', channel: 'Ch 36 (5GHz)', band: 'Wi-Fi 6', clients: 44, status: 'healthy' },
          { apId: 17, name: 'AP-ASRAMA-LT1-B', ip: '192.168.50.52', channel: 'Ch 6 (2.4GHz)', band: 'Wi-Fi 6', clients: 28, status: 'healthy' },
        ],
      },
      {
        floorId: 12,
        floorNumber: 3,
        floorName: 'Lantai 3 - Kamar 301-320 (High Load)',
        switchName: 'SW-ASRAMA-LT3 (24-Port GbE)',
        switchStatus: 'warning',
        activePorts: 24,
        totalPorts: 24,
        accessPoints: [
          { apId: 19, name: 'AP-ASRAMA-PUTRA-LT3', ip: '192.168.50.49', channel: 'Ch 44 (5GHz)', band: 'Wi-Fi 6', clients: 54, status: 'warning' },
        ],
      },
    ],
  },
  {
    id: 'bldg-canteen',
    name: 'Student Center & Kantin',
    code: 'STUDENT-CTR',
    category: 'canteen',
    status: 'healthy',
    x: 76,
    y: 68,
    floorsCount: 2,
    totalClients: 84,
    trafficInMbps: 110,
    trafficOutMbps: 25,
    pingMs: 0.9,
    uplinkSpeed: '1G SFP Direct Fiber',
    uplinkType: '1G SFP',
    description: 'Food Court Kantin Kampus, Ruang UKM / BEM, & Area Outdoor Plaza',
    switchesCount: 2,
    apsCount: 2,
    floors: [
      {
        floorId: 13,
        floorNumber: 1,
        floorName: 'Lantai 1 - Food Court & Area Terbuka',
        switchName: 'SW-KANTIN-LT1 (24-Port GbE)',
        switchStatus: 'healthy',
        activePorts: 14,
        totalPorts: 24,
        accessPoints: [
          { apId: 20, name: 'AP-KANTIN-OUTDOOR-01', ip: '192.168.50.61', channel: 'Ch 36 (5GHz)', band: 'Wi-Fi 6 Outdoor HD', clients: 52, status: 'healthy' },
          { apId: 21, name: 'AP-KANTIN-INDOOR', ip: '192.168.50.62', channel: 'Ch 11 (2.4GHz)', band: 'Wi-Fi 6', clients: 32, status: 'healthy' },
        ],
      },
    ],
  },
];

const DEFAULT_LINKS: FiberLink[] = [
  { id: 1, fromBuildingId: 'bldg-noc', toBuildingId: 'bldg-fac-a', speed: '10G FO', status: 'healthy' },
  { id: 2, fromBuildingId: 'bldg-noc', toBuildingId: 'bldg-lib', speed: '1G FO', status: 'healthy' },
  { id: 3, fromBuildingId: 'bldg-noc', toBuildingId: 'bldg-dorm', speed: '10G FO', status: 'healthy' },
  { id: 4, fromBuildingId: 'bldg-fac-a', toBuildingId: 'bldg-lab', speed: '10G FO', status: 'healthy' },
  { id: 5, fromBuildingId: 'bldg-lib', toBuildingId: 'bldg-canteen', speed: '1G FO', status: 'healthy' },
  { id: 6, fromBuildingId: 'bldg-dorm', toBuildingId: 'bldg-canteen', speed: '1G FO Ring Backup', status: 'healthy' },
];

export const NocCampusMap: React.FC<Props> = ({ 
  onOpenDiagnostics,
  token 
}) => {
  const [buildings, setBuildings] = useState<CampusBuilding[]>(DEFAULT_BUILDINGS);
  const [fiberLinks, setFiberLinks] = useState<FiberLink[]>(DEFAULT_LINKS);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Drag & Drop Layout Edit Mode State
  const [isEditLayoutMode, setIsEditLayoutMode] = useState<boolean>(false);
  const [draggingBldgId, setDraggingBldgId] = useState<string | null>(null);
  const [hasUnsavedLayoutChanges, setHasUnsavedLayoutChanges] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('bldg-lab');
  const [selectedFloorNum, setSelectedFloorNum] = useState<number>(1);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const showPulseAnim = true;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch Live Buildings & Links from Backend API
  const fetchCampusData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [bldgRes, linkRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/monitoring/campus/buildings`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/monitoring/campus/fiber-links`, { headers }).catch(() => null),
      ]);

      if (bldgRes && bldgRes.ok) {
        const data: CampusBuilding[] = await bldgRes.json();
        if (data && data.length > 0) {
          setBuildings(data);
          if (!data.some((b) => b.id === selectedBuildingId)) {
            setSelectedBuildingId(data[0].id);
          }
        }
      }

      if (linkRes && linkRes.ok) {
        const links: FiberLink[] = await linkRes.json();
        if (links && links.length > 0) {
          setFiberLinks(links);
        }
      }
    } catch (err) {
      console.error('Failed to fetch campus data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampusData();
  }, []);

  // Drag & Drop Mouse Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (!isEditLayoutMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingBldgId(id);
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingBldgId || !mapViewportRef.current) return;
    e.preventDefault();
    const rect = mapViewportRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(6, Math.min(94, rawX)) * 10) / 10;
    const clampedY = Math.round(Math.max(6, Math.min(94, rawY)) * 10) / 10;

    setBuildings((prev) =>
      prev.map((b) => (b.id === draggingBldgId ? { ...b, x: clampedX, y: clampedY } : b))
    );
    setHasUnsavedLayoutChanges(true);
  };

  const handleViewportMouseUp = () => {
    if (draggingBldgId) {
      setDraggingBldgId(null);
    }
  };

  // Save new layout coordinates to MySQL Database
  const handleSaveLayout = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/campus/buildings-layout`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          positions: buildings.map((b) => ({ id: b.id, x: b.x, y: b.y })),
        }),
      });

      if (res.ok) {
        showToast('Tata letak posisi gedung kampus berhasil disimpan ke database!');
        setHasUnsavedLayoutChanges(false);
        setIsEditLayoutMode(false);
      }
    } catch (err) {
      console.error('Failed to save layout:', err);
      showToast('Gagal menyimpan posisi denah.');
    } finally {
      setLoading(false);
    }
  };

  // Revert/Cancel Layout changes
  const handleCancelLayout = () => {
    fetchCampusData();
    setHasUnsavedLayoutChanges(false);
    setIsEditLayoutMode(false);
    showToast('Perubahan posisi denah dibatalkan.');
  };

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) || buildings[0] || DEFAULT_BUILDINGS[0];

  // Aggregated Campus Metrics
  const totalCampusUsers = buildings.reduce((sum, b) => sum + (b.totalClients || 0), 0);
  const totalThroughput = buildings.reduce((sum, b) => sum + (b.trafficInMbps || 0), 0);
  const healthyBuildingsCount = buildings.filter((b) => b.status === 'healthy').length;

  const filteredBuildings = buildings.filter((b) => {
    if (filterCategory !== 'all' && b.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'datacenter': return <Server size={18} className="text-cyan-400" />;
      case 'faculty': return <Building2 size={18} className="text-blue-400" />;
      case 'lab': return <Cpu size={18} className="text-purple-400" />;
      case 'library': return <Layers size={18} className="text-emerald-400" />;
      case 'dormitory': return <Building2 size={18} className="text-amber-400" />;
      default: return <Radio size={18} className="text-pink-400" />;
    }
  };

  return (
    <div className="noc-campus-map-root">
      {/* 1. TOP COMMAND & FILTER BAR */}
      <div className="campus-header-bar glass-panel">
        <div className="campus-header-left">
          <div className="campus-title-wrap">
            <Building2 size={22} className="text-cyan-400" />
            <div>
              <h3>CAMPUS NETWORK INFRASTRUCTURE</h3>
              <span className="text-xs text-slate-400">Multi-Building Interconnect & Live Telemetry</span>
            </div>
          </div>
        </div>

        {/* Global Campus KPI Badges */}
        <div className="campus-kpi-pills">
          <div className="campus-pill">
            <Users size={15} className="text-cyan-400" />
            <span>Campus Wi-Fi Clients:</span>
            <strong className="text-cyan-400">{totalCampusUsers} Users</strong>
          </div>

          <div className="campus-pill">
            <Zap size={15} className="text-emerald-400" />
            <span>Aggregate Throughput:</span>
            <strong className="text-emerald-400">{totalThroughput} Mbps</strong>
          </div>

          <div className="campus-pill">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>Backbone 10G Health:</span>
            <strong className="text-emerald-400">{healthyBuildingsCount}/{buildings.length} Nodes OK</strong>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="campus-header-right">
          <div className="campus-search-box">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Cari gedung / AP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="campus-search-input"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="noc-select select-compact"
          >
            <option value="all">Semua Gedung ({buildings.length})</option>
            <option value="datacenter">Server NOC</option>
            <option value="faculty">Gedung Kuliah</option>
            <option value="lab">Lab Komputer</option>
            <option value="library">Perpustakaan</option>
            <option value="dormitory">Asrama</option>
            <option value="canteen">Kantin & Student Ctr</option>
          </select>

          {/* Refresh Data */}
          <button
            className="icon-btn edit"
            onClick={fetchCampusData}
            disabled={loading}
            title="Muat Ulang Data Gedung"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-400' : 'text-slate-300'} />
          </button>

          {/* Toggle Drag & Drop Layout Edit Mode */}
          <button
            className={`btn-layout-toggle ${isEditLayoutMode ? 'active' : ''}`}
            onClick={() => {
              if (isEditLayoutMode && hasUnsavedLayoutChanges) {
                if (confirm('Keluar tanpa menyimpan perubahan posisi denah?')) {
                  handleCancelLayout();
                }
              } else {
                setIsEditLayoutMode(!isEditLayoutMode);
              }
            }}
            title="Aktifkan Mode Geser & Tarik Posisi Gedung di Peta (Drag & Drop)"
          >
            <Move size={15} />
            <span>{isEditLayoutMode ? 'Keluar Mode Geser' : 'Atur Posisi (Drag)'}</span>
          </button>

          {/* Manage Buildings / Edit Campus Plan Button */}
          <button
            className="btn-campus-manage"
            onClick={() => setIsEditorOpen(true)}
            title="Kelola Gedung, Lantai, AP & Jalur FO"
          >
            <Settings2 size={16} />
            <span>Kelola Gedung & Peta</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN LAYOUT: MAP CANVAS (LEFT) + BUILDING INSPECTOR DRAWER (RIGHT) */}
      <div className="campus-main-grid">
        {/* ============================================================ */}
        {/* LEFT: 2.5D ISOMETRIC CAMPUS MAP CANVAS */}
        {/* ============================================================ */}
        <div className="campus-canvas-card glass-panel">
          <div
            ref={mapViewportRef}
            className={`campus-map-viewport ${isEditLayoutMode ? 'edit-layout-active' : ''} ${draggingBldgId ? 'is-dragging-node' : ''}`}
            onMouseMove={handleViewportMouseMove}
            onMouseUp={handleViewportMouseUp}
            onMouseLeave={handleViewportMouseUp}
          >
            {/* Background Grid Pattern */}
            <div className="campus-grid-bg"></div>

            {/* Layout Edit Floating Top Toolbar */}
            {isEditLayoutMode && (
              <div className="layout-edit-floating-bar glass-panel animate-fadeIn">
                <div className="bar-info">
                  <Move size={16} className="text-cyan-400 animate-pulse" />
                  <div>
                    <strong>Mode Atur Posisi Aktif (Drag & Drop)</strong>
                    <span>Klik dan seret gedung ke posisi denah yang diinginkan</span>
                  </div>
                </div>

                <div className="bar-actions">
                  <button className="btn-layout-cancel" onClick={handleCancelLayout}>
                    <RotateCcw size={14} />
                    <span>Batal</span>
                  </button>
                  <button
                    className="btn-layout-save"
                    onClick={handleSaveLayout}
                    disabled={loading || !hasUnsavedLayoutChanges}
                  >
                    <Save size={14} />
                    <span>Simpan Posisi Baru {hasUnsavedLayoutChanges && '•'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Floating Toast Notification */}
            {toastMsg && (
              <div className="campus-canvas-toast animate-slideDown">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>{toastMsg}</span>
              </div>
            )}

            {/* SVG Cable Conduits & Flowing Particles */}
            <svg className="campus-cables-svg" viewBox="0 0 1000 650" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fiberGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                </linearGradient>
                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Underground Inter-Building Cable Runs */}
              {fiberLinks.map((link, idx) => {
                const b1 = buildings.find((b) => b.id === link.fromBuildingId);
                const b2 = buildings.find((b) => b.id === link.toBuildingId);
                if (!b1 || !b2) return null;

                const x1 = (b1.x / 100) * 1000;
                const y1 = (b1.y / 100) * 650;
                const x2 = (b2.x / 100) * 1000;
                const y2 = (b2.y / 100) * 650;

                const midX = (x1 + x2) / 2;
                const pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                return (
                  <g key={idx}>
                    <path
                      d={pathD}
                      className="conduit-shadow"
                      stroke="rgba(15, 23, 42, 0.9)"
                      strokeWidth="10"
                      fill="none"
                    />
                    <path
                      d={pathD}
                      className={`fiber-core-line ${link.status}`}
                      stroke="url(#fiberGlow)"
                      strokeWidth="3.5"
                      fill="none"
                      filter="url(#glowFilter)"
                    />
                    {showPulseAnim && (
                      <path
                        d={pathD}
                        className="fiber-pulse-stream"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeDasharray="6 24"
                        fill="none"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Building Nodes */}
            <div className="campus-buildings-layer">
              {filteredBuildings.map((bldg) => {
                const isSelected = selectedBuildingId === bldg.id;
                const isHovered = hoveredBuildingId === bldg.id;
                const isDraggingThis = draggingBldgId === bldg.id;

                return (
                  <div
                    key={bldg.id}
                    className={`campus-bldg-node ${bldg.status} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isEditLayoutMode ? 'edit-draggable' : ''} ${isDraggingThis ? 'is-dragging' : ''}`}
                    style={{ left: `${bldg.x}%`, top: `${bldg.y}%` }}
                    onClick={() => {
                      if (isEditLayoutMode) return;
                      setSelectedBuildingId(bldg.id);
                      setSelectedFloorNum(1);
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, bldg.id)}
                    onMouseEnter={() => setHoveredBuildingId(bldg.id)}
                    onMouseLeave={() => setHoveredBuildingId(null)}
                  >
                    {/* Floating Coordinates Tag in Drag Mode */}
                    {isEditLayoutMode && (
                      <div className="bldg-drag-coord-pill">
                        <Move size={11} className="text-cyan-400" />
                        <span>X: {bldg.x}% | Y: {bldg.y}%</span>
                      </div>
                    )}

                    {/* Building 3D Isometric Card */}
                    <div className="bldg-isometric-box">
                      <div className="bldg-roof">
                        <div className="bldg-icon-wrap">
                          {getCategoryIcon(bldg.category)}
                        </div>
                        <span className={`bldg-status-dot ${bldg.status}`}></span>
                      </div>
                      
                      <div className="bldg-tag">
                        <span className="bldg-code">{bldg.code}</span>
                        <span className="bldg-clients-badge">
                          <Users size={11} /> {bldg.totalClients}
                        </span>
                      </div>
                    </div>

                    {/* Floating Tooltip Hover (when not in edit mode) */}
                    {!isEditLayoutMode && (
                      <div className="bldg-hover-pill">
                        <strong>{bldg.name}</strong>
                        <span className="pill-sub">
                          {bldg.trafficInMbps} Mbps • {bldg.pingMs}ms
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Canvas Legend */}
            <div className="campus-canvas-legend">
              <div className="legend-item">
                <span className="legend-line line-10g"></span>
                <span>10G Inter-Building FO</span>
              </div>
              <div className="legend-item">
                <span className="legend-line line-1g"></span>
                <span>1G SFP Direct Link</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-green"></span>
                <span>Normal</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-amber"></span>
                <span>High Traffic</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT: BUILDING INSPECTOR & PER-FLOOR DRAWER */}
        {/* ============================================================ */}
        {selectedBuilding && (
          <div className="campus-drawer-card glass-panel">
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="drawer-bldg-info">
                <div className="drawer-icon-wrap">
                  {getCategoryIcon(selectedBuilding.category)}
                </div>
                <div>
                  <h4>{selectedBuilding.name}</h4>
                  <span className="text-xs text-slate-400">
                    {selectedBuilding.description}
                  </span>
                </div>
              </div>

              <span className={`bldg-badge-status badge-${selectedBuilding.status}`}>
                {selectedBuilding.status.toUpperCase()}
              </span>
            </div>

            {/* Key Metrics Row */}
            <div className="drawer-metrics-grid">
              <div className="metric-chip">
                <div className="chip-label">Live Traffic</div>
                <div className="chip-val text-emerald-400">
                  <ArrowDownRight size={14} /> {selectedBuilding.trafficInMbps} <span className="unit">Mbps</span>
                </div>
                <span className="chip-sub">Tx: {selectedBuilding.trafficOutMbps} Mbps</span>
              </div>

              <div className="metric-chip">
                <div className="chip-label">Active Users</div>
                <div className="chip-val text-cyan-400">
                  <Users size={14} /> {selectedBuilding.totalClients} <span className="unit">Clients</span>
                </div>
                <span className="chip-sub">Across {selectedBuilding.floorsCount} Floors</span>
              </div>

              <div className="metric-chip">
                <div className="chip-label">Uplink Speed</div>
                <div className="chip-val text-purple-400 font-mono text-sm">
                  {selectedBuilding.uplinkSpeed}
                </div>
                <span className="chip-sub">Ping: {selectedBuilding.pingMs} ms</span>
              </div>
            </div>

            {/* Floor Switcher Tabs */}
            <div className="floor-tabs-bar">
              {selectedBuilding.floors.map((fl) => (
                <button
                  key={fl.floorNumber}
                  className={`floor-tab-btn ${selectedFloorNum === fl.floorNumber ? 'active' : ''}`}
                  onClick={() => setSelectedFloorNum(fl.floorNumber)}
                >
                  <span>Lantai {fl.floorNumber}</span>
                  <span className="floor-pill-count">
                    {fl.accessPoints.reduce((acc, ap) => acc + ap.clients, 0)} Users
                  </span>
                </button>
              ))}
            </div>

            {/* Active Floor Equipment Breakdown */}
            {(() => {
              const currentFloor = selectedBuilding.floors.find((f) => f.floorNumber === selectedFloorNum) || selectedBuilding.floors[0];
              if (!currentFloor) return null;

              return (
                <div className="floor-details-container">
                  <div className="floor-header-row">
                    <span className="floor-title">{currentFloor.floorName}</span>
                  </div>

                  {/* Floor Distribution Switch */}
                  <div className="equipment-card switch-card">
                    <div className="eq-top">
                      <div className="eq-info">
                        <Router size={16} className="text-emerald-400" />
                        <strong>{currentFloor.switchName}</strong>
                      </div>
                      <span className="eq-ports-badge">
                        {currentFloor.activePorts}/{currentFloor.totalPorts} Ports Active
                      </span>
                    </div>
                    <div className="eq-sub-meta">
                      <span>VLAN: 10, 20, 50, 100</span>
                      <span>• POE+ Budget: 280W (72% Load)</span>
                    </div>
                  </div>

                  {/* Access Points List on this Floor */}
                  <div className="floor-aps-list">
                    <div className="aps-list-title">Access Points on this Floor ({currentFloor.accessPoints.length} Nodes)</div>
                    {currentFloor.accessPoints.map((ap, apIdx) => (
                      <div key={apIdx} className={`ap-item-card ${ap.status}`}>
                        <div className="ap-left">
                          <Wifi size={15} className={ap.status === 'warning' ? 'text-amber-400 animate-pulse' : 'text-cyan-400'} />
                          <div className="ap-titles">
                            <span className="ap-name">{ap.name}</span>
                            <span className="ap-ip font-mono">{ap.ip} • {ap.channel}</span>
                          </div>
                        </div>

                        <div className="ap-right">
                          <span className="ap-clients-pill">
                            <Users size={12} /> {ap.clients} Clients
                          </span>
                          <span className={`status-dot-sm ${ap.status}`}></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions Footer */}
            <div className="drawer-actions-footer">
              <button
                className="btn-drawer-action btn-ping"
                onClick={() => {
                  if (onOpenDiagnostics) {
                    onOpenDiagnostics(selectedBuilding.floors[0]?.accessPoints[0]?.ip || '10.10.0.1');
                  }
                }}
              >
                <Terminal size={14} />
                <span>Ping Test ke Gedung Ini</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. CAMPUS BUILDING & INFRASTRUCTURE EDITOR MODAL */}
      {isEditorOpen && (
        <CampusBuildingEditorModal
          buildings={buildings}
          fiberLinks={fiberLinks}
          onClose={() => setIsEditorOpen(false)}
          onRefreshData={fetchCampusData}
          token={token}
        />
      )}
    </div>
  );
};
