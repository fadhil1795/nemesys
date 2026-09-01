import React, { useState, useEffect } from 'react';
import { Activity, Database, Server, Radio, Send, Cpu, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { BACKEND_URL } from '../App';

interface HealthCheckProps {
  token: string;
}

interface CheckDetail {
  status: 'ok' | 'warning' | 'error';
  message: string;
  latency_ms?: number;
  pending_updates?: number;
  rss_mb?: number;
  heap_used_mb?: number;
  heap_total_mb?: number;
}

interface FullHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime_seconds: number;
  checks: {
    database?: CheckDetail;
    genieacs?: CheckDetail;
    mikrotik?: CheckDetail;
    telegram?: CheckDetail;
    memory?: CheckDetail;
  };
}

export const HealthCheck: React.FC<HealthCheckProps> = ({ token }) => {
  const [data, setData] = useState<FullHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/health/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch system health');
      }
    } catch (e: any) {
      setError(e.message || 'Error connecting to backend');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'ok') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}><CheckCircle size={14} /> OK</span>;
    }
    if (status === 'warning') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}><AlertTriangle size={14} /> Warning</span>;
    }
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}><XCircle size={14} /> Error</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)' }}>
            <Activity size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>System Health & Service Monitor</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              Pemantauan real-time integritas seluruh koneksi & infrastruktur Nemesys
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {data && (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '14px', fontWeight: 800,
                color: data.status === 'healthy' ? '#22c55e' : data.status === 'degraded' ? '#f59e0b' : '#ef4444',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {data.status}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Uptime: {formatUptime(data.uptime_seconds)}</div>
            </div>
          )}

          <button
            onClick={fetchHealth}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
              background: 'var(--accent-primary)', border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Checking...' : 'Refresh Health'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Services Grid */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Database */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
                <Database size={20} style={{ color: '#38bdf8' }} /> MySQL Database
              </div>
              {getStatusBadge(data.checks.database?.status)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>Message: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.database?.message}</span></div>
            </div>
          </div>

          {/* GenieACS */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
                <Server size={20} style={{ color: '#818cf8' }} /> GenieACS Server
              </div>
              {getStatusBadge(data.checks.genieacs?.status)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>Message: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.genieacs?.message}</span></div>
              {data.checks.genieacs?.latency_ms !== undefined && (
                <div>Latency: <span style={{ color: '#22c55e', fontWeight: 600 }}>{data.checks.genieacs.latency_ms} ms</span></div>
              )}
            </div>
          </div>

          {/* MikroTik */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
                <Radio size={20} style={{ color: '#f59e0b' }} /> MikroTik RouterOS API
              </div>
              {getStatusBadge(data.checks.mikrotik?.status)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>Message: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.mikrotik?.message}</span></div>
            </div>
          </div>

          {/* Telegram Bot */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
                <Send size={20} style={{ color: '#0088cc' }} /> Telegram Bot
              </div>
              {getStatusBadge(data.checks.telegram?.status)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>Message: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.telegram?.message}</span></div>
              {data.checks.telegram?.pending_updates !== undefined && (
                <div>Pending Updates: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.telegram.pending_updates}</span></div>
              )}
            </div>
          </div>

          {/* Node Process & Memory */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
                <Cpu size={20} style={{ color: '#ec4899' }} /> Memory & CPU Usage
              </div>
              {getStatusBadge(data.checks.memory?.status)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>Heap Used: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.memory?.heap_used_mb} MB / {data.checks.memory?.heap_total_mb} MB</span></div>
              <div>Process RSS: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.checks.memory?.rss_mb} MB</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
