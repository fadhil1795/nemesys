import React from 'react';
import { 
  Router, 
  Server, 
  ArrowUpRight, 
  ShieldAlert, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Clock,
  Users
} from 'lucide-react';
import { NocTopology } from './NocTopology';
import type { NocSummaryKPI, NocProblem, NocBandwidthData, NocDevice } from '../../types/noc';

interface Props {
  kpi: NocSummaryKPI | null;
  problems: NocProblem[];
  bandwidth: NocBandwidthData | null;
  devices: NocDevice[];
  onAcknowledgeProblem: (problem: NocProblem) => void;
  onNavigateTab: (tab: 'overview' | 'topology' | 'bandwidth' | 'problems' | 'matrix') => void;
  onSelectDevice?: (dev: NocDevice) => void;
}

export const NocOverview: React.FC<Props> = ({
  kpi,
  problems,
  bandwidth,
  devices,
  onAcknowledgeProblem,
  onNavigateTab,
  onSelectDevice,
}) => {
  const formatSpeed = (bps: number) => {
    if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  const getSeverityBadgeClass = (sev: number) => {
    switch (sev) {
      case 5:
        return 'badge-disaster';
      case 4:
        return 'badge-high';
      case 3:
      case 2:
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="noc-overview-view">
      {/* 1. TOP KPI STATS ROW */}
      <div className="noc-kpi-grid">
        {/* Total Bandwidth */}
        <div className="noc-kpi-card kpi-bandwidth" onClick={() => onNavigateTab('bandwidth')}>
          <div className="kpi-icon-header">
            <span className="kpi-label">TOTAL BANDWIDTH</span>
            <TrendingUp size={20} className="text-cyan-400" />
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big-number">{kpi?.totalBandwidthGbps || '3.42'}</span>
            <span className="kpi-unit">Gbps</span>
          </div>
          <div className="kpi-footer-sub">
            <span>Inbound: {formatSpeed(bandwidth?.totalInboundBps || 3420000000)}</span>
            <span className="util-badge">{(bandwidth?.inboundUtilizationPercent || 36)}% Util</span>
          </div>
        </div>

        {/* Mikrotik Routers */}
        <div className="noc-kpi-card kpi-mikrotik" onClick={() => onNavigateTab('matrix')}>
          <div className="kpi-icon-header">
            <span className="kpi-label">MIKROTIK ROUTERS</span>
            <Router size={20} className="text-emerald-400" />
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big-number">{kpi?.mikrotik.total ?? 2}</span>
            <span className="kpi-unit">Nodes</span>
          </div>
          <div className="kpi-status-breakdown">
            <span className="stat-pill text-emerald-400">✓ {kpi?.mikrotik.healthy ?? 2} Healthy</span>
            <span className="stat-pill text-amber-400">⚠ {kpi?.mikrotik.warning ?? 0} Warn</span>
            <span className="stat-pill text-rose-500">✕ {kpi?.mikrotik.down ?? 0} Down</span>
          </div>
        </div>

        {/* Servers & Core Nodes */}
        <div className="noc-kpi-card kpi-olt" onClick={() => onNavigateTab('matrix')}>
          <div className="kpi-icon-header">
            <span className="kpi-label">SERVERS & CORE NODES</span>
            <Server size={20} className="text-blue-400" />
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big-number">{kpi?.servers?.total ?? 1}</span>
            <span className="kpi-unit">Servers</span>
          </div>
          <div className="kpi-status-breakdown">
            <span className="stat-pill text-emerald-400">✓ {kpi?.servers?.healthy ?? 0} Healthy</span>
            <span className="stat-pill text-amber-400">⚠ {kpi?.servers?.warning ?? 1} Warn</span>
            <span className="stat-pill text-cyan-300">⚡ Live Zabbix</span>
          </div>
        </div>

        {/* MikroTik DHCP Leases */}
        <div className="noc-kpi-card kpi-ap" onClick={() => onNavigateTab('matrix')}>
          <div className="kpi-icon-header">
            <span className="kpi-label">MIKROTIK DHCP LEASES</span>
            <Users size={20} className="text-purple-400" />
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big-number">
              {kpi?.dhcpLeases?.total ?? kpi?.dhcpLeasesCount ?? 0}
            </span>
            <span className="kpi-unit">Leases</span>
          </div>
          <div className="kpi-status-breakdown">
            <span className="stat-pill text-emerald-400">
              ✓ {kpi?.dhcpLeases?.active ?? kpi?.dhcpLeasesCount ?? 0} Bound / Aktif
            </span>
            <span className="stat-pill text-purple-300">
              ⚡ {kpi?.dhcpLeases?.dynamic ? `${kpi.dhcpLeases.dynamic} Dynamic` : 'MikroTik Live'}
            </span>
          </div>
        </div>

        {/* Active Alarm Triggers */}
        <div className="noc-kpi-card kpi-ont" onClick={() => onNavigateTab('problems')}>
          <div className="kpi-icon-header">
            <span className="kpi-label">ACTIVE ALARMS / PROBLEMS</span>
            <ShieldAlert size={20} className="text-amber-400" />
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big-number">{problems.length}</span>
            <span className="kpi-unit">Active</span>
          </div>
          <div className="kpi-status-breakdown">
            <span className="stat-pill text-rose-500">✕ {kpi?.problemsSummary?.disaster ?? 0} Disaster</span>
            <span className="stat-pill text-amber-400">⚠ {kpi?.problemsSummary?.warning ?? problems.length} Warn</span>
            <span className="stat-pill text-cyan-300">✓ {problems.filter((p) => p.acknowledged).length} Acked</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE SPLIT: TOPOLOGY ON LEFT, LIVE ALARMS ON RIGHT */}
      <div className="noc-main-split-grid">
        {/* LEFT: INTERACTIVE TOPOLOGY & MINI TRAFFIC */}
        <div className="noc-left-column">
          <NocTopology 
            devices={devices} 
            onSelectDevice={onSelectDevice} 
            isFullView={false}
            onExpandToFullView={() => onNavigateTab('topology')}
          />

          {/* Mini Bandwidth Preview Bar */}
          <div className="noc-mini-traffic-panel glass-panel">
            <div className="mini-traffic-header">
              <div className="traffic-title">
                <Zap size={16} className="text-cyan-400" />
                <span>Live Backbone Traffic Status</span>
              </div>
              <button className="noc-link-btn" onClick={() => onNavigateTab('bandwidth')}>
                Open Bandwidth Console <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="mini-traffic-stats-row">
              <div className="traffic-stat-item">
                <span className="stat-label">Inbound Traffic</span>
                <span className="stat-val text-cyan-400">{formatSpeed(bandwidth?.totalInboundBps || 3420000000)}</span>
              </div>
              <div className="traffic-stat-item">
                <span className="stat-label">Outbound Traffic</span>
                <span className="stat-val text-emerald-400">{formatSpeed(bandwidth?.totalOutboundBps || 1380000000)}</span>
              </div>
              <div className="traffic-stat-item">
                <span className="stat-label">Peak 24h</span>
                <span className="stat-val text-amber-300">{formatSpeed(bandwidth?.peakInboundBps || 4820000000)}</span>
              </div>
              <div className="traffic-stat-item">
                <span className="stat-label">95th Percentile</span>
                <span className="stat-val text-purple-300">{formatSpeed(bandwidth?.percentile95Bps || 2980000000)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: LIVE INCIDENT & ALARM TICKER */}
        <div className="noc-right-column">
          <div className="noc-alarm-feed-card glass-panel">
            <div className="alarm-feed-header">
              <div className="alarm-header-title">
                <ShieldAlert size={18} className="text-rose-500" />
                <span>ALARM INCIDENT FEED</span>
                <span className="alarm-count-badge">{problems.length} Active</span>
              </div>
              <button className="noc-link-btn" onClick={() => onNavigateTab('problems')}>
                View All <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="alarm-feed-list">
              {problems.length === 0 ? (
                <div className="alarm-empty-state">
                  <CheckCircle2 size={36} className="text-emerald-400" />
                  <p>All network triggers are clear. No active problems detected.</p>
                </div>
              ) : (
                problems.slice(0, 6).map((prob) => (
                  <div key={prob.eventId} className={`alarm-feed-item ${getSeverityBadgeClass(prob.severity)}`}>
                    <div className="alarm-item-top">
                      <span className={`alarm-sev-tag ${getSeverityBadgeClass(prob.severity)}`}>
                        {prob.severityLabel.toUpperCase()}
                      </span>
                      <span className="alarm-time">
                        <Clock size={12} /> {prob.durationText} ago
                      </span>
                    </div>

                    <h4 className="alarm-item-title">{prob.name}</h4>

                    <div className="alarm-item-meta">
                      <span className="device-tag">
                        <code>{prob.deviceIp}</code>
                      </span>
                      {prob.acknowledged ? (
                        <span className="ack-status-tag acked">
                          ✓ Acked by {prob.acknowledgedBy || 'Tech'}
                        </span>
                      ) : (
                        <span className="ack-status-tag unacked">
                          ⚠ Unacked
                        </span>
                      )}
                    </div>

                    <div className="alarm-item-actions">
                      {!prob.acknowledged && (
                        <button
                          className="btn-action-ack"
                          onClick={() => onAcknowledgeProblem(prob)}
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        className="btn-action-view"
                        onClick={() => onNavigateTab('problems')}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
