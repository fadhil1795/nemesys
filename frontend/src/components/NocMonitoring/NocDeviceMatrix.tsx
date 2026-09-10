import React, { useState } from 'react';
import { 
  Router, 
  Server, 
  Radio, 
  Wifi, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MapPin 
} from 'lucide-react';
import type { NocDevice, NocDeviceCategory } from '../../types/noc';

interface Props {
  devices: NocDevice[];
  onSelectDevice?: (dev: NocDevice) => void;
}

export const NocDeviceMatrix: React.FC<Props> = ({ devices, onSelectDevice }) => {
  const [selectedCategory, setSelectedCategory] = useState<NocDeviceCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'healthy' | 'warning' | 'down'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDevices = devices.filter((d) => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && d.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getDeviceIcon = (cat: string) => {
    switch (cat) {
      case 'mikrotik':
        return <Router size={16} className="text-emerald-400" />;
      case 'olt':
        return <Server size={16} className="text-blue-400" />;
      case 'ap':
        return <Radio size={16} className="text-purple-400" />;
      default:
        return <Wifi size={16} className="text-amber-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <span className="noc-badge badge-healthy"><CheckCircle2 size={12} /> UP</span>;
      case 'warning':
        return <span className="noc-badge badge-warning"><AlertTriangle size={12} /> WARN</span>;
      case 'down':
        return <span className="noc-badge badge-disaster animate-pulse"><XCircle size={12} /> DOWN</span>;
      default:
        return <span className="noc-badge badge-info">{status}</span>;
    }
  };

  return (
    <div className="noc-device-matrix-view">
      {/* Category Tabs */}
      <div className="matrix-tabs-bar glass-panel">
        <div className="category-tabs">
          <button
            className={`cat-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Nodes ({devices.length})
          </button>
          <button
            className={`cat-tab ${selectedCategory === 'mikrotik' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('mikrotik')}
          >
            <Router size={15} /> Mikrotik Routers ({devices.filter((d) => d.category === 'mikrotik').length})
          </button>
          <button
            className={`cat-tab ${selectedCategory === 'server' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('server')}
          >
            <Server size={15} /> Servers & Linux ({devices.filter((d) => d.category === 'server').length})
          </button>
          {devices.some((d) => d.category === 'olt') && (
            <button
              className={`cat-tab ${selectedCategory === 'olt' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('olt')}
            >
              <Server size={15} /> OLT GPON ({devices.filter((d) => d.category === 'olt').length})
            </button>
          )}
          {devices.some((d) => d.category === 'ap') && (
            <button
              className={`cat-tab ${selectedCategory === 'ap' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ap')}
            >
              <Radio size={15} /> Access Points ({devices.filter((d) => d.category === 'ap').length})
            </button>
          )}
          {devices.some((d) => d.category === 'ont') && (
            <button
              className={`cat-tab ${selectedCategory === 'ont' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ont')}
            >
              <Wifi size={15} /> Modems / ONTs ({devices.filter((d) => d.category === 'ont').length})
            </button>
          )}
        </div>

        {/* Search and Status Dropdown */}
        <div className="matrix-search-wrap">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="noc-select"
          >
            <option value="all">All Status</option>
            <option value="healthy">Healthy Only</option>
            <option value="warning">Warning Only</option>
            <option value="down">Down Only</option>
          </select>

          <div className="search-box-wrap">
            <Search size={15} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search by device name, IP, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="noc-search-input"
            />
          </div>
        </div>
      </div>

      {/* Device Table Matrix */}
      <div className="matrix-table-card glass-panel">
        <div className="table-responsive">
          <table className="noc-table">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Category</th>
                <th>IP Address</th>
                <th>Physical Location</th>
                <th>Latency (Ping)</th>
                <th>Device Telemetry</th>
                <th>Live Traffic</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((dev) => (
                <tr
                  key={dev.id}
                  className={`dev-row row-status-${dev.status} cursor-pointer hover:bg-slate-800/60`}
                  onClick={() => onSelectDevice && onSelectDevice(dev)}
                  title="Click to view detailed device telemetry"
                >
                  <td>
                    <div className="dev-name-col">
                      {getDeviceIcon(dev.category)}
                      <div className="dev-name-wrapper">
                        <strong>{dev.name}</strong>
                        {(dev.lastSeen === 'Live Zabbix' || /^\d+$/.test(dev.id)) && (
                          <span className="live-zabbix-tag">
                            Live Zabbix
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs uppercase font-bold text-slate-300">
                      {dev.category}
                    </span>
                  </td>
                  <td>
                    <code className="text-cyan-300 font-mono">{dev.ip}</code>
                  </td>
                  <td>
                    <div className="location-cell text-slate-300">
                      <MapPin size={13} className="text-slate-400" />
                      <span>{dev.location}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`font-semibold ${
                        dev.pingMs === 0
                          ? 'text-slate-500'
                          : dev.pingMs > 20
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {dev.pingMs > 0 ? `${dev.pingMs} ms` : 'Timeout'}
                    </span>
                  </td>
                  <td>
                    <div className="telemetry-tags">
                      {dev.cpuPercent !== undefined && (
                        <span className="telemetry-pill">
                          CPU: <strong>{dev.cpuPercent}%</strong>
                        </span>
                      )}
                      {dev.opticalDbm !== undefined && (
                        <span
                          className={`telemetry-pill ${
                            dev.opticalDbm < -27 ? 'pill-alert' : 'pill-ok'
                          }`}
                        >
                          Rx: <strong>{dev.opticalDbm} dBm</strong>
                        </span>
                      )}
                      {dev.txOpticalDbm !== undefined && (
                        <span className="telemetry-pill">
                          Tx: <strong>{dev.txOpticalDbm} dBm</strong>
                        </span>
                      )}
                      {dev.packetLossPercent !== undefined && dev.packetLossPercent > 0 && (
                        <span className="telemetry-pill pill-alert">
                          Loss: <strong>{dev.packetLossPercent}%</strong>
                        </span>
                      )}
                      {dev.supplyVoltageV !== undefined && (
                        <span className="telemetry-pill">
                          Volt: <strong>{dev.supplyVoltageV}V</strong>
                        </span>
                      )}
                      {dev.connectedClients !== undefined && (
                        <span className="telemetry-pill">
                          Users: <strong>{dev.connectedClients}</strong>
                        </span>
                      )}
                      {dev.totalOnuCount !== undefined && (
                        <span className="telemetry-pill">
                          ONUs: <strong>{dev.totalOnuCount}</strong>
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="traffic-col-val">
                      <span className="text-cyan-400 text-xs">↓ {dev.trafficInMbps} Mbps</span>
                      <span className="text-emerald-400 text-xs">↑ {dev.trafficOutMbps} Mbps</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(dev.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
