import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  RefreshCw, 
  Play, 
  Pause, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check 
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { BACKEND_URL } from '../../App';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  deviceId: string;
  deviceName: string;
  interfaceName: string;
  onClose: () => void;
  token?: string;
}

export const NocInterfaceStreamingModal: React.FC<Props> = ({
  deviceId,
  deviceName,
  interfaceName,
  onClose,
  token,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'15m' | '30m' | '1h'>('15m');
  const [copied, setCopied] = useState<boolean>(false);
  const [pollCountdown, setPollCountdown] = useState<number>(5);

  const fetchHistory = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const limit = timeRange === '15m' ? 15 : timeRange === '30m' ? 30 : 60;
      const res = await fetch(
        `${BACKEND_URL}/api/monitoring/devices/${deviceId}/interfaces/${encodeURIComponent(interfaceName)}/history?limit=${limit}`,
        { headers }
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch interface streaming history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHistory();
  }, [deviceId, interfaceName, timeRange]);

  // Real-time polling timer every 5 seconds
  useEffect(() => {
    if (!isStreaming) return;

    setPollCountdown(5);
    const countdownInterval = setInterval(() => {
      setPollCountdown((prev) => {
        if (prev <= 1) {
          fetchHistory();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isStreaming, deviceId, interfaceName, timeRange]);

  const handleCopyName = () => {
    navigator.clipboard.writeText(interfaceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSpeed = (mbps: number) => {
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
    if (mbps >= 1) return `${mbps.toFixed(2)} Mbps`;
    return `${(mbps * 1000).toFixed(0)} Kbps`;
  };

  // Prepare chart
  const history = data?.history || [];
  const chartLabels = history.map((h: any) => h.timeLabel);
  const inPoints = history.map((h: any) => h.inMbps);
  const outPoints = history.map((h: any) => h.outMbps);
  const isGbps = inPoints.some((v: number) => v >= 1000) || outPoints.some((v: number) => v >= 1000);
  const unitLabel = isGbps ? 'Gbps' : 'Mbps';
  const unitSuffix = isGbps ? 'G' : 'M';
  const inData = inPoints.map((v: number) => (isGbps ? Number((v / 1000).toFixed(2)) : v));
  const outData = outPoints.map((v: number) => (isGbps ? Number((v / 1000).toFixed(2)) : v));
  const maxVal = Math.max(...inData, ...outData, 1.0);
  const suggestedMax = Math.ceil(maxVal * 1.3);

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['--:--', '--:--', 'Now'],
    datasets: [
      {
        label: 'Inbound (Download)',
        data: inData.length > 0 ? inData : [0, 0, 0],
        borderColor: '#06b6d4', // Cyan
        backgroundColor: 'rgba(6, 182, 212, 0.25)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Outbound (Upload)',
        data: outData.length > 0 ? outData : [0, 0, 0],
        borderColor: '#10b981', // Emerald
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 400,
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { size: 12, weight: '600' },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#38bdf8',
        bodyColor: '#f1f5f9',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw} ${unitLabel}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: {
          color: '#94a3b8',
          callback: (value: any) => `${value} ${unitSuffix}`,
        },
        suggestedMax,
      },
    },
  };

  return (
    <div className="noc-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="noc-device-detail-dialog glass-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '920px', width: '95%' }}
      >
        {/* HEADER */}
        <div className="detail-modal-header" style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.8)' }}>
          <div className="detail-header-left">
            <div className="device-avatar-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>
              <Activity size={24} />
            </div>
            <div className="device-titles">
              <div className="title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <span>{interfaceName}</span>
                  <button 
                    onClick={handleCopyName} 
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                    title="Copy interface name"
                  >
                    {copied ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                  </button>
                </h3>
                <span className={`noc-badge ${data?.status === 'running' ? 'badge-healthy' : 'badge-offline'}`}>
                  {data?.status === 'running' ? 'RUNNING / UP' : 'DOWN'}
                </span>
              </div>
              <div className="meta-sub-row" style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Device: <strong style={{ color: '#f1f5f9' }}>{deviceName}</strong></span>
                <span>• Speed: <strong style={{ color: '#38bdf8' }}>{data?.speed || '1 Gbps'}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399', fontWeight: 700 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Live Telemetry
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* Stream pause/play */}
            <button
              className={`stream-toggle-btn ${isStreaming ? 'streaming' : 'paused'}`}
              onClick={() => setIsStreaming(!isStreaming)}
              title={isStreaming ? 'Pause live polling' : 'Resume live polling'}
            >
              {isStreaming ? (
                <>
                  <Pause size={13} />
                  <span>Streaming ({pollCountdown}s)</span>
                </>
              ) : (
                <>
                  <Play size={13} />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button className="detail-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="detail-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading && !data ? (
            <div className="detail-loading" style={{ padding: '4rem 1rem' }}>
              <RefreshCw size={32} className="rotating" style={{ color: '#38bdf8', marginBottom: '0.75rem' }} />
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Fetching live telemetry for {interfaceName}...</span>
            </div>
          ) : (
            <>
              {/* 1. TOP LIVE KPIS */}
              <div className="stream-kpis-grid">
                <div className="stream-kpi-card glass-panel">
                  <div className="stream-kpi-top">
                    <span>LIVE INBOUND (RX)</span>
                    <ArrowDownCircle size={16} style={{ color: '#38bdf8' }} />
                  </div>
                  <div className="stream-kpi-value" style={{ color: '#38bdf8' }}>
                    {formatSpeed(data?.liveInMbps || 0)}
                  </div>
                  <span className="stream-kpi-sub">
                    Peak: {formatSpeed(data?.peakInMbps || data?.liveInMbps || 0)}
                  </span>
                </div>

                <div className="stream-kpi-card glass-panel">
                  <div className="stream-kpi-top">
                    <span>LIVE OUTBOUND (TX)</span>
                    <ArrowUpCircle size={16} style={{ color: '#34d399' }} />
                  </div>
                  <div className="stream-kpi-value" style={{ color: '#34d399' }}>
                    {formatSpeed(data?.liveOutMbps || 0)}
                  </div>
                  <span className="stream-kpi-sub">
                    Peak: {formatSpeed(data?.peakOutMbps || data?.liveOutMbps || 0)}
                  </span>
                </div>

                <div className="stream-kpi-card glass-panel">
                  <div className="stream-kpi-top">
                    <span>PACKET DISCARDS</span>
                    <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
                  </div>
                  <div className="stream-kpi-value" style={{ color: '#f1f5f9' }}>
                    {data?.inDiscards || data?.outDiscards || 0}
                  </div>
                  <span className="stream-kpi-sub">
                    In: {data?.inDiscards || 0} | Out: {data?.outDiscards || 0}
                  </span>
                </div>

                <div className="stream-kpi-card glass-panel">
                  <div className="stream-kpi-top">
                    <span>PACKET ERRORS</span>
                    <ShieldCheck size={16} style={{ color: '#c084fc' }} />
                  </div>
                  <div className="stream-kpi-value" style={{ color: '#34d399' }}>
                    {data?.inErrors || data?.outErrors || 0}
                  </div>
                  <span className="stream-kpi-sub">
                    CRC / Frame Drops: 0
                  </span>
                </div>
              </div>

              {/* 2. LIVE REAL-TIME STREAMING AREA CHART */}
              <div className="stream-chart-card glass-panel">
                <div className="stream-chart-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={17} style={{ color: '#38bdf8' }} />
                    <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.88rem' }}>
                      Real-Time Throughput Streaming
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      (Interval: 60s live Zabbix SNMP)
                    </span>
                  </div>

                  <div className="stream-timerange-pills">
                    {(['15m', '30m', '1h'] as const).map((r) => (
                      <button
                        key={r}
                        className={`stream-timerange-btn ${timeRange === r ? 'active' : ''}`}
                        onClick={() => setTimeRange(r)}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '260px', width: '100%' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* 3. RECENT SAMPLES TABLE */}
              <div className="sub-table-card glass-panel">
                <div className="sub-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.82rem' }}>
                    Recent Historical Data Points (Last {history.length} Samples)
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                    Last polled: {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="noc-table-wrap">
                  <div className="noc-table-scroll" style={{ maxHeight: '160px' }}>
                    <table className="noc-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Inbound (Download)</th>
                          <th>Outbound (Upload)</th>
                          <th>Total Throughput</th>
                          <th>Flow Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.length > 0 ? (
                          [...history].reverse().slice(0, 8).map((pt: any, idx: number) => {
                            const total = Number((pt.inMbps + pt.outMbps).toFixed(2));
                            const inDominant = pt.inMbps >= pt.outMbps;
                            return (
                              <tr key={idx}>
                                <td><code>{pt.timeLabel}</code></td>
                                <td style={{ color: '#38bdf8', fontWeight: 700 }}>{formatSpeed(pt.inMbps)}</td>
                                <td style={{ color: '#34d399', fontWeight: 700 }}>{formatSpeed(pt.outMbps)}</td>
                                <td style={{ color: '#f8fafc', fontWeight: 700 }}>{formatSpeed(total)}</td>
                                <td>
                                  <span className={`flow-tag ${inDominant ? 'rx' : 'tx'}`}>
                                    {inDominant ? 'RX DOMINANT' : 'TX DOMINANT'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                              Collecting real-time traffic samples...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
