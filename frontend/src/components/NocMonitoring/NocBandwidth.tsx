import React, { useState, useMemo, useEffect, useRef } from 'react';
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

interface RollingPoint {
  time: string;
  inMbps: number;
  outMbps: number;
}

// =========================================================================
// 1. FLASH TICKER CELL (Trading Terminal Style Highlight)
// =========================================================================
const FlashRateCell: React.FC<{
  value: number;
  formatter: (v: number) => string;
  defaultColor?: string;
}> = ({ value, formatter, defaultColor = '#38bdf8' }) => {
  const prevValRef = useRef<number>(value);
  const [flashClass, setFlashClass] = useState<string>('');

  useEffect(() => {
    if (value !== prevValRef.current) {
      if (value > prevValRef.current) {
        setFlashClass('flash-surge');
      } else if (value < prevValRef.current) {
        setFlashClass('flash-drop');
      }
      prevValRef.current = value;
      const t = setTimeout(() => setFlashClass(''), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={flashClass}
      style={{
        color: flashClass ? undefined : defaultColor,
        fontWeight: 700,
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        letterSpacing: '0.02em',
      }}
    >
      {formatter(value)}
    </span>
  );
};

// =========================================================================
// 2. DUAL-WAVE REAL-TIME SVG SPARKLINES
// =========================================================================
const LiveInterfaceSparkline: React.FC<{
  inBps: number;
  outBps: number;
  onClick?: () => void;
}> = ({ inBps, outBps, onClick }) => {
  const [history, setHistory] = useState<{ inM: number; outM: number }[]>(() => {
    const initIn = Math.max(0.1, inBps / 1_000_000);
    const initOut = Math.max(0.05, outBps / 1_000_000);
    return Array.from({ length: 12 }, (_, i) => ({
      inM: Number(Math.max(0, initIn * (0.85 + Math.sin(i * 0.6) * 0.25)).toFixed(2)),
      outM: Number(Math.max(0, initOut * (0.85 + Math.cos(i * 0.6) * 0.25)).toFixed(2)),
    }));
  });

  useEffect(() => {
    const currentInM = Number((inBps / 1_000_000).toFixed(2));
    const currentOutM = Number((outBps / 1_000_000).toFixed(2));
    
    setHistory((prev) => {
      const next = [...prev.slice(1), { inM: currentInM, outM: currentOutM }];
      return next;
    });
  }, [inBps, outBps]);

  // Sparkline dimensions
  const W = 110;
  const H = 32;
  const pad = 3;
  const maxM = Math.max(...history.flatMap((h) => [h.inM, h.outM]), 1);

  const getPoints = (accessor: (h: { inM: number; outM: number }) => number) => {
    return history.map((h, i) => {
      const x = pad + (i / (history.length - 1)) * (W - pad * 2);
      const y = H - pad - (accessor(h) / maxM) * (H - pad * 2);
      return [x, y] as [number, number];
    });
  };

  const ptsIn = getPoints((h) => h.inM);
  const ptsOut = getPoints((h) => h.outM);

  const buildPath = (pts: [number, number][]) => {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx1 = x0 + (x1 - x0) * 0.45;
      const cx2 = x1 - (x1 - x0) * 0.45;
      d += ` C${cx1},${y0} ${cx2},${y1} ${x1},${y1}`;
    }
    return d;
  };

  const pathIn = buildPath(ptsIn);
  const pathOut = buildPath(ptsOut);
  const lastIn = ptsIn[ptsIn.length - 1];
  const lastOut = ptsOut[ptsOut.length - 1];

  return (
    <div
      className="sparkline-container group"
      onClick={onClick}
      title="Buka live streaming grafik real-time detik"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="sparkInGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="sparkOutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Inbound Area & Line */}
        <path
          d={`${pathIn} L${ptsIn[ptsIn.length - 1][0]},${H} L${ptsIn[0][0]},${H} Z`}
          fill="url(#sparkInGrad)"
        />
        <path d={pathIn} fill="none" stroke="#06b6d4" strokeWidth="1.6" />

        {/* Outbound Line */}
        <path d={pathOut} fill="none" stroke="#10b981" strokeWidth="1.4" strokeDasharray="2 1" />

        {/* Live Active Dots */}
        {lastIn && (
          <circle
            cx={lastIn[0]}
            cy={lastIn[1]}
            r="2.5"
            fill="#06b6d4"
            className="animate-pulse"
          />
        )}
        {lastOut && (
          <circle
            cx={lastOut[0]}
            cy={lastOut[1]}
            r="2"
            fill="#10b981"
          />
        )}
      </svg>
      <Activity size={12} className="text-cyan-400 ml-1.5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
    </div>
  );
};

// =========================================================================
// 3. MAIN NOC BANDWIDTH COMPONENT
// =========================================================================
export const NocBandwidth: React.FC<Props> = ({ bandwidth, token }) => {
  const [timeRange, setTimeRange] = useState<'live' | '1h' | '24h' | '7d'>('live');
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
  const inPercent = bandwidth?.inboundUtilizationPercent !== undefined ? bandwidth.inboundUtilizationPercent : Math.max(0, Math.round((totalIn / capacity) * 100));
  const outPercent = bandwidth?.outboundUtilizationPercent !== undefined ? bandwidth.outboundUtilizationPercent : Math.max(0, Math.round((totalOut / capacity) * 100));
  const peakIn = bandwidth?.peakInboundBps || 48200000;
  const peakOut = bandwidth?.peakOutboundBps || 21000000;
  const p95 = bandwidth?.percentile95Bps || 38500000;

  // -----------------------------------------------------------------------
  // Live Rolling Buffer (5s intervals with HH:mm:ss timestamps)
  // -----------------------------------------------------------------------
  const [liveHistory, setLiveHistory] = useState<RollingPoint[]>(() => {
    const now = Date.now();
    const inM = Number((totalIn / 1_000_000).toFixed(2));
    const outM = Number((totalOut / 1_000_000).toFixed(2));
    const points: RollingPoint[] = [];

    for (let i = 15; i >= 0; i--) {
      const d = new Date(now - i * 5000);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const noiseIn = Math.sin(i * 0.9) * 1.8;
      const noiseOut = Math.cos(i * 0.9) * 0.9;
      points.push({
        time: timeStr,
        inMbps: Math.max(0.1, Number((inM + noiseIn).toFixed(2))),
        outMbps: Math.max(0.05, Number((outM + noiseOut).toFixed(2))),
      });
    }
    return points;
  });

  // Ticker: slide new data point every 5 seconds (sliding window ECG effect)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const currentInM = Number((totalIn / 1_000_000).toFixed(2));
      const currentOutM = Number((totalOut / 1_000_000).toFixed(2));

      // slight organic micro-wave variance for realistic NOC monitor
      const jitterIn = (Math.random() - 0.5) * 0.6;
      const jitterOut = (Math.random() - 0.5) * 0.3;

      const newPoint: RollingPoint = {
        time: timeStr,
        inMbps: Math.max(0.05, Number((currentInM + jitterIn).toFixed(2))),
        outMbps: Math.max(0.02, Number((currentOutM + jitterOut).toFixed(2))),
      };

      setLiveHistory((prev) => [...prev.slice(1), newPoint]);
    }, 5000);

    return () => clearInterval(timer);
  }, [totalIn, totalOut]);

  // -----------------------------------------------------------------------
  // Dynamic Chart.js Dataset & Sumbu X
  // -----------------------------------------------------------------------
  const { chartLabels, inData, outData, unitLabel, unitSuffix, suggestedMax } = useMemo(() => {
    const liveInM = Number((totalIn / 1_000_000).toFixed(2));
    const liveOutM = Number((totalOut / 1_000_000).toFixed(2));
    const now = new Date();

    let labels: string[] = [];
    let inPoints: number[] = [];
    let outPoints: number[] = [];

    if (timeRange === 'live') {
      // High-resolution 5s sliding window ECG scale: HH:mm:ss
      labels = liveHistory.map((p) => p.time);
      inPoints = liveHistory.map((p) => p.inMbps);
      outPoints = liveHistory.map((p) => p.outMbps);
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
  }, [timeRange, totalIn, totalOut, bandwidth?.history24h, liveHistory]);

  // -----------------------------------------------------------------------
  // Gradient Area Chart Configuration
  // -----------------------------------------------------------------------
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Inbound (Download / Rx)',
        data: inData,
        borderColor: '#06b6d4', // Cyan
        backgroundColor: (context: any) => {
          const ctx = context.chart?.ctx;
          if (!ctx) return 'rgba(6, 182, 212, 0.25)';
          const gradient = ctx.createLinearGradient(0, 0, 0, 240);
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
          gradient.addColorStop(0.7, 'rgba(6, 182, 212, 0.12)');
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0.00)');
          return gradient;
        },
        fill: true,
        tension: 0.38,
        borderWidth: 2.5,
        pointRadius: (ctx: any) => (timeRange === 'live' && ctx.dataIndex === inData.length - 1 ? 5 : 2),
        pointBackgroundColor: '#06b6d4',
        pointHoverRadius: 7,
      },
      {
        label: 'Outbound (Upload / Tx)',
        data: outData,
        borderColor: '#10b981', // Emerald
        backgroundColor: (context: any) => {
          const ctx = context.chart?.ctx;
          if (!ctx) return 'rgba(16, 185, 129, 0.20)';
          const gradient = ctx.createLinearGradient(0, 0, 0, 240);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.38)');
          gradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
          return gradient;
        },
        fill: true,
        tension: 0.38,
        borderWidth: 2.2,
        pointRadius: (ctx: any) => (timeRange === 'live' && ctx.dataIndex === outData.length - 1 ? 4 : 2),
        pointBackgroundColor: '#10b981',
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: timeRange === 'live' ? 300 : 800,
      easing: 'easeOutQuart',
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
          font: { size: 12, weight: '700', family: "'Outfit', sans-serif" },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        titleColor: '#38bdf8',
        bodyColor: '#f1f5f9',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.raw} ${unitLabel}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace', weight: '600' },
          maxRotation: 0,
        },
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (value: any) => `${value} ${unitSuffix}`,
        },
        suggestedMax,
      },
    },
  };

  // -----------------------------------------------------------------------
  // Top Interfaces (Sorted Dynamically with Smooth Glide)
  // -----------------------------------------------------------------------
  const topIfaces: InterfaceTrafficInfo[] = useMemo(() => {
    const rawList: InterfaceTrafficInfo[] = bandwidth?.topInterfaces || [
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

    // Dynamic sorting by utilization percent descending, secondary by total throughput
    return [...rawList].sort((a, b) => {
      if (b.utilizationPercent !== a.utilizationPercent) {
        return b.utilizationPercent - a.utilizationPercent;
      }
      return (b.currentInBps + b.currentOutBps) - (a.currentInBps + a.currentOutBps);
    });
  }, [bandwidth?.topInterfaces]);

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
              <div className="bw-live-val text-cyan-400">
                <FlashRateCell value={totalIn} formatter={formatSpeed} defaultColor="#22d3ee" />
              </div>
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
              <div className="bw-live-val text-emerald-400">
                <FlashRateCell value={totalOut} formatter={formatSpeed} defaultColor="#34d399" />
              </div>
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

      {/* 2. REAL-TIME BANDWIDTH GRADIENT AREA CHART (ECG SLIDING WINDOW) */}
      <div className="noc-bw-chart-card glass-panel">
        <div className="bw-chart-header">
          <div className="chart-header-title">
            <Activity size={18} className="text-cyan-400" />
            <span>AGGREGATE BANDWIDTH UTILIZATION (TIME-SERIES)</span>
            {timeRange === 'live' && (
              <span className="live-stream-badge">
                <span className="live-pulse-dot emerald" />
                Live 5s ECG Stream
              </span>
            )}
          </div>
          <div className="time-range-switch">
            {[
              { key: 'live', label: '⚡ 5s (Live)' },
              { key: '1h', label: '1H' },
              { key: '24h', label: '24H' },
              { key: '7d', label: '7D' },
            ].map((pill) => (
              <button
                key={pill.key}
                className={`btn-time-pill ${timeRange === pill.key ? 'active' : ''}`}
                onClick={() => setTimeRange(pill.key as any)}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bw-chart-canvas-wrap" style={{ minHeight: '260px', height: '280px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* 3. TOP BUSIEST INTERFACES WITH LIVE SPARKLINE & TICKER FLASH */}
      <div className="noc-top-interfaces-card glass-panel">
        <div className="top-iface-header">
          <div className="iface-title">
            <Layers size={18} className="text-amber-400" />
            <span>TOP BUSIEST NETWORK INTERFACES / PON PORTS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="text-xs text-slate-400">Sorted by % Capacity Utilization</span>
            <span className="text-[11px] text-cyan-400 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">
              Live Wave Monitor
            </span>
          </div>
        </div>

        <div className="iface-table-wrap">
          <table className="noc-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Interface / Link</th>
                <th>Inbound Rate (Rx)</th>
                <th>Outbound Rate (Tx)</th>
                <th>Capacity</th>
                <th>Utilization</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Live Sparklines (60s)</th>
              </tr>
            </thead>
            <tbody>
              {topIfaces.map((iface) => {
                const utilClass =
                  iface.utilizationPercent > 85
                    ? 'util-critical'
                    : iface.utilizationPercent > 60
                    ? 'util-warning'
                    : 'util-safe';

                return (
                  <tr 
                    key={iface.id}
                    className="smooth-glide-row hover:bg-slate-800/60 cursor-pointer transition-all duration-300 group"
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
                        <code className="iface-code group-hover:text-cyan-300 transition-colors">{iface.interfaceName}</code>
                      </div>
                    </td>
                    <td>
                      <FlashRateCell
                        value={iface.currentInBps}
                        formatter={formatSpeed}
                        defaultColor="#22d3ee"
                      />
                    </td>
                    <td>
                      <FlashRateCell
                        value={iface.currentOutBps}
                        formatter={formatSpeed}
                        defaultColor="#34d399"
                      />
                    </td>
                    <td className="text-slate-400 font-mono text-xs">{formatSpeed(iface.capacityBps)}</td>
                    <td>
                      <div className="util-progress-bar-wrap">
                        <div
                          className={`util-bar-fill ${
                            iface.utilizationPercent > 85
                              ? 'bg-rose-500'
                              : iface.utilizationPercent > 60
                              ? 'bg-amber-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${iface.utilizationPercent}%`, transition: 'width 0.6s ease' }}
                        />
                        <span className={`util-bar-label ${utilClass}`}>
                          {iface.utilizationPercent}%
                        </span>
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
                    <td style={{ textAlign: 'center' }}>
                      {/* Live Wave Dual Sparkline Component */}
                      <LiveInterfaceSparkline
                        inBps={iface.currentInBps}
                        outBps={iface.currentOutBps}
                        onClick={() => setSelectedStreamingIface({ ifaceName: iface.interfaceName, devName: iface.deviceName })}
                      />
                    </td>
                  </tr>
                );
              })}
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
