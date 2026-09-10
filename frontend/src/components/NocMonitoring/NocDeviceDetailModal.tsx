import React, { useState, useEffect } from 'react';
import { 
  X, 
  Router, 
  Server, 
  Radio, 
  Wifi, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Thermometer, 
  Layers, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  HardDrive, 
  Search, 
  Activity, 
  Network, 
  Globe, 
  Sliders,
  Terminal
} from 'lucide-react';
import type { NocDevice } from '../../types/noc';
import { BACKEND_URL } from '../../App';
import { NocInterfaceStreamingModal } from './NocInterfaceStreamingModal';
import { NocDiagnostics } from './NocDiagnostics';

interface Props {
  device: NocDevice | null;
  onClose: () => void;
  token?: string;
}

export const NocDeviceDetailModal: React.FC<Props> = ({ device, onClose, token }) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'interfaces' | 'categorySpecific' | 'diagnostics'>('general');
  const [detailData, setDetailData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedIp, setCopiedIp] = useState<boolean>(false);
  const [interfaceSearch, setInterfaceSearch] = useState<string>('');
  const [interfaceTypeFilter, setInterfaceTypeFilter] = useState<'all' | 'ether' | 'vlan' | 'bridge' | 'pppoe'>('all');
  const [mikrotikSubView, setMikrotikSubView] = useState<'vlans' | 'pppoe' | 'dhcp' | 'firewall' | 'routing'>('vlans');
  const [pppoeSearch, setPppoeSearch] = useState<string>('');
  const [selectedInterfaceForStream, setSelectedInterfaceForStream] = useState<string | null>(null);

  useEffect(() => {
    if (!device) return;
    let isMounted = true;
    
    const fetchDetail = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${BACKEND_URL}/api/monitoring/devices/${device.id}/detail`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          setDetailData(data);
        }
      } catch (err) {
        console.error('Failed to fetch device detail:', err);
      } finally {
        if (showSpinner && isMounted) setLoading(false);
      }
    };

    fetchDetail(true);
    const interval = setInterval(() => fetchDetail(false), 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [device, token]);

  if (!device) return null;

  const handleCopyIp = () => {
    navigator.clipboard.writeText(device.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const getDeviceIcon = () => {
    switch (device.category) {
      case 'mikrotik':
        return <Router size={24} className="text-emerald-400" />;
      case 'olt':
        return <Server size={24} className="text-blue-400" />;
      case 'ap':
        return <Radio size={24} className="text-purple-400" />;
      default:
        return <Wifi size={24} className="text-amber-400" />;
    }
  };

  const getCategoryTabTitle = () => {
    switch (device.category) {
      case 'mikrotik':
        return 'VLANs, DHCP & Firewall';
      case 'olt':
        return 'PON Ports & ONUs';
      case 'ap':
        return 'Wi-Fi Radios & Clients';
      default:
        return 'Optical Signal & PPPoE';
    }
  };

  // Filter interfaces
  const rawInterfaces = detailData?.interfaces || [];
  const filteredInterfaces = rawInterfaces.filter((iface: any) => {
    if (interfaceTypeFilter === 'ether' && !iface.type?.toLowerCase().includes('ethernet') && !iface.rawName?.startsWith('ether')) return false;
    if (interfaceTypeFilter === 'vlan' && iface.type !== 'VLAN') return false;
    if (interfaceTypeFilter === 'bridge' && iface.type !== 'Bridge') return false;
    if (interfaceTypeFilter === 'pppoe' && !iface.name?.toLowerCase().includes('pppoe') && iface.type !== 'PPPoE Client') return false;

    if (interfaceSearch.trim()) {
      const q = interfaceSearch.toLowerCase();
      return (
        iface.name?.toLowerCase().includes(q) ||
        iface.rawName?.toLowerCase().includes(q) ||
        iface.type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="noc-modal-backdrop" onClick={onClose}>
      <div className="noc-device-detail-dialog glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="detail-modal-header">
          <div className="detail-header-left">
            <div className="device-avatar-wrap">
              {getDeviceIcon()}
            </div>
            <div className="device-titles">
              <div className="title-row">
                <h3>{device.name}</h3>
                <span className={`noc-badge badge-${device.status}`}>
                  {device.status.toUpperCase()}
                </span>
              </div>
              <div className="meta-sub-row">
                <span className="ip-badge" onClick={handleCopyIp} title="Click to copy IP">
                  <code>{device.ip}</code>
                  {copiedIp ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </span>
                <span className="text-xs text-slate-400">• {device.location}</span>
                <span className="text-xs text-slate-400">• Uptime: {device.uptime}</span>
              </div>
            </div>
          </div>

          <button className="detail-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="detail-sub-tabs">
          <button
            className={`detail-tab-btn ${activeSubTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('general')}
          >
            <Cpu size={16} /> System & Hardware Telemetry
          </button>
          <button
            className={`detail-tab-btn ${activeSubTab === 'interfaces' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('interfaces')}
          >
            <Layers size={16} /> Ports & Interfaces ({rawInterfaces.length})
          </button>
          <button
            className={`detail-tab-btn ${activeSubTab === 'categorySpecific' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('categorySpecific')}
          >
            <ShieldCheck size={16} /> {getCategoryTabTitle()}
          </button>
          <button
            className={`detail-tab-btn ${activeSubTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('diagnostics')}
          >
            <Terminal size={16} /> Live Diagnostics
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="detail-modal-body">
          {loading ? (
            <div className="detail-loading">
              <RefreshCw size={32} className="animate-spin text-cyan-400 mb-2" />
              <span>Fetching granular telemetry from Zabbix agent...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: GENERAL SYSTEM TELEMETRY */}
              {activeSubTab === 'general' && (
                <div className="detail-tab-content">
                  {/* Hardware Info Cards */}
                  <div className="hardware-cards-grid">
                    <div className="hw-info-card">
                      <span className="hw-label">DEVICE MODEL & OS</span>
                      <strong>{detailData?.hardware?.model || 'Enterprise Router / Node'}</strong>
                      <span className="hw-sub">{detailData?.hardware?.routerOsVersion || detailData?.hardware?.firmware || 'RouterOS v6.49.20'}</span>
                      {detailData?.hardware?.serialNumber && (
                        <span className="text-[11px] text-slate-400 mt-1">SN: <code>{detailData.hardware.serialNumber}</code></span>
                      )}
                    </div>

                    <div className="hw-info-card">
                      <span className="hw-label">SYSTEM HEALTH</span>
                      <div className="hw-health-row">
                        {detailData?.hardware?.temperatureBoard && (
                          <span className="pill-metric"><Thermometer size={14} /> Board: {detailData.hardware.temperatureBoard}°C</span>
                        )}
                        {detailData?.hardware?.temperatureCpu && (
                          <span className="pill-metric"><Cpu size={14} /> CPU: {detailData.hardware.temperatureCpu}°C</span>
                        )}
                        {detailData?.hardware?.voltage && (
                          <span className="pill-metric"><Zap size={14} /> {detailData.hardware.voltage} V</span>
                        )}
                      </div>
                    </div>

                    <div className="hw-info-card">
                      <span className="hw-label">MEMORY / RAM</span>
                      <div className="ram-usage-bar-wrap">
                        <div
                          className="ram-bar-fill bg-cyan-500"
                          style={{
                            width: `${
                              detailData?.hardware?.totalRamMb
                                ? Math.round(((detailData.hardware.totalRamMb - detailData.hardware.freeRamMb) / detailData.hardware.totalRamMb) * 100)
                                : 62
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-300">
                        {detailData?.hardware?.totalRamMb ? `${detailData.hardware.totalRamMb - detailData.hardware.freeRamMb} MB used of ${detailData.hardware.totalRamMb} MB (${Math.round(((detailData.hardware.totalRamMb - detailData.hardware.freeRamMb) / detailData.hardware.totalRamMb) * 100)}%)` : '637 MB of 1024 MB'}
                      </span>
                    </div>
                  </div>

                  {/* Storage Disks (NAND Flash & MicroSD/Storage) */}
                  {detailData?.storageDisks && (
                    <div className="storage-cards-grid mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detailData.storageDisks.map((disk: any, dIdx: number) => (
                        <div key={dIdx} className="hw-info-card glass-panel">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="hw-label flex items-center gap-1.5"><HardDrive size={13} className="text-cyan-400" /> {disk.name}</span>
                            <span className="text-xs font-bold text-slate-200">{disk.utilPercent}%</span>
                          </div>
                          <div className="ram-usage-bar-wrap">
                            <div
                              className={`ram-bar-fill ${disk.utilPercent > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, disk.utilPercent)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1">
                            {disk.totalMb > 1024 ? `${(disk.usedMb / 1024).toFixed(1)} GB used of ${(disk.totalMb / 1024).toFixed(1)} GB` : `${disk.usedMb} MB used of ${disk.totalMb} MB`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CPU Cores Load (Per-Core Distribution) */}
                  {detailData?.cpuCores && (
                    <div className="cpu-cores-panel glass-panel mt-3">
                      <div className="panel-title flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu size={16} className="text-cyan-400" />
                          <span>Per-Core CPU Load Distribution (4 Cores @ 1.4 GHz)</span>
                        </div>
                        <span className="text-xs text-slate-400">Annapurna Alpine AL21400</span>
                      </div>
                      <div className="cpu-cores-grid">
                        {detailData.cpuCores.map((c: any, i: number) => (
                          <div key={i} className="core-item">
                            <div className="core-header">
                              <span>{c.core}</span>
                              <strong className={c.load > 75 ? 'text-amber-400' : 'text-emerald-400'}>{c.load}%</strong>
                            </div>
                            <div className="core-bar-wrap">
                              <div
                                className={`core-bar-fill ${c.load > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, c.load)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ping Latency & Traffic KPIs */}
                  <div className="telemetry-summary-row mt-3">
                    <div className="telemetry-box">
                      <span className="box-label">ICMP PING LATENCY</span>
                      <strong className="text-cyan-400 text-xl">{device.pingMs} ms</strong>
                      <span className="text-xs text-slate-400">Response time round-trip</span>
                    </div>
                    <div 
                      className="telemetry-box cursor-pointer hover:border-cyan-500/50 transition-all group"
                      onClick={() => setSelectedInterfaceForStream('ether9')}
                      title="Klik untuk membuka Live Real-Time Telemetry Stream untuk ether9"
                    >
                      <div className="flex items-center justify-between">
                        <span className="box-label">LIVE INBOUND (DOWNLOAD)</span>
                        <Activity size={13} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <strong className="text-cyan-400 text-xl">{detailData?.trafficInMbps || device.trafficInMbps} Mbps</strong>
                      <span className="text-xs text-slate-400 flex items-center justify-between">
                        <span>Uplink Transit (ether9 iForte)</span>
                        <span className="text-[10px] text-cyan-400 font-bold underline">Live Chart ↗</span>
                      </span>
                    </div>
                    <div 
                      className="telemetry-box cursor-pointer hover:border-emerald-500/50 transition-all group"
                      onClick={() => setSelectedInterfaceForStream('ether9')}
                      title="Klik untuk membuka Live Real-Time Telemetry Stream untuk ether9"
                    >
                      <div className="flex items-center justify-between">
                        <span className="box-label">LIVE OUTBOUND (UPLOAD)</span>
                        <Activity size={13} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <strong className="text-emerald-400 text-xl">{detailData?.trafficOutMbps || device.trafficOutMbps} Mbps</strong>
                      <span className="text-xs text-slate-400 flex items-center justify-between">
                        <span>Uplink Transit (ether9 iForte)</span>
                        <span className="text-[10px] text-emerald-400 font-bold underline">Live Chart ↗</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INTERFACES & PORTS */}
              {activeSubTab === 'interfaces' && (
                <div className="detail-tab-content">
                  {/* Interface Search and Type Filters */}
                  <div className="noc-filter-bar">
                    <div className="noc-filter-pills">
                      <button
                        className={`noc-filter-btn ${interfaceTypeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setInterfaceTypeFilter('all')}
                      >
                        All Interfaces ({rawInterfaces.length})
                      </button>
                      <button
                        className={`noc-filter-btn ${interfaceTypeFilter === 'ether' ? 'active' : ''}`}
                        onClick={() => setInterfaceTypeFilter('ether')}
                      >
                        Ethernet Ports
                      </button>
                      <button
                        className={`noc-filter-btn ${interfaceTypeFilter === 'vlan' ? 'active' : ''}`}
                        onClick={() => setInterfaceTypeFilter('vlan')}
                      >
                        VLANs ({rawInterfaces.filter((i: any) => i.type === 'VLAN').length})
                      </button>
                      <button
                        className={`noc-filter-btn ${interfaceTypeFilter === 'bridge' ? 'active' : ''}`}
                        onClick={() => setInterfaceTypeFilter('bridge')}
                      >
                        Bridges
                      </button>
                      <button
                        className={`noc-filter-btn ${interfaceTypeFilter === 'pppoe' ? 'active' : ''}`}
                        onClick={() => setInterfaceTypeFilter('pppoe')}
                      >
                        PPPoE
                      </button>
                    </div>

                    <div className="noc-search-box">
                      <Search size={14} className="noc-search-icon" />
                      <input
                        type="text"
                        placeholder="Search interface, VLAN, port..."
                        value={interfaceSearch}
                        onChange={(e) => setInterfaceSearch(e.target.value)}
                        className="noc-search-input"
                      />
                    </div>
                  </div>

                  <div className="noc-table-wrap noc-table-scroll">
                    <table className="noc-table">
                      <thead>
                        <tr>
                          <th>Interface / Port Name</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Live Rx (Download)</th>
                          <th>Live Tx (Upload)</th>
                          <th>Packet Discards</th>
                          <th>MTU</th>
                          <th>Telemetry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInterfaces.length > 0 ? (
                          filteredInterfaces.map((iface: any, idx: number) => (
                            <tr 
                              key={idx} 
                              className="clickable-row"
                              onClick={() => setSelectedInterfaceForStream(iface.rawName || iface.name)}
                            >
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <code>{iface.name}</code>
                                    <Activity size={13} style={{ color: '#38bdf8', opacity: 0.8 }} />
                                  </div>
                                  {iface.alias && iface.alias !== iface.name && (
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{iface.alias}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`type-pill ${
                                  iface.type === 'VLAN' ? 'vlan' :
                                  iface.type === 'Bridge' ? 'bridge' :
                                  iface.type === 'PPPoE Client' ? 'pppoe' :
                                  'ether'
                                }`}>
                                  {iface.type}
                                </span>
                              </td>
                              <td>
                                <span className="noc-badge badge-healthy">
                                  <CheckCircle2 size={11} /> {iface.status.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ color: '#38bdf8', fontWeight: 700 }}>{iface.rxMbps} Mbps</td>
                              <td style={{ color: '#34d399', fontWeight: 700 }}>{iface.txMbps} Mbps</td>
                              <td style={{ color: '#94a3b8' }}>{iface.discards || 0}</td>
                              <td style={{ color: '#94a3b8' }}>{iface.mtu || 1500}</td>
                              <td>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInterfaceForStream(iface.rawName || iface.name);
                                  }}
                                  className="noc-live-chart-btn"
                                  title="Buka live streaming grafik real-time"
                                >
                                  <Activity size={12} /> Live Chart
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                              Tidak ada antarmuka yang cocok dengan pencarian.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: CATEGORY-SPECIFIC TELEMETRY */}
              {activeSubTab === 'categorySpecific' && (
                <div className="detail-tab-content">
                  {/* --- MIKROTIK: VLANs, PPPOE, DHCP, FIREWALL & ROUTING --- */}
                  {device.category === 'mikrotik' && (
                    <div className="mikrotik-deep-view">
                      {/* MikroTik Sub-View Selector */}
                      <div className="noc-subnav-bar">
                        <button
                          className={`noc-subnav-btn ${mikrotikSubView === 'vlans' ? 'active' : ''}`}
                          onClick={() => setMikrotikSubView('vlans')}
                        >
                          <Network size={14} /> VLANs ({detailData?.vlanSummary?.length || 0})
                        </button>
                        <button
                          className={`noc-subnav-btn ${mikrotikSubView === 'pppoe' ? 'active' : ''}`}
                          onClick={() => setMikrotikSubView('pppoe')}
                        >
                          <Layers size={14} /> PPPoE Tunnels ({detailData?.pppoeSummary?.length || 0})
                        </button>
                        <button
                          className={`noc-subnav-btn ${mikrotikSubView === 'dhcp' ? 'active' : ''}`}
                          onClick={() => setMikrotikSubView('dhcp')}
                        >
                          <Activity size={14} /> DHCP Server & Pools
                        </button>
                        <button
                          className={`noc-subnav-btn ${mikrotikSubView === 'firewall' ? 'active' : ''}`}
                          onClick={() => setMikrotikSubView('firewall')}
                        >
                          <ShieldCheck size={14} /> Firewall & NAT
                        </button>
                        <button
                          className={`noc-subnav-btn ${mikrotikSubView === 'routing' ? 'active' : ''}`}
                          onClick={() => setMikrotikSubView('routing')}
                        >
                          <Globe size={14} /> Routing & QoS Queues
                        </button>
                      </div>

                      {/* SUB-VIEW 1: VLAN SEGMENTS & REAL THROUGHPUT */}
                      {mikrotikSubView === 'vlans' && (
                        <div className="vlan-segments-view">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">TOTAL VLANs MONITORED</span>
                              <strong className="text-2xl text-cyan-400" style={{ color: '#38bdf8' }}>{detailData?.vlanSummary?.length || 10} Segmen</strong>
                              <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>UNTAG Campus Distribution</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">TOP VLAN TRAFFIC</span>
                              <strong className="text-2xl text-emerald-400" style={{ color: '#34d399' }}>
                                {detailData?.vlanSummary && detailData.vlanSummary[0] ? `${detailData.vlanSummary[0].totalMbps} Mbps` : '8.95 Mbps'}
                              </strong>
                              <span className="text-xs text-slate-400 truncate" style={{ color: '#94a3b8' }}>{detailData?.vlanSummary && detailData.vlanSummary[0] ? detailData.vlanSummary[0].name : 'vlan156-perpenas'}</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">HOTSPOT VLAN</span>
                              <strong className="text-2xl text-purple-400" style={{ color: '#c084fc' }}>
                                {detailData?.vlanSummary?.find((v: any) => v.name.includes('hotspot'))?.totalMbps || '5.79'} Mbps
                              </strong>
                              <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>vlan145-hotspot (Untag Hotspot)</span>
                            </div>
                          </div>

                          <div className="sub-table-card glass-panel">
                            <div className="sub-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Live VLAN Traffic & Utilization Matrix</span>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Klik baris VLAN untuk melihat Live Telemetry Real-Time</span>
                            </div>
                            <div className="noc-table-wrap">
                              <table className="noc-table">
                                <thead>
                                  <tr>
                                    <th>VLAN Name / Segment</th>
                                    <th>Inbound (Download)</th>
                                    <th>Outbound (Upload)</th>
                                    <th>Total Traffic</th>
                                    <th>Status</th>
                                    <th>Telemetry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(detailData?.vlanSummary || []).map((v: any, vIdx: number) => (
                                    <tr 
                                      key={vIdx}
                                      className="clickable-row"
                                      onClick={() => setSelectedInterfaceForStream(v.rawName || v.name)}
                                    >
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <code>{v.name}</code>
                                          <Activity size={13} style={{ color: '#38bdf8', opacity: 0.8 }} />
                                        </div>
                                      </td>
                                      <td style={{ color: '#38bdf8', fontWeight: 700 }}>{v.rxMbps} Mbps</td>
                                      <td style={{ color: '#34d399', fontWeight: 700 }}>{v.txMbps} Mbps</td>
                                      <td style={{ color: '#f8fafc', fontWeight: 700 }}>{v.totalMbps} Mbps</td>
                                      <td><span className="noc-badge badge-healthy"><CheckCircle2 size={11} /> ACTIVE</span></td>
                                      <td>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedInterfaceForStream(v.rawName || v.name);
                                          }}
                                          className="noc-live-chart-btn"
                                          title="Buka live streaming grafik real-time"
                                        >
                                          <Activity size={12} /> Live Chart
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SUB-VIEW 2: PPPOE & BRANCH TUNNELS */}
                      {mikrotikSubView === 'pppoe' && (
                        <div className="pppoe-tunnels-view">
                          {(() => {
                            const rawPppoe = detailData?.pppoeSummary || [];
                            const activeCount = rawPppoe.filter((p: any) => p.status === 'running').length;
                            const downCount = rawPppoe.length - activeCount;
                            const totalBw = rawPppoe.reduce((acc: number, p: any) => acc + (p.totalMbps || 0), 0);
                            const filteredPppoe = rawPppoe.filter((p: any) => {
                              if (!pppoeSearch.trim()) return true;
                              const q = pppoeSearch.toLowerCase();
                              return (
                                p.name?.toLowerCase().includes(q) ||
                                p.unit?.toLowerCase().includes(q) ||
                                p.type?.toLowerCase().includes(q)
                              );
                            });

                            return (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                  <div className="mkt-card glass-panel">
                                    <span className="mkt-card-title">TOTAL TUNNELS</span>
                                    <strong className="text-2xl text-cyan-400" style={{ color: '#38bdf8' }}>{rawPppoe.length} Tunnels</strong>
                                    <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Department & Branch Links</span>
                                  </div>
                                  <div className="mkt-card glass-panel">
                                    <span className="mkt-card-title">ONLINE / RUNNING</span>
                                    <strong className="text-2xl text-emerald-400" style={{ color: '#34d399' }}>{activeCount} Active</strong>
                                    <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Authenticated & Connected</span>
                                  </div>
                                  <div className="mkt-card glass-panel">
                                    <span className="mkt-card-title">OFFLINE / DORMANT</span>
                                    <strong className="text-2xl text-rose-400" style={{ color: '#fb7185' }}>{downCount} Offline</strong>
                                    <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Waiting Authentication</span>
                                  </div>
                                  <div className="mkt-card glass-panel">
                                    <span className="mkt-card-title">AGGREGATE TUNNEL BW</span>
                                    <strong className="text-2xl text-purple-400" style={{ color: '#c084fc' }}>{totalBw.toFixed(2)} Mbps</strong>
                                    <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Combined Live Throughput</span>
                                  </div>
                                </div>

                                <div className="sub-table-card glass-panel">
                                  <div className="sub-table-header noc-filter-bar">
                                    <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Departmental PPPoE & PPTP Client Tunnels</span>
                                    <div className="noc-search-box">
                                      <Search size={13} className="noc-search-icon" />
                                      <input
                                        type="text"
                                        placeholder="Search tunnel or unit..."
                                        value={pppoeSearch}
                                        onChange={(e) => setPppoeSearch(e.target.value)}
                                        className="noc-search-input"
                                      />
                                    </div>
                                  </div>
                                  <div className="noc-table-wrap noc-table-scroll">
                                    <table className="noc-table">
                                      <thead>
                                        <tr>
                                          <th>Tunnel Name / Interface</th>
                                          <th>Unit / Location</th>
                                          <th>Type</th>
                                          <th>Status</th>
                                          <th>Download (Rx)</th>
                                          <th>Upload (Tx)</th>
                                          <th>Total Traffic</th>
                                          <th>Telemetry</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredPppoe.length > 0 ? (
                                          filteredPppoe.map((p: any, pIdx: number) => (
                                            <tr 
                                              key={pIdx} 
                                              className="clickable-row"
                                              onClick={() => setSelectedInterfaceForStream(p.rawName || p.name)}
                                            >
                                              <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <code>{p.name}</code>
                                                  <Activity size={13} style={{ color: '#38bdf8', opacity: 0.8 }} />
                                                </div>
                                              </td>
                                              <td style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.unit}</td>
                                              <td>
                                                <span className="type-pill pppoe">
                                                  {p.type || 'PPPoE Client'}
                                                </span>
                                              </td>
                                              <td>
                                                <span className={`noc-badge ${p.status === 'running' ? 'badge-healthy' : 'badge-offline'}`}>
                                                  {p.status === 'running' ? 'CONNECTED' : 'OFFLINE'}
                                                </span>
                                              </td>
                                              <td style={{ color: '#38bdf8', fontWeight: 700 }}>{p.rxMbps} Mbps</td>
                                              <td style={{ color: '#34d399', fontWeight: 700 }}>{p.txMbps} Mbps</td>
                                              <td style={{ color: '#f8fafc', fontWeight: 700 }}>{p.totalMbps} Mbps</td>
                                              <td>
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedInterfaceForStream(p.rawName || p.name);
                                                  }}
                                                  className="noc-live-chart-btn"
                                                  title="Buka live streaming grafik real-time"
                                                >
                                                  <Activity size={12} /> Live Chart
                                                </button>
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                              Tidak ada tunnel yang cocok dengan pencarian.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* SUB-VIEW 3: DHCP SERVER & LEASES */}
                      {mikrotikSubView === 'dhcp' && (
                        <div className="dhcp-server-view">
                          {/* DHCP Pool Counters */}
                          <div className="mikrotik-counters-row">
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">ACTIVE DHCP LEASES</span>
                              <strong className="text-2xl text-cyan-400">{detailData?.dhcpServer?.activeLeases || 346}</strong>
                              <span className="text-xs text-slate-400">Total Bound Clients</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">DHCP POOLS</span>
                              <strong className="text-2xl text-emerald-400">{detailData?.dhcpServer?.pools?.length || 3} Pools</strong>
                              <span className="text-xs text-slate-400">pool-civitas-untag, kantor, baak</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">TOTAL LEASES RECORDED</span>
                              <strong className="text-2xl text-purple-400">{detailData?.dhcpServer?.totalLeases || 482}</strong>
                              <span className="text-xs text-slate-400">Bound + Static Clients</span>
                            </div>
                          </div>

                          {/* Sample DHCP Leases Table */}
                          <div className="sub-table-card glass-panel mt-3">
                            <div className="sub-table-header" style={{ marginBottom: '0.75rem' }}>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Live Bound Clients (Sample Active Leases)</span>
                            </div>
                            <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '220px' }}>
                              <table className="noc-table">
                                <thead>
                                  <tr>
                                    <th>IP Address</th>
                                    <th>MAC Address</th>
                                    <th>Hostname / Device</th>
                                    <th>Status</th>
                                    <th>Lease Expires</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(detailData?.dhcpServer?.sampleLeases || []).map((l: any, i: number) => (
                                    <tr key={i}>
                                      <td><code>{l.ip}</code></td>
                                      <td><code style={{ color: '#94a3b8' }}>{l.mac}</code></td>
                                      <td style={{ color: '#e2e8f0', fontWeight: 600 }}>{l.hostname}</td>
                                      <td><span className="noc-badge badge-healthy">{l.status.toUpperCase()}</span></td>
                                      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{l.expires}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SUB-VIEW 4: FIREWALL, NAT & SECURITY */}
                      {mikrotikSubView === 'firewall' && (
                        <div className="firewall-security-view">
                          <div className="mikrotik-counters-row">
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">FIREWALL ACTIVE CONNECTIONS</span>
                              <strong className="text-2xl text-emerald-400" style={{ color: '#34d399' }}>{detailData?.firewall?.activeConnections?.toLocaleString() || '18,450'}</strong>
                              <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Connection Tracking Table</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">FASTTRACK ACCELERATION</span>
                              <strong className="text-2xl text-cyan-400" style={{ color: '#38bdf8' }}>125,000 pps</strong>
                              <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Hardware FastPath</span>
                            </div>
                            <div className="mkt-card glass-panel">
                              <span className="mkt-card-title">DROPPED ATTACKS / HOUR</span>
                              <strong className="text-2xl text-rose-400" style={{ color: '#fb7185' }}>{detailData?.firewall?.droppedPacketsLastHour?.toLocaleString() || '14,209'}</strong>
                              <span className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>Invalid / Blocked Packets</span>
                            </div>
                          </div>

                          {/* NAT Rules Table */}
                          <div className="sub-table-card glass-panel mt-3">
                            <div className="sub-table-header" style={{ marginBottom: '0.75rem' }}>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Active Firewall NAT & Port Forwarding Rules</span>
                            </div>
                            <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '240px' }}>
                              <table className="noc-table">
                                <thead>
                                  <tr>
                                    <th>Rule ID</th>
                                    <th>Action</th>
                                    <th>Chain</th>
                                    <th>Interface / Target</th>
                                    <th>Packets Matched</th>
                                    <th>Traffic Processed</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(detailData?.firewall?.topNatRules || []).map((r: any, rIdx: number) => (
                                    <tr key={rIdx}>
                                      <td><code>#{r.id}</code></td>
                                      <td>
                                        <span className={`type-pill ${
                                          r.action === 'masquerade' ? 'bridge' :
                                          r.action === 'dst-nat' ? 'vlan' :
                                          'pppoe'
                                        }`}>
                                          {r.action.toUpperCase()}
                                        </span>
                                      </td>
                                      <td><code style={{ color: '#cbd5e1' }}>{r.chain}</code></td>
                                      <td style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.outInterface || r.toAddress || r.comment}</td>
                                      <td style={{ color: '#38bdf8', fontWeight: 700 }}>{r.packets}</td>
                                      <td style={{ color: '#34d399', fontWeight: 700 }}>{r.bytes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SUB-VIEW 5: ROUTING & QOS QUEUES */}
                      {mikrotikSubView === 'routing' && (
                        <div className="routing-qos-view">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {/* Routing Overview */}
                            <div className="sub-table-card glass-panel">
                              <div className="sub-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Globe size={14} style={{ color: '#38bdf8' }} /> IP Routing & Gateways
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{detailData?.routingSummary?.activeRoutesCount || 42} Active Routes</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.6)' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>DEFAULT WAN GATEWAY (ISP)</span>
                                  <code style={{ color: '#34d399', fontWeight: 700 }}>{detailData?.routingSummary?.defaultGateway || '103.92.209.1 (ether9 - iforte)'}</code>
                                </div>
                                <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.6)' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>LOCAL SUBNETS & VLANS</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {(detailData?.routingSummary?.lanSubnets || [
                                      '192.168.44.0/24 (Distribution/Modem Perpenas)',
                                      '10.10.0.0/16 (Internal Campus & Server Network)',
                                      '10.50.0.0/22 (Civitas Hotspot Wireless)',
                                      '192.168.10.0/24 (Management OLT C-Data)',
                                    ]).map((sn: string, sIdx: number) => (
                                      <div key={sIdx} style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
                                        {sn}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>DNS RESOLVERS:</span>
                                  <code>{detailData?.routingSummary?.dnsServers?.join(', ') || '103.92.209.1, 8.8.8.8, 1.1.1.1'}</code>
                                </div>
                              </div>
                            </div>

                            {/* QoS Simple Queues Table */}
                            <div className="sub-table-card glass-panel">
                              <div className="sub-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Sliders size={14} style={{ color: '#38bdf8' }} /> Bandwidth Management (Simple Queues)
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>QoS Traffic Shaping</span>
                              </div>
                              <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '220px' }}>
                                <table className="noc-table">
                                  <thead>
                                    <tr>
                                      <th>Queue Name</th>
                                      <th>Target</th>
                                      <th>Max Limit</th>
                                      <th>Priority</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(detailData?.queuesSummary || []).map((q: any, qIdx: number) => (
                                      <tr key={qIdx}>
                                        <td><code>{q.name}</code></td>
                                        <td style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{q.target}</td>
                                        <td style={{ color: '#34d399', fontWeight: 700 }}>{q.maxLimit}</td>
                                        <td>
                                          <span className="type-pill ether">
                                            P-{q.priority}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- OLT GPON: PON PORTS MATRIX & REGISTERED ONUS --- */}
                  {device.category === 'olt' && (
                    <div className="olt-deep-view">
                      <div className="pon-ports-grid">
                        {(detailData?.ponPorts || []).map((pon: any, i: number) => (
                          <div key={i} className={`pon-card glass-panel ${pon.status === 'warning' ? 'pon-warn' : ''}`}>
                            <div className="pon-card-top">
                              <strong>{pon.port}</strong>
                              <span className={`noc-badge ${pon.status === 'warning' ? 'badge-warning' : 'badge-healthy'}`}>
                                {pon.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="pon-metrics">
                              <span>ONUs: <strong>{pon.onlineOnu} / {pon.registeredOnu}</strong> online</span>
                              <span>Tx: <strong style={{ color: '#34d399' }}>{pon.txPowerDbm} dBm</strong></span>
                              <span>Rx Margin: <strong style={{ color: pon.rxMarginAvgDbm < -26 ? '#fbbf24' : '#38bdf8' }}>{pon.rxMarginAvgDbm} dBm</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Registered ONUs Sample */}
                      <div className="sub-table-card glass-panel mt-4">
                        <div className="sub-table-header" style={{ marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Registered ONU Optical Telemetry</span>
                        </div>
                        <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '260px' }}>
                          <table className="noc-table">
                            <thead>
                              <tr>
                                <th>ONU ID</th>
                                <th>Customer Name</th>
                                <th>GPON Serial Number</th>
                                <th>Rx Optical Signal (dBm)</th>
                                <th>Distance (m)</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(detailData?.onusSample || []).map((onu: any, i: number) => (
                                <tr key={i}>
                                  <td><code>{onu.onuId}</code></td>
                                  <td style={{ fontWeight: 700, color: '#f8fafc' }}>{onu.name}</td>
                                  <td><code>{onu.sn}</code></td>
                                  <td>
                                    <span style={{ fontWeight: 800, color: onu.rxPowerDbm < -27 ? '#fb7185' : '#34d399' }}>
                                      {onu.rxPowerDbm} dBm
                                    </span>
                                  </td>
                                  <td style={{ color: '#94a3b8' }}>{onu.distanceM} m</td>
                                  <td>
                                    <span className={`noc-badge ${onu.status.includes('LOS') ? 'badge-disaster' : onu.status.includes('Warning') ? 'badge-warning' : 'badge-healthy'}`}>
                                      {onu.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- ACCESS POINT: RADIOS & CONNECTED CLIENTS --- */}
                  {device.category === 'ap' && (
                    <div className="ap-deep-view">
                      {/* Radios Grid */}
                      <div className="radios-grid">
                        {(detailData?.radios || []).map((r: any, i: number) => (
                          <div key={i} className="radio-card glass-panel">
                            <div className="radio-title">
                              <Radio size={16} style={{ color: '#c084fc' }} />
                              <strong>{r.band}</strong>
                            </div>
                            <div className="radio-stats-grid">
                              <div>Channel: <strong>{r.channel} ({r.channelWidth})</strong></div>
                              <div>Tx Power: <strong>{r.txPowerDbm} dBm</strong></div>
                              <div>Clients: <strong style={{ color: '#c084fc' }}>{r.clients} Users</strong></div>
                              <div>Channel Util: <strong>{r.channelUtilization}%</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Connected Wi-Fi Clients Table */}
                      <div className="sub-table-card glass-panel mt-4">
                        <div className="sub-table-header" style={{ marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Connected Wi-Fi Clients ({detailData?.clientsSample?.length || 4} of {device.connectedClients || 84})</span>
                        </div>
                        <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '260px' }}>
                          <table className="noc-table">
                            <thead>
                              <tr>
                                <th>Hostname / User Device</th>
                                <th>IP Address</th>
                                <th>MAC Address</th>
                                <th>SSID Network</th>
                                <th>Signal (RSSI)</th>
                                <th>PHY Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(detailData?.clientsSample || []).map((c: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 700, color: '#f8fafc' }}>{c.hostname}</td>
                                  <td><code>{c.ip}</code></td>
                                  <td><code style={{ color: '#94a3b8' }}>{c.mac}</code></td>
                                  <td><span className="type-pill vlan">{c.ssid}</span></td>
                                  <td><span style={{ color: '#34d399', fontWeight: 800 }}>{c.rssiDbm} dBm</span></td>
                                  <td style={{ color: '#38bdf8' }}>{c.txRate}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- ONT / MODEM: OPTICAL HEALTH & WAN PPPOE --- */}
                  {device.category === 'ont' && (
                    <div className="ont-deep-view">
                      <div className="ont-optical-banner glass-panel">
                        <div className="optical-gauge-col">
                          <span className="text-xs text-slate-400">RX OPTICAL POWER (REDAMAN)</span>
                          {detailData?.opticalHealth?.rxOpticalPowerDbm !== null && detailData?.opticalHealth?.rxOpticalPowerDbm !== undefined ? (
                            <strong className={`text-3xl font-extrabold ${device.status === 'down' ? 'text-rose-500' : detailData.opticalHealth.rxOpticalPowerDbm < -27 ? 'text-amber-400' : 'text-emerald-400'}`} style={{ color: detailData.opticalHealth.rxOpticalPowerDbm < -27 ? '#fbbf24' : '#34d399' }}>
                              {detailData.opticalHealth.rxOpticalPowerDbm} dBm
                            </strong>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <strong style={{ fontSize: '1.2rem', fontWeight: 700, color: '#94a3b8' }}>N/A (Belum Terpetakan)</strong>
                              <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>⚠️ Item OID Redaman belum ada di Zabbix host ini</span>
                            </div>
                          )}
                          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                            Status Sinyal: <strong>{detailData?.opticalHealth?.signalQuality || (device.status === 'down' ? 'DOWN' : 'NORMAL')}</strong>
                          </span>
                        </div>
                        <div className="optical-telemetry-col">
                          <div>Tx Power: <strong>{detailData?.opticalHealth?.txOpticalPowerDbm !== null && detailData?.opticalHealth?.txOpticalPowerDbm !== undefined ? `${detailData.opticalHealth.txOpticalPowerDbm} dBm` : '-'}</strong></div>
                          <div>Supply Voltage: <strong>{detailData?.opticalHealth?.voltageV !== null && detailData?.opticalHealth?.voltageV !== undefined ? `${detailData.opticalHealth.voltageV} V` : '-'}</strong></div>
                          <div>Laser Temp: <strong>{detailData?.opticalHealth?.temperatureC !== null && detailData?.opticalHealth?.temperatureC !== undefined ? `${detailData.opticalHealth.temperatureC} °C` : '-'}</strong></div>
                          <div>Laser Bias: <strong>{detailData?.opticalHealth?.biasCurrentMa !== null && detailData?.opticalHealth?.biasCurrentMa !== undefined ? `${detailData.opticalHealth.biasCurrentMa} mA` : '-'}</strong></div>
                        </div>
                      </div>

                      {/* DHCP LEASES & USER TERKONEKSI MODEM */}
                      <div className="ont-dhcp-card glass-panel mt-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.88rem' }}>Klien LAN & Wi-Fi Lokal Modem</span>
                            <span className="tab-pill-metric">{detailData?.dhcpServer?.activeLeases || 0} User Lokal Terkoneksi</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Subnet LAN: <code>{detailData?.dhcpServer?.subnet || '192.168.1.0/24 (LAN Lokal)'}</code></span>
                        </div>

                        <div className="dhcp-leases-table-wrap">
                          {detailData?.dhcpServer?.sampleLeases && detailData.dhcpServer.sampleLeases.length > 0 ? (
                            <div className="noc-table-wrap noc-table-scroll" style={{ maxHeight: '220px' }}>
                              <table className="noc-table">
                                <thead>
                                  <tr>
                                    <th>IP Address</th>
                                    <th>MAC Address</th>
                                    <th>Hostname / Nama Perangkat</th>
                                    <th>Status Sewa</th>
                                    <th>Masa Aktif</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailData.dhcpServer.sampleLeases.map((lease: any, idx: number) => (
                                    <tr key={idx}>
                                      <td><code>{lease.ip}</code></td>
                                      <td><code style={{ color: '#94a3b8' }}>{lease.mac}</code></td>
                                      <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{lease.hostname}</td>
                                      <td>
                                        <span className={`noc-badge ${lease.status === 'bound' ? 'badge-healthy' : 'badge-info'}`}>
                                          {lease.status.toUpperCase()}
                                        </span>
                                      </td>
                                      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{lease.expires}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle2 size={24} style={{ color: '#64748b', marginBottom: '4px' }} />
                              <span style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '0.85rem' }}>
                                {detailData?.dhcpServer?.hasSnmpItem
                                  ? `Terdapat ${detailData.dhcpServer.activeLeases} user lokal yang terhubung ke Wi-Fi / LAN modem ini.`
                                  : 'Item OID SNMP Klien Wi-Fi / ARP Table belum terdaftar di Zabbix host modem ini.'}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.75rem', maxWidth: '520px', lineHeight: '1.5' }}>
                                Klien HP/Laptop di dalam kelas terhubung ke subnet lokal privat modem (mode NAT). Router MikroTik Pusat hanya melihat modem ini sebagai 1 IP WAN (<code>{device.ip}</code>).
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PPPoE & LAN Ports */}
                      <div className="ont-network-row mt-4">
                        <div className="ont-wan-card glass-panel">
                          <span className="font-bold text-slate-200">PPPoE WAN Status</span>
                          <div className="wan-detail-list">
                            <div>Username: <code>{detailData?.wanStatus?.username || 'pelanggan@untag.net'}</code></div>
                            <div>WAN IP: <code>{detailData?.wanStatus?.wanIp || device.ip}</code></div>
                            <div>Gateway: <code>{detailData?.wanStatus?.gateway || '10.200.1.1'}</code></div>
                            <div>DNS Servers: <code>{detailData?.wanStatus?.primaryDns}, {detailData?.wanStatus?.secondaryDns}</code></div>
                          </div>
                        </div>

                        <div className="ont-lan-card glass-panel">
                          <span className="font-bold text-slate-200">LAN Ports & Wi-Fi</span>
                          <div className="lan-ports-list">
                            {(detailData?.lanPorts || []).map((p: any, i: number) => (
                              <div key={i} className="lan-item">
                                <span>{p.port}</span>
                                <span className={p.status.includes('Connected') ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                                  {p.status}
                                </span>
                              </div>
                            ))}
                            <div className="wifi-status-row">
                              <span>Wi-Fi SSID: <strong>{detailData?.wifiStatus?.ssid || device.name}</strong></span>
                              <span className="text-cyan-400 font-bold">{detailData?.wifiStatus?.activeClients || 0} User Terkoneksi</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === 'diagnostics' && (
                <div className="detail-diag-wrapper">
                  <NocDiagnostics
                    initialTarget={device.ip}
                    initialTool="ping"
                    token={token}
                    isCompact={true}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* REAL-TIME INTERFACE TELEMETRY STREAMING MODAL */}
      {selectedInterfaceForStream && (
        <NocInterfaceStreamingModal
          deviceId={device.id}
          deviceName={device.name}
          interfaceName={selectedInterfaceForStream}
          onClose={() => setSelectedInterfaceForStream(null)}
          token={token}
        />
      )}
    </div>
  );
};
