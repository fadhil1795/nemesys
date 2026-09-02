import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Wrench,
  QrCode,
  Printer,
  AlertTriangle,
  Clock,
  Layers,
  Server,
  Monitor,
  Laptop,
  Network,
  Wifi,
  HardDrive,
  Cpu,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  X,
  MapPin,
  User as UserIcon,
  ShieldCheck,
  Package
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { 
  ITAsset, 
  ITComponent, 
  ITAssetComponent, 
  ITInventoryMutation, 
  ITInventoryStats,
  ITAssetStatus,
  ITComponentCondition
} from '../types';

interface InventoryManagerProps {
  token: string;
  currentUserRole?: string;
  currentUserName?: string;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  token,
  currentUserRole: _currentUserRole,
  currentUserName: _currentUserName
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'components' | 'mutations' | 'analytics'>('assets');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Data States
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [components, setComponents] = useState<ITComponent[]>([]);
  const [mutations, setMutations] = useState<ITInventoryMutation[]>([]);
  const [stats, setStats] = useState<ITInventoryStats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');

  // Modals
  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<ITAsset | null>(null);

  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<{ asset: ITAsset; installed_components: ITAssetComponent[] } | null>(null);

  const [showCompModal, setShowCompModal] = useState<boolean>(false);
  const [editingComp, setEditingComp] = useState<ITComponent | null>(null);

  const [showAdjustStockModal, setShowAdjustStockModal] = useState<boolean>(false);
  const [targetComponentForStock, setTargetComponentForStock] = useState<ITComponent | null>(null);
  const [adjustStockData, setAdjustStockData] = useState({ adjustType: 'in', quantity: 1, notes: '' });

  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [targetAssetForInstall, setTargetAssetForInstall] = useState<ITAsset | null>(null);
  const [installData, setInstallData] = useState({
    componentId: 0,
    quantity: 1,
    slotOrPosition: '',
    notes: '',
    installedAt: new Date().toISOString().split('T')[0]
  });

  const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
  const [targetAttachmentForRemove, setTargetAttachmentForRemove] = useState<ITAssetComponent | null>(null);
  const [removeData, setRemoveData] = useState({
    restock: true,
    conditionStatus: 'Bekas Bagus',
    reason: ''
  });

  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [selectedQrAsset, setSelectedQrAsset] = useState<ITAsset | null>(null);

  // Form states for Asset
  const [assetForm, setAssetForm] = useState({
    asset_code: '',
    name: '',
    category: 'PC / Desktop',
    brand: '',
    model_number: '',
    serial_number: '',
    mac_address: '',
    ip_address: '',
    location: '',
    assigned_user: '',
    status: 'Baik / Aktif' as ITAssetStatus,
    purchase_date: '',
    purchase_cost: 0,
    vendor: '',
    warranty_expiry: '',
    specs: '',
    image_url: '',
    notes: ''
  });

  // Form states for Component
  const [compForm, setCompForm] = useState({
    component_code: '',
    name: '',
    category: 'RAM / Memory',
    brand: '',
    model_number: '',
    stock_quantity: 0,
    min_stock_alert: 2,
    unit: 'Pcs',
    condition_status: 'Baru' as ITComponentCondition,
    storage_location: '',
    unit_price: 0,
    supplier: '',
    notes: ''
  });

  // Fetch all inventory data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [assetRes, compRes, mutRes, statRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/inventory/assets`, { headers }),
        fetch(`${BACKEND_URL}/api/inventory/components`, { headers }),
        fetch(`${BACKEND_URL}/api/inventory/mutations`, { headers }),
        fetch(`${BACKEND_URL}/api/inventory/stats`, { headers })
      ]);

      if (assetRes.ok) setAssets(await assetRes.json());
      if (compRes.ok) setComponents(await compRes.json());
      if (mutRes.ok) setMutations(await mutRes.json());
      if (statRes.ok) setStats(await statRes.json());
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token, refreshKey]);

  // Fetch single asset detail
  const fetchAssetDetail = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/assets/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAssetDetail(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch asset detail:', err);
    }
  };

  // Distinct Filter options
  const assetCategories = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => { if (a.category) set.add(a.category); });
    return Array.from(set);
  }, [assets]);

  const assetLocations = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => { if (a.location) set.add(a.location); });
    return Array.from(set);
  }, [assets]);

  const compCategories = useMemo(() => {
    const set = new Set<string>();
    components.forEach(c => { if (c.category) set.add(c.category); });
    return Array.from(set);
  }, [components]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchQuery = 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.asset_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.brand && a.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.assigned_user && a.assigned_user.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategory === 'ALL' || a.category === selectedCategory;
      const matchStat = selectedStatus === 'ALL' || a.status === selectedStatus;
      const matchLoc = selectedLocation === 'ALL' || a.location === selectedLocation;
      return matchQuery && matchCat && matchStat && matchLoc;
    });
  }, [assets, searchQuery, selectedCategory, selectedStatus, selectedLocation]);

  // Filtered Components
  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      const matchQuery = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.component_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.brand && c.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.storage_location && c.storage_location.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategory === 'ALL' || c.category === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [components, searchQuery, selectedCategory]);

  // Low stock items
  const lowStockComponents = useMemo(() => {
    return components.filter(c => c.stock_quantity <= c.min_stock_alert);
  }, [components]);

  // Category Icon helper
  const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('server')) return <Server size={18} style={{ color: '#818cf8' }} />;
    if (lower.includes('pc') || lower.includes('desktop')) return <Monitor size={18} style={{ color: '#38bdf8' }} />;
    if (lower.includes('laptop')) return <Laptop size={18} style={{ color: '#a78bfa' }} />;
    if (lower.includes('switch') || lower.includes('router')) return <Network size={18} style={{ color: '#34d399' }} />;
    if (lower.includes('access point') || lower.includes('ap') || lower.includes('wifi')) return <Wifi size={18} style={{ color: '#fbbf24' }} />;
    if (lower.includes('storage') || lower.includes('ssd') || lower.includes('hdd')) return <HardDrive size={18} style={{ color: '#f472b6' }} />;
    if (lower.includes('ram') || lower.includes('cpu')) return <Cpu size={18} style={{ color: '#fb923c' }} />;
    if (lower.includes('ups') || lower.includes('power')) return <Zap size={18} style={{ color: '#eab308' }} />;
    return <Boxes size={18} style={{ color: '#94a3b8' }} />;
  };

  // Status Badge helper
  const getStatusBadge = (status: ITAssetStatus) => {
    switch (status) {
      case 'Baik / Aktif':
        return <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Baik / Aktif</span>;
      case 'Rusak Ringan':
        return <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Rusak Ringan</span>;
      case 'Rusak Berat':
        return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Rusak Berat</span>;
      case 'Cadangan / Stock':
        return <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Cadangan / Stock</span>;
      case 'Dipinjamkan':
        return <span style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Dipinjamkan</span>;
      case 'Afkir / Disposed':
        return <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Afkir / Disposed</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // ----------------------------------------------------
  // ASSET HANDLERS
  // ----------------------------------------------------
  const handleOpenAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      asset_code: '',
      name: '',
      category: 'PC / Desktop',
      brand: '',
      model_number: '',
      serial_number: '',
      mac_address: '',
      ip_address: '',
      location: 'Server Room Rektorat',
      assigned_user: '',
      status: 'Baik / Aktif',
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_cost: 0,
      vendor: '',
      warranty_expiry: '',
      specs: '',
      image_url: '',
      notes: ''
    });
    setShowAssetModal(true);
  };

  const handleOpenEditAsset = (asset: ITAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      asset_code: asset.asset_code,
      name: asset.name,
      category: asset.category,
      brand: asset.brand || '',
      model_number: asset.model_number || '',
      serial_number: asset.serial_number || '',
      mac_address: asset.mac_address || '',
      ip_address: asset.ip_address || '',
      location: asset.location,
      assigned_user: asset.assigned_user || '',
      status: asset.status,
      purchase_date: asset.purchase_date || '',
      purchase_cost: asset.purchase_cost || 0,
      vendor: asset.vendor || '',
      warranty_expiry: asset.warranty_expiry || '',
      specs: asset.specs || '',
      image_url: asset.image_url || '',
      notes: asset.notes || ''
    });
    setShowAssetModal(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAsset 
        ? `${BACKEND_URL}/api/inventory/assets/${editingAsset.id}`
        : `${BACKEND_URL}/api/inventory/assets`;
      const method = editingAsset ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(assetForm)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menyimpan data aset IT');
        return;
      }

      setShowAssetModal(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('Gagal menghubungi backend API.');
    }
  };

  const handleDeleteAsset = async (id: number, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus aset [${name}]? Riwayat komponen terpasang juga akan dibersihkan.`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/assets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRefreshKey(prev => prev + 1);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus aset');
      }
    } catch (err) {
      alert('Gagal menghubungi backend API.');
    }
  };

  // ----------------------------------------------------
  // COMPONENT HANDLERS
  // ----------------------------------------------------
  const handleOpenAddComp = () => {
    setEditingComp(null);
    setCompForm({
      component_code: '',
      name: '',
      category: 'RAM / Memory',
      brand: '',
      model_number: '',
      stock_quantity: 1,
      min_stock_alert: 2,
      unit: 'Pcs',
      condition_status: 'Baru',
      storage_location: 'Lemari Sparepart Lab 1',
      unit_price: 0,
      supplier: '',
      notes: ''
    });
    setShowCompModal(true);
  };

  const handleOpenEditComp = (comp: ITComponent) => {
    setEditingComp(comp);
    setCompForm({
      component_code: comp.component_code,
      name: comp.name,
      category: comp.category,
      brand: comp.brand || '',
      model_number: comp.model_number || '',
      stock_quantity: comp.stock_quantity,
      min_stock_alert: comp.min_stock_alert,
      unit: comp.unit,
      condition_status: comp.condition_status,
      storage_location: comp.storage_location,
      unit_price: comp.unit_price,
      supplier: comp.supplier || '',
      notes: comp.notes || ''
    });
    setShowCompModal(true);
  };

  const handleSaveComp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingComp 
        ? `${BACKEND_URL}/api/inventory/components/${editingComp.id}`
        : `${BACKEND_URL}/api/inventory/components`;
      const method = editingComp ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(compForm)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menyimpan komponen');
        return;
      }

      setShowCompModal(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('Gagal menghubungi backend API.');
    }
  };

  const handleDeleteComp = async (id: number, name: string) => {
    if (!window.confirm(`Hapus master komponen [${name}]?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/components/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      alert('Gagal menghapus komponen');
    }
  };

  // Adjust stock
  const handleOpenAdjustStock = (comp: ITComponent) => {
    setTargetComponentForStock(comp);
    setAdjustStockData({ adjustType: 'in', quantity: 1, notes: '' });
    setShowAdjustStockModal(true);
  };

  const handleSaveAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetComponentForStock) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/components/${targetComponentForStock.id}/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adjustStockData)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengubah stok');
        return;
      }

      setShowAdjustStockModal(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('Gagal memproses penyesuaian stok.');
    }
  };

  // Install Component
  const handleOpenInstall = (asset: ITAsset) => {
    setTargetAssetForInstall(asset);
    setInstallData({
      componentId: components[0]?.id || 0,
      quantity: 1,
      slotOrPosition: '',
      notes: '',
      installedAt: new Date().toISOString().split('T')[0]
    });
    setShowInstallModal(true);
  };

  const handleSaveInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssetForInstall || !installData.componentId) {
      alert('Pilih komponen yang akan dipasang');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/assets/${targetAssetForInstall.id}/install-component`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(installData)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal memasang komponen');
        return;
      }

      setShowInstallModal(false);
      setRefreshKey(prev => prev + 1);

      // If detail modal is currently open, refresh detail
      if (showDetailModal && selectedAssetDetail?.asset.id === targetAssetForInstall.id) {
        fetchAssetDetail(targetAssetForInstall.id);
      }
    } catch (err) {
      alert('Gagal memasang komponen ke perangkat.');
    }
  };

  // Remove Component
  const handleOpenRemove = (attachment: ITAssetComponent) => {
    setTargetAttachmentForRemove(attachment);
    setRemoveData({
      restock: true,
      conditionStatus: 'Bekas Bagus',
      reason: 'Penggantian part / maintenance'
    });
    setShowRemoveModal(true);
  };

  const handleSaveRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAttachmentForRemove || !selectedAssetDetail) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory/assets/${selectedAssetDetail.asset.id}/remove-component/${targetAttachmentForRemove.attachment_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(removeData)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal melepas komponen');
        return;
      }

      setShowRemoveModal(false);
      fetchAssetDetail(selectedAssetDetail.asset.id);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert('Gagal melepas komponen.');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
            <div style={{ padding: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
              <Boxes size={26} />
            </div>
            Inventaris Perangkat IT & Komponen
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Manajemen master aset hardware kampus, stok suku cadang, pelacakan komponen terpasang, dan log mutasi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleOpenAddComp}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
          >
            <Plus size={16} /> + Tambah Komponen
          </button>
          <button
            onClick={handleOpenAddAsset}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff' }}
          >
            <Plus size={16} /> + Registrasi Aset IT
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* KPI 1: Total Aset IT */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', color: '#818cf8' }}>
            <Monitor size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Total Perangkat IT</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
              {stats?.summary.totalAssets || assets.length} <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>Unit</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#818cf8', marginTop: '2px' }}>
              Nilai: Rp {(stats?.summary.totalAssetCost || 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* KPI 2: Kondisi Perangkat */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', color: '#4ade80' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Kondisi Operasional</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#4ade80', marginTop: '2px' }}>
              {stats?.summary.goodAssets || 0} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Baik / Aktif</span>
            </div>
            <div style={{ fontSize: '11.5px', color: (stats?.summary.brokenAssets || 0) > 0 ? '#f87171' : 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
              {stats?.summary.brokenAssets || 0} Butuh Servis / Rusak
            </div>
          </div>
        </div>

        {/* KPI 3: Master Komponen & Stok */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', color: '#38bdf8' }}>
            <Cpu size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Stok Suku Cadang & Komponen</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
              {stats?.summary.totalStockItems || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>Item ({components.length} Jenis)</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '2px' }}>
              Nilai Cadangan: Rp {(stats?.summary.totalComponentValue || 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* KPI 4: Low Stock Alert Warning */}
        <div style={{ 
          background: lowStockComponents.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(30, 41, 59, 0.6)', 
          border: lowStockComponents.length > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', 
          borderRadius: '16px', 
          padding: '18px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px' 
        }}>
          <div style={{ padding: '12px', background: lowStockComponents.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: lowStockComponents.length > 0 ? '#f87171' : '#94a3b8' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Peringatan Stok Menipis</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: lowStockComponents.length > 0 ? '#f87171' : '#4ade80', marginTop: '2px' }}>
              {lowStockComponents.length} <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>Jenis Komponen</span>
            </div>
            <div style={{ fontSize: '11.5px', color: lowStockComponents.length > 0 ? '#f87171' : '#4ade80', marginTop: '2px' }}>
              {lowStockComponents.length > 0 ? 'Perlu Restock Segera!' : 'Seluruh Stok Aman'}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Low Stock Banner (if active) */}
      {lowStockComponents.length > 0 && activeTab === 'components' && (
        <div style={{ background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(220, 38, 38, 0.08))', border: '1px solid #ef4444', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#f87171' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '14px' }}>
                Perhatian: {lowStockComponents.length} Komponen Mencapai Batas Minimum Stok!
              </div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
                Item: {lowStockComponents.map(c => `${c.name} (${c.stock_quantity} ${c.unit})`).join(', ')}
              </div>
            </div>
          </div>
          <button 
            onClick={() => handleOpenAdjustStock(lowStockComponents[0])}
            style={{ padding: '6px 14px', borderRadius: '6px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
          >
            + Restock Item Pertama
          </button>
        </div>
      )}

      {/* 4. Tab Navigation Header */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          onClick={() => { setActiveTab('assets'); setSelectedCategory('ALL'); }}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'assets' ? '#6366f1' : 'transparent',
            color: activeTab === 'assets' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Monitor size={17} /> Perangkat & Alat IT ({assets.length})
        </button>

        <button
          onClick={() => { setActiveTab('components'); setSelectedCategory('ALL'); }}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'components' ? '#6366f1' : 'transparent',
            color: activeTab === 'components' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Cpu size={17} /> Komponen & Suku Cadang ({components.length})
        </button>

        <button
          onClick={() => setActiveTab('mutations')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'mutations' ? '#6366f1' : 'transparent',
            color: activeTab === 'mutations' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Clock size={17} /> Riwayat Mutasi & Pemasangan ({mutations.length})
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'analytics' ? '#6366f1' : 'transparent',
            color: activeTab === 'analytics' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <TrendingUp size={17} /> Analitik & Valuasi Aset
        </button>
      </div>

      {/* 5. TAB 1: ASSETS VIEW */}
      {activeTab === 'assets' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="text"
                placeholder="Cari nama perangkat, kode aset, brand, serial number, atau PIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px' }}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px', minWidth: '150px' }}
            >
              <option value="ALL">Semua Kategori</option>
              {assetCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px', minWidth: '150px' }}
            >
              <option value="ALL">Semua Status</option>
              <option value="Baik / Aktif">Baik / Aktif</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
              <option value="Cadangan / Stock">Cadangan / Stock</option>
              <option value="Dipinjamkan">Dipinjamkan</option>
              <option value="Afkir / Disposed">Afkir / Disposed</option>
            </select>

            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px', minWidth: '160px' }}
            >
              <option value="ALL">Semua Lokasi</option>
              {assetLocations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Asset Cards / Table */}
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.7)' }}>
                    <th style={{ padding: '14px 16px' }}>Kode Aset & Perangkat</th>
                    <th style={{ padding: '14px 16px' }}>Kategori & Merk</th>
                    <th style={{ padding: '14px 16px' }}>Lokasi & PIC</th>
                    <th style={{ padding: '14px 16px' }}>Kondisi</th>
                    <th style={{ padding: '14px 16px' }}>Komponen Terpasang</th>
                    <th style={{ padding: '14px 16px' }}>Nilai Aset</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Tidak ada aset IT yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => (
                      <tr 
                        key={asset.id} 
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                              {getCategoryIcon(asset.category)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{asset.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                                  {asset.asset_code}
                                </span>
                                {asset.ip_address && (
                                  <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)' }}>
                                    IP: {asset.ip_address}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{asset.category}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                            {asset.brand || '-'} {asset.model_number ? `(${asset.model_number})` : ''}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                            <MapPin size={13} style={{ color: '#94a3b8' }} /> {asset.location}
                          </div>
                          {asset.assigned_user && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#818cf8', marginTop: '3px' }}>
                              <UserIcon size={12} /> PIC: {asset.assigned_user}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {getStatusBadge(asset.status)}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                            <Cpu size={13} /> {asset.installed_components_count || 0} Part Terpasang
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
                            Rp {(asset.purchase_cost || 0).toLocaleString('id-ID')}
                          </div>
                          {asset.purchase_date && (
                            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                              Beli: {asset.purchase_date}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              title="Lihat Detail & Komponen"
                              onClick={() => fetchAssetDetail(asset.id)}
                              style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              title="Pasang Komponen Baru"
                              onClick={() => handleOpenInstall(asset)}
                              style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <Wrench size={15} />
                            </button>
                            <button
                              title="Cetak Stiker Label QR"
                              onClick={() => { setSelectedQrAsset(asset); setShowQrModal(true); }}
                              style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <QrCode size={15} />
                            </button>
                            <button
                              title="Edit Aset"
                              onClick={() => handleOpenEditAsset(asset)}
                              style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              title="Hapus Aset"
                              onClick={() => handleDeleteAsset(asset.id, asset.name)}
                              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 2: COMPONENTS & SPARE PARTS VIEW */}
      {activeTab === 'components' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="text"
                placeholder="Cari nama komponen, kode part, brand, lokasi penyimpanan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px' }}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: '13.5px', minWidth: '160px' }}
            >
              <option value="ALL">Semua Kategori Part</option>
              {compCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Component Cards / Table */}
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.7)' }}>
                    <th style={{ padding: '14px 16px' }}>Kode & Nama Komponen</th>
                    <th style={{ padding: '14px 16px' }}>Kategori & Spesifikasi</th>
                    <th style={{ padding: '14px 16px' }}>Stok Gudang</th>
                    <th style={{ padding: '14px 16px' }}>Lokasi Rak / Penyimpanan</th>
                    <th style={{ padding: '14px 16px' }}>Kondisi</th>
                    <th style={{ padding: '14px 16px' }}>Harga Satuan</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComponents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Tidak ada suku cadang/komponen yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredComponents.map((comp) => {
                      const isLow = comp.stock_quantity <= comp.min_stock_alert;
                      return (
                        <tr 
                          key={comp.id} 
                          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', transition: 'background 0.2s', background: isLow ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLow ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isLow ? 'rgba(239,68,68,0.05)' : 'transparent')}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                                <Cpu size={18} style={{ color: isLow ? '#f87171' : '#38bdf8' }} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{comp.name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(56, 189, 248, 0.2)', color: '#7dd3fc', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                                    {comp.component_code}
                                  </span>
                                  {comp.brand && (
                                    <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)' }}>
                                      Merk: {comp.brand}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{comp.category}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                              {comp.model_number || '-'}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ 
                                fontSize: '15px', 
                                fontWeight: 800, 
                                color: isLow ? '#f87171' : '#4ade80',
                                padding: '2px 8px',
                                background: isLow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                                borderRadius: '6px',
                                border: isLow ? '1px solid #ef4444' : '1px solid rgba(34, 197, 94, 0.3)'
                              }}>
                                {comp.stock_quantity} {comp.unit}
                              </span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: isLow ? '#fca5a5' : 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                              Min Alert: {comp.min_stock_alert} {comp.unit}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                              <MapPin size={13} style={{ color: '#94a3b8' }} /> {comp.storage_location}
                            </div>
                            {comp.supplier && (
                              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                Supplier: {comp.supplier}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ 
                              background: comp.condition_status === 'Baru' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                              color: comp.condition_status === 'Baru' ? '#4ade80' : '#fde047',
                              border: comp.condition_status === 'Baru' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600
                            }}>
                              {comp.condition_status}
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
                              Rp {(comp.unit_price || 0).toLocaleString('id-ID')}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '2px' }}>
                              Total: Rp {((comp.unit_price || 0) * comp.stock_quantity).toLocaleString('id-ID')}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                              <button
                                title="Atur Stok Masuk / Keluar"
                                onClick={() => handleOpenAdjustStock(comp)}
                                style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Package size={14} /> Atur Stok
                              </button>
                              <button
                                title="Edit Komponen"
                                onClick={() => handleOpenEditComp(comp)}
                                style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                title="Hapus Komponen"
                                onClick={() => handleDeleteComp(comp.id, comp.name)}
                                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                <Trash2 size={15} />
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
          </div>
        </div>
      )}

      {/* 7. TAB 3: MUTATIONS & ACTIVITY LOG */}
      {activeTab === 'mutations' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#818cf8' }} /> Log Riwayat Mutasi & Pemasangan Hardware
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mutations.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                Belum ada catatan mutasi inventaris.
              </div>
            ) : (
              mutations.map((m) => {
                let badgeBg = 'rgba(99, 102, 241, 0.15)';
                let badgeColor = '#818cf8';
                let icon = <Clock size={16} />;

                if (m.type.includes('Stock In')) {
                  badgeBg = 'rgba(34, 197, 94, 0.15)';
                  badgeColor = '#4ade80';
                  icon = <ArrowDownLeft size={16} />;
                } else if (m.type.includes('Install')) {
                  badgeBg = 'rgba(56, 189, 248, 0.15)';
                  badgeColor = '#38bdf8';
                  icon = <Wrench size={16} />;
                } else if (m.type.includes('Remove') || m.type.includes('Stock Out')) {
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                  badgeColor = '#f87171';
                  icon = <ArrowUpRight size={16} />;
                }

                return (
                  <div 
                    key={m.id}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '14px', 
                      padding: '14px 16px', 
                      background: 'rgba(15, 23, 42, 0.7)', 
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div style={{ padding: '8px', background: badgeBg, color: badgeColor, borderRadius: '8px' }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: badgeColor, fontSize: '13.5px' }}>
                          {m.type} — {m.reference_name}
                        </span>
                        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                          {new Date(m.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                        {m.details}
                      </p>
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.45)' }}>
                        Oleh: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{m.actor_name}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 8. TAB 4: ANALYTICS & VALUATION */}
      {activeTab === 'analytics' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          {/* Card 1: Total Valuation Breakdown */}
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: '#4ade80' }} /> Valuasi Total Aset IT Kampus
            </h3>
            
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Total Valuasi Keseluruhan (Hardware + Stok)</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>
                Rp {stats.summary.totalInventoryValuation.toLocaleString('id-ID')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>Aset Perangkat Aktif ({stats.summary.totalAssets} Unit)</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>Rp {stats.summary.totalAssetCost.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>Cadangan Suku Cadang & Komponen ({stats.summary.totalStockItems} Item)</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>Rp {stats.summary.totalComponentValue.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Asset Distribution by Category */}
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#818cf8' }} /> Distribusi Aset per Kategori
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.assetsByCategory.map((cat) => {
                const pct = stats.summary.totalAssets > 0 ? ((cat.count / stats.summary.totalAssets) * 100).toFixed(0) : '0';
                return (
                  <div key={cat.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{cat.category} ({cat.count} unit)</span>
                      <span style={{ color: '#818cf8', fontWeight: 700 }}>Rp {cat.total_val.toLocaleString('id-ID')} ({pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: DETAIL ASET & KOMPONEN TERPASANG */}
      {/* ============================================================ */}
      {showDetailModal && selectedAssetDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '12px' }}>
                  {getCategoryIcon(selectedAssetDetail.asset.category)}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{selectedAssetDetail.asset.name}</h2>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '4px' }}>
                      {selectedAssetDetail.asset.asset_code}
                    </span>
                    {getStatusBadge(selectedAssetDetail.asset.status)}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* General Specs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', marginBottom: '20px', fontSize: '13px' }}>
              <div><b>Kategori:</b> {selectedAssetDetail.asset.category}</div>
              <div><b>Merk / Model:</b> {selectedAssetDetail.asset.brand || '-'} {selectedAssetDetail.asset.model_number || ''}</div>
              <div><b>Serial Number (S/N):</b> {selectedAssetDetail.asset.serial_number || '-'}</div>
              <div><b>IP / MAC:</b> {selectedAssetDetail.asset.ip_address || '-'} / {selectedAssetDetail.asset.mac_address || '-'}</div>
              <div><b>Lokasi:</b> {selectedAssetDetail.asset.location}</div>
              <div><b>PIC / Pengguna:</b> {selectedAssetDetail.asset.assigned_user || '-'}</div>
              <div><b>Harga Pembelian:</b> Rp {(selectedAssetDetail.asset.purchase_cost || 0).toLocaleString('id-ID')}</div>
              <div><b>Tanggal Beli / Garansi:</b> {selectedAssetDetail.asset.purchase_date || '-'} / {selectedAssetDetail.asset.warranty_expiry || '-'}</div>
            </div>

            {selectedAssetDetail.asset.specs && (
              <div style={{ marginBottom: '20px', background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>SPESIFIKASI DETAIL</div>
                <div style={{ fontSize: '13.5px', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{selectedAssetDetail.asset.specs}</div>
              </div>
            )}

            {/* Installed Components Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} style={{ color: '#38bdf8' }} /> Komponen & Hardware Terpasang ({selectedAssetDetail.installed_components.length})
                </h4>
                <button
                  onClick={() => {
                    handleOpenInstall(selectedAssetDetail.asset);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  <Plus size={14} /> Pasang Komponen Baru
                </button>
              </div>

              {selectedAssetDetail.installed_components.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
                  Belum ada komponen hardware tambahan yang dipasang pada perangkat ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedAssetDetail.installed_components.map((part) => (
                    <div 
                      key={part.attachment_id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 14px', 
                        background: 'rgba(15, 23, 42, 0.7)', 
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '13.5px' }}>
                          {part.quantity}x {part.component_name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                          Kode: <span style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{part.component_code}</span> | Posisi: <span style={{ color: '#fff' }}>{part.slot_or_position || '-'}</span> | Pasang: {part.installed_at}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenRemove(part)}
                        style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Lepas Part
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ADD / EDIT IT ASSET */}
      {/* ============================================================ */}
      {showAssetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {editingAsset ? `Edit Aset [${editingAsset.asset_code}]` : 'Registrasi Perangkat & Aset IT Baru'}
              </h3>
              <button onClick={() => setShowAssetModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Nama Perangkat *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Server Database Utama"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Kategori Perangkat *</label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  >
                    <option value="PC / Desktop">PC / Desktop</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Server">Server</option>
                    <option value="Switch">Switch</option>
                    <option value="Router">Router</option>
                    <option value="Access Point">Access Point</option>
                    <option value="Printer / Scanner">Printer / Scanner</option>
                    <option value="Projector / Display">Projector / Display</option>
                    <option value="CCTV / Security">CCTV / Security</option>
                    <option value="UPS / Power">UPS / Power</option>
                    <option value="Other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Kode Aset (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Auto: AST-xxx-0001"
                    value={assetForm.asset_code}
                    onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Merk / Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Dell, Cisco, Asus"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Model / Tipe</label>
                  <input
                    type="text"
                    placeholder="e.g. PowerEdge R740"
                    value={assetForm.model_number}
                    onChange={(e) => setAssetForm({ ...assetForm, model_number: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Lokasi / Ruang *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Server Room Rektorat"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>PIC / Pengguna</label>
                  <input
                    type="text"
                    placeholder="e.g. Rizal Kurniawan"
                    value={assetForm.assigned_user}
                    onChange={(e) => setAssetForm({ ...assetForm, assigned_user: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Status Kondisi</label>
                  <select
                    value={assetForm.status}
                    onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as ITAssetStatus })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  >
                    <option value="Baik / Aktif">Baik / Aktif</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                    <option value="Cadangan / Stock">Cadangan / Stock</option>
                    <option value="Dipinjamkan">Dipinjamkan</option>
                    <option value="Afkir / Disposed">Afkir / Disposed</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Harga Beli (Rp)</label>
                  <input
                    type="number"
                    value={assetForm.purchase_cost}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Tanggal Pembelian</label>
                  <input
                    type="date"
                    value={assetForm.purchase_date}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Spesifikasi Hardware Detail</label>
                <textarea
                  rows={3}
                  placeholder="e.g. CPU Core i7-12700, 16GB DDR4 RAM, 512GB NVMe SSD, GPU GTX 1650..."
                  value={assetForm.specs}
                  onChange={(e) => setAssetForm({ ...assetForm, specs: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssetModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Simpan Aset
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: ADD / EDIT COMPONENT */}
      {/* ============================================================ */}
      {showCompModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {editingComp ? `Edit Komponen [${editingComp.component_code}]` : 'Tambah Master Komponen & Spare Part'}
              </h3>
              <button onClick={() => setShowCompModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveComp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Nama Komponen / Spare Part *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RAM Server DDR4 ECC 32GB"
                  value={compForm.name}
                  onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Kategori Komponen *</label>
                  <select
                    value={compForm.category}
                    onChange={(e) => setCompForm({ ...compForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  >
                    <option value="RAM / Memory">RAM / Memory</option>
                    <option value="Storage / SSD">Storage / SSD</option>
                    <option value="Fiber Optic / SFP">Fiber Optic / SFP</option>
                    <option value="Kabel & Konektor">Kabel & Konektor</option>
                    <option value="Power Supply / Adaptor">Power Supply / Adaptor</option>
                    <option value="Consumable & Peripheral">Consumable & Peripheral</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Lokasi Penyimpanan Rak *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lemari Lab 1 (Rak A1)"
                    value={compForm.storage_location}
                    onChange={(e) => setCompForm({ ...compForm, storage_location: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Stok Saat Ini</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={compForm.stock_quantity}
                    onChange={(e) => setCompForm({ ...compForm, stock_quantity: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Batas Min. Alert</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={compForm.min_stock_alert}
                    onChange={(e) => setCompForm({ ...compForm, min_stock_alert: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Satuan Unit</label>
                  <input
                    type="text"
                    placeholder="Pcs, Roll, Box"
                    value={compForm.unit}
                    onChange={(e) => setCompForm({ ...compForm, unit: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    value={compForm.unit_price}
                    onChange={(e) => setCompForm({ ...compForm, unit_price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Kondisi Fisik</label>
                  <select
                    value={compForm.condition_status}
                    onChange={(e) => setCompForm({ ...compForm, condition_status: e.target.value as ITComponentCondition })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  >
                    <option value="Baru">Baru</option>
                    <option value="Bekas Bagus">Bekas Bagus</option>
                    <option value="Rusak / Rusak Part">Rusak / Rusak Part</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Simpan Komponen
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: ADJUST STOCK (IN / OUT / OPNAME) */}
      {/* ============================================================ */}
      {showAdjustStockModal && targetComponentForStock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Penyesuaian Stok Komponen
              </h3>
              <button onClick={() => setShowAdjustStockModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div><b>Komponen:</b> {targetComponentForStock.name}</div>
              <div><b>Stok Saat Ini:</b> <span style={{ color: '#38bdf8', fontWeight: 700 }}>{targetComponentForStock.stock_quantity} {targetComponentForStock.unit}</span></div>
            </div>

            <form onSubmit={handleSaveAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Jenis Transaksi</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setAdjustStockData({ ...adjustStockData, adjustType: 'in' })}
                    style={{ padding: '8px', borderRadius: '6px', border: adjustStockData.adjustType === 'in' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.2)', background: adjustStockData.adjustType === 'in' ? 'rgba(34,197,94,0.2)' : 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Tambah Stok (Masuk)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustStockData({ ...adjustStockData, adjustType: 'out' })}
                    style={{ padding: '8px', borderRadius: '6px', border: adjustStockData.adjustType === 'out' ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.2)', background: adjustStockData.adjustType === 'out' ? 'rgba(239,68,68,0.2)' : 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    - Kurangi Stok (Keluar)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Jumlah ({targetComponentForStock.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustStockData.quantity}
                  onChange={(e) => setAdjustStockData({ ...adjustStockData, quantity: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '14px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Keterangan / Alasan *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pembelian supplier baru / Penggantian darurat"
                  value={adjustStockData.notes}
                  onChange={(e) => setAdjustStockData({ ...adjustStockData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustStockModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: INSTALL COMPONENT TO ASSET */}
      {/* ============================================================ */}
      {showInstallModal && targetAssetForInstall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={18} style={{ color: '#38bdf8' }} /> Pasang Komponen ke Perangkat
              </h3>
              <button onClick={() => setShowInstallModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div><b>Perangkat Tujuan:</b> {targetAssetForInstall.name}</div>
              <div><b>Kode Aset:</b> <span style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{targetAssetForInstall.asset_code}</span> ({targetAssetForInstall.location})</div>
            </div>

            <form onSubmit={handleSaveInstall} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Pilih Komponen dari Stok Gudang *</label>
                <select
                  value={installData.componentId}
                  onChange={(e) => setInstallData({ ...installData, componentId: parseInt(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                >
                  <option value={0}>-- Pilih Komponen --</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.stock_quantity <= 0}>
                      [{c.component_code}] {c.name} — Stok: {c.stock_quantity} {c.unit} {c.stock_quantity <= 0 ? '(HABIS)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Jumlah Terpasang *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={installData.quantity}
                    onChange={(e) => setInstallData({ ...installData, quantity: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '14px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Slot / Posisi Pasang</label>
                  <input
                    type="text"
                    placeholder="e.g. DIMM 1, Drive Bay 0"
                    value={installData.slotOrPosition}
                    onChange={(e) => setInstallData({ ...installData, slotOrPosition: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Catatan Pemasangan</label>
                <input
                  type="text"
                  placeholder="e.g. Upgrade kapasitas RAM untuk server semester baru"
                  value={installData.notes}
                  onChange={(e) => setInstallData({ ...installData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 22px', borderRadius: '8px', background: '#38bdf8', border: 'none', color: '#0f172a', cursor: 'pointer', fontWeight: 800 }}
                >
                  Pasang Sekarang
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: REMOVE COMPONENT FROM ASSET */}
      {/* ============================================================ */}
      {showRemoveModal && targetAttachmentForRemove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f87171' }}>
                Lepas Komponen dari Perangkat
              </h3>
              <button onClick={() => setShowRemoveModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div><b>Komponen:</b> {targetAttachmentForRemove.quantity}x {targetAttachmentForRemove.component_name}</div>
              <div><b>Posisi Slot:</b> {targetAttachmentForRemove.slot_or_position || '-'}</div>
            </div>

            <form onSubmit={handleSaveRemove} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px' }}>
                  <input
                    type="checkbox"
                    checked={removeData.restock}
                    onChange={(e) => setRemoveData({ ...removeData, restock: e.target.checked })}
                  />
                  <span>Kembalikan part ini ke stok gudang (Restock)</span>
                </label>
              </div>

              {removeData.restock && (
                <div>
                  <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Kondisi Part Saat Masuk Gudang</label>
                  <select
                    value={removeData.conditionStatus}
                    onChange={(e) => setRemoveData({ ...removeData, conditionStatus: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                  >
                    <option value="Bekas Bagus">Bekas Bagus (Siap Pakai)</option>
                    <option value="Rusak / Rusak Part">Rusak / Perlu Servis</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>Alasan Pelepasan *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Upgrade memory baru / Komponen rusak"
                  value={removeData.reason}
                  onChange={(e) => setRemoveData({ ...removeData, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '13.5px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Konfirmasi Lepas Part
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 7: QR TAG PRINTER */}
      {/* ============================================================ */}
      {showQrModal && selectedQrAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', color: '#fff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: '#34d399' }} /> Label Stiker QR Aset
              </h3>
              <button onClick={() => setShowQrModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Printable Sticker Preview */}
            <div id="printable-asset-qr" style={{ background: '#fff', color: '#000', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '2px solid #6366f1' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#4f46e5' }}>
                PROPERTY OF UNTAG BANYUWANGI NMS
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, margin: '6px 0', color: '#000' }}>
                {selectedQrAsset.asset_code}
              </div>
              
              <div style={{ margin: '14px auto', width: '140px', height: '140px', background: '#000', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
                <QrCode size={105} />
                <div style={{ fontSize: '8px', marginTop: '4px', fontFamily: 'monospace' }}>SCAN FOR ASSET SPECS</div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedQrAsset.name}</div>
              <div style={{ fontSize: '11.5px', color: '#555', marginTop: '2px' }}>
                [{selectedQrAsset.category}] {selectedQrAsset.location}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#34d399', border: 'none', color: '#064e3b', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Printer size={16} /> Cetak Stiker
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
