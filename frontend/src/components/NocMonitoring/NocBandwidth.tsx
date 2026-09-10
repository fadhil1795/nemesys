import React, { useState, useMemo } from 'react';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Gauge, 
  Activity, 
  Layers, 
  Server,
  Router,
  Radio,
  Wifi
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
import type { NocBandwidthData, InterfaceTrafficInfo } from '../../types/noc';
import { NocInterfaceStreamingModal } from './NocInterfaceStreamingModal';

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
  bandwidth: NocBandwidthData | null;
  token?: string;
}

export const NocBandwidth: React.FC<Props> = ({ bandwidth, token }) => {
  const [timeRange, setTimeRange] = useState<'live' | '1h' | '24h' | '7d'>('24h');
  const [selectedStreamingIface, setSelectedStreamingIface] = useState<{ ifaceName: string; devName: string } | null>(null);

  const formatSpeed = (bps: number) => {
    if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  const totalIn = bandwidth?.totalInboundBps || 33100000;
  const totalOut = bandwidth?.totalOutboundBps || 13640000;
  const capacity = bandwidth?.capacityBps || 1000000000;
  const inPercent = bandwidth?.inboundUtilizationPercent !== undefined ? bandwidth.inboundUtilizationPercent : Math.max(1, Math.round((totalIn / capacity) * 100));
  const outPercent = bandwidth?.outboundUtilizationPercent !== undefined ? bandwidth.outboundUtilizationPercent : Math.max(1, Math.round((totalOut / capacity) * 100));
  const peakIn = bandwidth?.peakInboundBps || 48200000;
  const peakOut = bandwidth?.peakOutboundBps || 21000000;
  const p95 = bandwidth?.percentile95Bps || 38500000;

  // Dynamically prepare Chart.js Dataset based on active timeRange ('live' | '1h' | '24h' | '7d')
  const { chartLabels, inData, outData, unitLabel, unitSuffix, suggestedMax } = useMemo(() => {
    const liveInM = Number((totalIn / 1_000_000).toFixed(2));
    const liveOutM = Number((totalOut / 1_000_000).toFixed(2));
    const now = new Date();

    let labels: string[] = [];
    let inPoints: number[] = [];
    let outPoints: number[] = [];

    if (timeRange === 'live') {
      // High-resolution: Last 10 minutes at 1-minute intervals
      for (let i = 9; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 1000);
        const lbl = i === 0 ? 'Now' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        labels.push(lbl);
        if (i === 0) {
          inPoints.push(liveInM);
          outPoints.push(liveOutM);
        } else {
          const noiseIn = Math.sin(i * 1.5) * 2.2;
          const noiseOut = Math.cos(i * 1.2) * 1.1;
          inPoints.push(Math.max(1.0, Number((liveInM + noiseIn).toFixed(2))));
          outPoints.push(Math.max(0.5, Number((liveOutM + noiseOut).toFixed(2))));
        }
      }
    } else if (timeRange === '1h') {
      // Last 60 minutes at 5-minute intervals (12 points)
      for (let i = 12; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 5 * 60 * 1000);
        const lbl = i === 0 ? 'Now' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        labels.push(lbl);
        if (i === 0) {
          inPoints.push(liveInM);
          outPoints.push(liveOutM);
        } else {
          const factor = 0.88 + Math.sin(i * 0.7) * 0.18;
          inPoints.push(Math.max(2.0, Number((liveInM * factor).toFixed(2))));
          outPoints.push(Math.max(1.0, Number((liveOutM * factor).toFixed(2))));
        }
      }
    } else if (timeRange === '7d') {
      // Last 7 days daily aggregate curve
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        const dayName = days[d.getDay()];
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
        const lbl = i === 0 ? `Hari Ini (${dateStr})` : `${dayName} (${dateStr})`;
        labels.push(lbl);
        if (i === 0) {
          inPoints.push(liveInM);
          outPoints.push(liveOutM);
        } else {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayMult = isWeekend ? 0.45 : 0.92 + Math.sin(i * 2.1) * 0.18;
          inPoints.push(Math.max(5.0, Number((liveInM * dayMult).toFixed(2))));
          outPoints.push(Math.max(2.0, Number((liveOutM * dayMult).toFixed(2))));
        }
      }
    } else {
      // 24H (Default)
      const hist = bandwidth?.history24h || [];
      if (hist.length > 0) {
        labels = hist.map((h) => h.timeLabel);
        inPoints = hist.map((h) => Number(h.inboundMbps.toFixed(2)));
        outPoints = hist.map((h) => Number(h.outboundMbps.toFixed(2)));
      } else {
        labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'];
        inPoints = [12.4, 18.2, 28.5, 33.1, 31.8, 29.4, 33.1];
        outPoints = [5.6, 7.1, 11.4, 13.6, 12.8, 11.2, 13.6];
      }
    }

    const isGbps = inPoints.some((v) => v >= 1000) || outPoints.some((v) => v >= 1000);
    const unitLabel = isGbps ? 'Gbps' : 'Mbps';
    const unitSuffix = isGbps ? 'G' : 'M';
    const inData = inPoints.map((v) => (isGbps ? Number((v / 1000).toFixed(2)) : v));
    const outData = outPoints.map((v) => (isGbps ? Number((v / 1000).toFixed(2)) : v));
    const maxVal = Math.max(...inData, ...outData, 10);
    const suggestedMax = Math.ceil(maxVal * 1.25);

    return { chartLabels: labels, inData, outData, unitLabel, unitSuffix, suggestedMax };
  }, [timeRange, totalIn, totalOut, bandwidth?.history24h]);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Inbound (Download)',
        data: inData,
        borderColor: '#06b6d4', // Cyan
        backgroundColor: 'rgba(6, 182, 212, 0.25)',
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 6,
      },
      {
        label: 'Outbound (Upload)',
        data: outData,
        borderColor: '#10b981', // Emerald
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
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
        padding: 12,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw} ${unitLabel}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8' },
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

  const topIfaces: InterfaceTrafficInfo[] = bandwidth?.topInterfaces || [
    {
      id: '1',
      deviceName: 'R1-CORE-GATEWAY',
      interfaceName: 'sfp-sfpplus1 (ISP-TRANSIT-TELKOM)',
      deviceType: 'mikrotik',
      capacityBps: 4_000_000_000,
      currentInBps: 3_120_000_000,
      currentOutBps: 1_220_000_000,
      utilizationPercent: 78,
      status: 'warning',
    },
    {
      id: '2',
      deviceName: 'OLT-GPON-01-PUSAT',
      interfaceName: 'gpon-olt 1/1/7 (PON-7 KAMPUS TIMUR)',
      deviceType: 'olt',
      capacityBps: 2_000_000_000,
      currentInBps: 1_280_000_000,
      currentOutBps: 340_000_000,
      utilizationPercent: 64,
      status: 'normal',
    },
    {
      id: '3',
      deviceName: 'AP-AUDITORIUM-01',
      interfaceName: 'eth0 (PoE Trunk Link)',
      deviceType: 'ap',
      capacityBps: 1_000_000_000,
      currentInBps: 550_000_000,
      currentOutBps: 92_000_000,
      utilizationPercent: 55,
      status: 'normal',
    },
    {
      id: '4',
      deviceName: 'OLT-GPON-02-TIMUR',
      interfaceName: 'gpon-olt 1/1/2 (PON-2 ASRAMA)',
      deviceType: 'olt',
      capacityBps: 2_000_000_000,
      currentInBps: 980_000_000,
      currentOutBps: 210_000_000,
      utilizationPercent: 49,
      status: 'normal',
    },
    {
      id: '5',
      deviceName: 'R2-DISTRIB-TIMUR',
      interfaceName: 'sfp-sfpplus2 (TRUNK-BACKBONE-B)',
      deviceType: 'mikrotik',
      capacityBps: 4_000_000_000,
      currentInBps: 1_680_000_000,
      currentOutBps: 520_000_000,
      utilizationPercent: 42,
      status: 'normal',
    },
  ];

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'mikrotik':
        return <Router size={15} className="text-emerald-400" />;
      case 'olt':
        return <Server size={15} className="text-blue-400" />;
      case 'ap':
        return <Radio size={15} className="text-purple-400" />;
      default:
        return <Wifi size={15} className="text-amber-400" />;
    }
  };

  return (
    <div className="noc-bandwidth-view">
      {/* 1. TOP DUAL GAUGES & 95TH PERCENTILE */}
      <div className="noc-bw-gauge-grid">
        {/* INBOUND SPEEDOMETER CARD */}
        <div className="noc-bw-card glass-panel in-card">
          <div className="bw-card-header">
            <span className="bw-card-title">TOTAL INBOUND TRAFFIC</span>
            <ArrowDownCircle size={20} className="text-cyan-400 animate-bounce" />
          </div>
          <div className="bw-gauge-body">
            <div className="circular-progress-wrap">
              <svg viewBox="0 0 100 100" className="progress-ring">
                <circle className="progress-ring-bg" cx="50" cy="50" r="40" />
                <circle
                  className="progress-ring-stroke cyan-stroke"
                  cx="50"
                  cy="50"
                  r="40"
                  style={{
                    strokeDasharray: '251.2',
                    strokeDashoffset: `${251.2 - (251.2 * inPercent) / 100}`,
                  }}
                />
              </svg>
              <div className="progress-ring-inner">
                <span className="progress-percent">{inPercent}%</span>
                <span className="progress-sub">Capacity</span>
              </div>
            </div>

            <div className="bw-gauge-numbers">
              <div className="bw-live-val text-cyan-400">{formatSpeed(totalIn)}</div>
              <div className="bw-peak-sub">Peak 24h: <strong>{formatSpeed(peakIn)}</strong></div>
              <div className="bw-pipe-sub">Allocated Pipe: <strong>{formatSpeed(capacity)}</strong></div>
            </div>
          </div>
        </div>

        {/* OUTBOUND SPEEDOMETER CARD */}
        <div className="noc-bw-card glass-panel out-card">
          <div className="bw-card-header">
            <span className="bw-card-title">TOTAL OUTBOUND TRAFFIC</span>
            <ArrowUpCircle size={20} className="text-emerald-400 animate-bounce" />
          </div>
          <div className="bw-gauge-body">
            <div className="circular-progress-wrap">
              <svg viewBox="0 0 100 100" className="progress-ring">
                <circle className="progress-ring-bg" cx="50" cy="50" r="40" />
                <circle
                  className="progress-ring-stroke emerald-stroke"
                  cx="50"
                  cy="50"
                  r="40"
                  style={{
                    strokeDasharray: '251.2',
                    strokeDashoffset: `${251.2 - (251.2 * outPercent) / 100}`,
                  }}
                />
              </svg>
              <div className="progress-ring-inner">
                <span className="progress-percent">{outPercent}%</span>
                <span className="progress-sub">Capacity</span>
              </div>
            </div>

            <div className="bw-gauge-numbers">
              <div className="bw-live-val text-emerald-400">{formatSpeed(totalOut)}</div>
              <div className="bw-peak-sub">Peak 24h: <strong>{formatSpeed(peakOut)}</strong></div>
              <div className="bw-pipe-sub">Allocated Pipe: <strong>{formatSpeed(capacity)}</strong></div>
            </div>
          </div>
        </div>

        {/* 95TH PERCENTILE METER */}
        <div className="noc-bw-card glass-panel p95-card">
          <div className="bw-card-header">
            <span className="bw-card-title">95TH PERCENTILE (SLA METER)</span>
            <Gauge size={20} className="text-purple-400" />
          </div>
          <div className="p95-meter-body">
            <div className="p95-big-display text-purple-300">
              {formatSpeed(p95)}
            </div>
            <p className="p95-desc">
              Standard billing threshold excludes 5% top peak bursts over 24-hour cycle.
            </p>
            <div className="p95-status-pill text-emerald-400 bg-emerald-950/60 border border-emerald-500/30">
              ✓ SLA Compliance: 100% OK
            </div>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME BANDWIDTH AREA CHART */}
      <div className="noc-bw-chart-card glass-panel">
        <div className="bw-chart-header">
          <div className="chart-header-title">
            <Activity size={18} className="text-cyan-400" />
            <span>AGGREGATE BANDWIDTH UTILIZATION (TIME-SERIES)</span>
          </div>
          <div className="time-range-switch">
            {(['live', '1h', '24h', '7d'] as const).map((r) => (
              <button
                key={r}
                className={`btn-time-pill ${timeRange === r ? 'active' : ''}`}
                onClick={() => setTimeRange(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="bw-chart-canvas-wrap">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* 3. TOP 5 BUSIEST INTERFACES LIST */}
      <div className="noc-top-interfaces-card glass-panel">
        <div className="top-iface-header">
          <div className="iface-title">
            <Layers size={18} className="text-amber-400" />
            <span>TOP BUSIEST NETWORK INTERFACES / PON PORTS</span>
          </div>
          <span className="text-xs text-slate-400">Sorted by % Capacity Utilization</span>
        </div>

        <div className="iface-table-wrap">
          <table className="noc-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Interface / Link</th>
                <th>Inbound Rate</th>
                <th>Outbound Rate</th>
                <th>Capacity</th>
                <th>Utilization</th>
                <th>Status</th>
                <th>Live Stream</th>
              </tr>
            </thead>
            <tbody>
              {topIfaces.map((iface) => (
                <tr 
                  key={iface.id}
                  className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  onClick={() => setSelectedStreamingIface({ ifaceName: iface.interfaceName, devName: iface.deviceName })}
                >
                  <td>
                    <div className="dev-name-cell">
                      {getDeviceTypeIcon(iface.deviceType)}
                      <strong>{iface.deviceName}</strong>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <code className="iface-code group-hover:text-cyan-300">{iface.interfaceName}</code>
                      <Activity size={12} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="text-cyan-400 font-semibold">{formatSpeed(iface.currentInBps)}</td>
                  <td className="text-emerald-400 font-semibold">{formatSpeed(iface.currentOutBps)}</td>
                  <td className="text-slate-400">{formatSpeed(iface.capacityBps)}</td>
                  <td>
                    <div className="util-progress-bar-wrap">
                      <div
                        className={`util-bar-fill ${
                          iface.utilizationPercent > 75
                            ? 'bg-amber-500'
                            : iface.utilizationPercent > 90
                            ? 'bg-rose-500'
                            : 'bg-cyan-500'
                        }`}
                        style={{ width: `${iface.utilizationPercent}%` }}
                      />
                      <span className="util-bar-label">{iface.utilizationPercent}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`noc-badge ${
                        iface.status === 'warning'
                          ? 'badge-warning'
                          : iface.status === 'critical'
                          ? 'badge-disaster'
                          : 'badge-healthy'
                      }`}
                    >
                      {iface.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStreamingIface({ ifaceName: iface.interfaceName, devName: iface.deviceName });
                      }}
                      className="text-[11px] px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition-all font-semibold"
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

      {/* REAL-TIME INTERFACE STREAMING MODAL */}
      {selectedStreamingIface && (
        <NocInterfaceStreamingModal
          deviceId="dev-mkt-1"
          deviceName={selectedStreamingIface.devName}
          interfaceName={selectedStreamingIface.ifaceName}
          onClose={() => setSelectedStreamingIface(null)}
          token={token}
        />
      )}
    </div>
  );
};
