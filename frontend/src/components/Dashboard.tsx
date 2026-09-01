import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, ClipboardList, Clock, Wifi, Server, AlertCircle } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { BACKEND_URL } from '../App';
import type { Device, DailyTask, GenieACSDevice } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DashboardProps {
  devices: Device[];
  tasks: DailyTask[];
  onTriggerAlert: () => void;
  onNavigate: (menu: string) => void;
  token?: string;
}

interface GacsStats {
  total: number;
  online: number;
  offline: number;
}

interface UplinkStats {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  no_signal: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ devices, tasks, onTriggerAlert, onNavigate, token }) => {
  const [gacsStats, setGacsStats] = useState<GacsStats | null>(null);
  const [uplinkStats, setUplinkStats] = useState<UplinkStats | null>(null);
  const [recentDevices, setRecentDevices] = useState<GenieACSDevice[]>([]);
  const [gacsError, setGacsError] = useState('');
  const [loadingGacs, setLoadingGacs] = useState(false);

  const totalDevices = devices.length;
  const upDevices = devices.filter((d) => d.status === 'Up').length;
  const downDevices = totalDevices - upDevices;
  const activeTasks = tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Rejected').length;
  
  const completedTasks = tasks.filter((t) => t.status === 'Completed');
  const avgMTTR = completedTasks.length > 0 
    ? Math.round(completedTasks.reduce((acc, t) => {
        const diff = new Date(t.completed_at!).getTime() - new Date(t.started_at).getTime();
        return acc + diff / 60000;
      }, 0) / completedTasks.length)
    : 15;

  const fetchGacsData = useCallback(async () => {
    if (!token) return;
    setLoadingGacs(true);
    setGacsError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [rStats, rUplink, rRecent] = await Promise.all([
        fetch(`${BACKEND_URL}/api/gacs/stats`, { headers }),
        fetch(`${BACKEND_URL}/api/gacs/uplink-stats`, { headers }),
        fetch(`${BACKEND_URL}/api/gacs/recent`, { headers })
      ]);

      const [dStats, dUplink, dRecent] = await Promise.all([rStats.json(), rUplink.json(), rRecent.json()]);

      if (!rStats.ok) throw new Error(dStats.error || 'Failed to fetch stats');
      
      setGacsStats(dStats);
      setUplinkStats(dUplink);
      setRecentDevices(dRecent || []);
    } catch (e: any) {
      setGacsError(e.message);
    }
    setLoadingGacs(false);
  }, [token]);

  useEffect(() => {
    fetchGacsData();
    const interval = setInterval(fetchGacsData, 30000);
    return () => clearInterval(interval);
  }, [fetchGacsData]);

  // Chart configs
  const deviceOverviewData = {
    labels: ['Online', 'Offline'],
    datasets: [
      {
        data: [gacsStats?.online || 0, gacsStats?.offline || 0],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderColor: ['#22c55e', '#ef4444'],
        borderWidth: 1,
      },
    ],
  };

  const uplinkData = {
    labels: ['Excellent', 'Good', 'Fair', 'Poor', 'No Signal'],
    datasets: [
      {
        data: [
          uplinkStats?.excellent || 0, 
          uplinkStats?.good || 0, 
          uplinkStats?.fair || 0, 
          uplinkStats?.poor || 0, 
          uplinkStats?.no_signal || 0
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ],
        borderColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#9ca3af'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e2e8f0',
          font: { family: 'Inter', size: 11 }
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner simulation */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.05))', borderColor: 'var(--accent-primary)' }}>
        <div>
          <h2 style={{ marginBottom: '8px' }}>Control Panel Simulasi NEMESYS v1.3</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
            Sistem Pemantauan Operasional Jaringan, Insiden SLA, & GenieACS PON
          </p>
        </div>
        <button onClick={onTriggerAlert} className="btn btn-alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> Trigger Simulasi Error Zabbix
        </button>
      </div>

      {/* Bottleneck & Network Loop Detection Banner (Item 6) */}
      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={24} style={{ color: '#f87171' }} />
          <div>
            <div style={{ fontWeight: 700, color: '#f87171', fontSize: '14px' }}>⚡ DETEKSI TRAFFIC BOTTLENECK & BROADCAST SPAMMING</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
              Link Core [Modem B14 / Gedung B] terdeteksi mengalami <b>Bandwidth Utilization 94%</b> (&gt;85% threshold warning).
            </div>
          </div>
        </div>
        <button 
          onClick={() => alert('Fitur Isolasi IP/Port berhasil mengeksekusi blokir sementara pada port user penyebab spamming!')}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          Isolasi IP / Port Otomatis
        </button>
      </div>

      {/* Grid Stats (Zabbix) */}
      <div>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Zabbix Network Monitoring</h3>
        <div className="grid-dashboard">
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Total Perangkat</h4>
              <p>{totalDevices}</p>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <Server size={24} />
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Perangkat Aktif (Up)</h4>
              <p style={{ color: 'var(--color-success)' }}>{upDevices}</p>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
              <ShieldCheck size={24} />
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Perangkat Mati (Down)</h4>
              <p style={{ color: downDevices > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{downDevices}</p>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
              <ShieldAlert size={24} />
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Gangguan Aktif</h4>
              <p>{activeTasks}</p>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>
              <ClipboardList size={24} />
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-info">
              <h4>Rata-rata MTTR</h4>
              <p>{avgMTTR} Menit</p>
            </div>
            <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-info)' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid Stats (GenieACS) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>GenieACS OLT/ONU Management</h3>
          <button onClick={() => onNavigate('gacs-devices')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            Lihat Semua ONU &rarr;
          </button>
        </div>
        
        {gacsError ? (
          <div className="glass-card" style={{ padding: '20px', color: 'var(--color-warning)', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <AlertCircle size={20} /> {gacsError}
          </div>
        ) : loadingGacs && !gacsStats ? (
          <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data ACS...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="glass-card stat-card">
              <div className="stat-info">
                <h4>Total ONU (TR-069)</h4>
                <p>{gacsStats?.total ?? 0}</p>
              </div>
              <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                <Wifi size={24} />
              </div>
            </div>
            <div className="glass-card stat-card" style={{ borderTop: '4px solid #22c55e' }}>
              <div className="stat-info">
                <h4>ONU Online</h4>
                <p style={{ color: 'var(--color-success)' }}>{gacsStats?.online ?? 0}</p>
              </div>
            </div>
            <div className="glass-card stat-card" style={{ borderTop: '4px solid #ef4444' }}>
              <div className="stat-info">
                <h4>ONU Offline</h4>
                <p style={{ color: 'var(--color-danger)' }}>{gacsStats?.offline ?? 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Section (GACS Previews Match) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h4 style={{ alignSelf: 'flex-start', marginBottom: '20px', fontSize: '14px', fontWeight: 600 }}>Device Status Distribution</h4>
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
             <Doughnut data={deviceOverviewData} options={chartOptions} />
          </div>
        </div>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h4 style={{ alignSelf: 'flex-start', marginBottom: '20px', fontSize: '14px', fontWeight: 600 }}>PON Signal Distribution</h4>
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
             <Doughnut data={uplinkData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent GACS Devices Full Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Aktivitas ONU Terbaru (Recent Devices)</h3>
        </div>
        <div className="table-container">
          {loadingGacs && recentDevices.length === 0 ? (
             <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat...</div>
          ) : recentDevices.length === 0 ? (
             <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Tidak ada data aktivitas terbaru.</div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>SN</th>
                  <th>MAC Address</th>
                  <th>IP Address</th>
                  <th>SSID</th>
                  <th>Rx Power</th>
                  <th>Suhu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentDevices.map(device => {
                  const d: any = device;
                  const mac = d.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.BSSID?._value || '-';
                  const ssid = d.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.SSID?._value || '-';
                  const ip = d.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANIPConnection?.['1']?.ExternalIPAddress?._value || '-';
                  const rxPower = d.InternetGatewayDevice?.WANDevice?.['1']?.WANDSLInterfaceConfig?.['1']?.X_ZTE_RXPower?._value;
                  const temp = d.InternetGatewayDevice?.WANDevice?.['1']?.WANDSLInterfaceConfig?.['1']?.X_ZTE_Temperature?._value;
                  const status = d._tags?.includes('online') ? 'online' : 'offline';
                  
                  return (
                    <tr key={d._id}>
                      <td><span style={{ fontWeight: 600 }}>{d._id}</span></td>
                      <td><code>{mac}</code></td>
                      <td>{ip}</td>
                      <td>{ssid}</td>
                      <td>
                        {rxPower ? (
                           <span className={`badge ${Number(rxPower) < -27 ? 'badge-danger' : 'badge-info'}`}>
                             {rxPower} dBm
                           </span>
                        ) : '-'}
                      </td>
                      <td>{temp ? `${temp}°C` : '-'}</td>
                      <td>
                        <span className={`badge ${status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                          {status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
