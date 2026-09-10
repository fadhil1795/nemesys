import React, { useState } from 'react';
import { 
  Terminal, 
  Compass, 
  Zap, 
  ShieldCheck, 
  Play, 
  RefreshCw, 
  Clock, 
  Gauge, 
  ArrowDownRight, 
  ArrowUpRight, 
  Copy, 
  Check, 
  Layers, 
  Globe
} from 'lucide-react';
import type { 
  NocPingResult, 
  NocTracerouteResult, 
  NocBtestResult, 
  NocPortCheckResult 
} from '../../types/noc';
import { BACKEND_URL } from '../../App';

interface Props {
  initialTarget?: string;
  initialTool?: 'ping' | 'traceroute' | 'btest' | 'portcheck';
  token?: string;
  isCompact?: boolean;
}

export const NocDiagnostics: React.FC<Props> = ({
  initialTarget = '8.8.8.8',
  initialTool = 'ping',
  token,
  isCompact = false,
}) => {
  const [activeTool, setActiveTool] = useState<'ping' | 'traceroute' | 'btest' | 'portcheck'>(initialTool);
  const [target, setTarget] = useState<string>(initialTarget);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Ping Form State
  const [pingCount, setPingCount] = useState<number>(5);
  const [packetSize, setPacketSize] = useState<number>(56);
  const [pingResult, setPingResult] = useState<NocPingResult | null>(null);

  // Traceroute Form State
  const [maxHops, setMaxHops] = useState<number>(12);
  const [tracerouteResult, setTracerouteResult] = useState<NocTracerouteResult | null>(null);

  // BTest Form State
  const [btestDirection, setBtestDirection] = useState<'both' | 'receive' | 'transmit'>('both');
  const [btestProtocol, setBtestProtocol] = useState<'udp' | 'tcp'>('udp');
  const [btestDuration, setBtestDuration] = useState<number>(6);
  const [btestResult, setBtestResult] = useState<NocBtestResult | null>(null);

  // Port Check Form State
  const [portCheckResult, setPortCheckResult] = useState<NocPortCheckResult | null>(null);

  // Quick Preset Targets
  const quickPresets = [
    { label: 'Google DNS', value: '8.8.8.8' },
    { label: 'Cloudflare', value: '1.1.1.1' },
    { label: 'Gateway NOC', value: '10.10.0.1' },
    { label: 'OLT Backbone', value: '172.16.10.1' },
    { label: 'MikroTik Core', value: '10.10.0.2' },
  ];

  const handleCopyTarget = () => {
    navigator.clipboard.writeText(target);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. EXECUTE PING
  const handleRunPing = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setPingResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/diagnostics/ping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ target: target.trim(), count: pingCount, packetSize }),
      });

      if (res.ok) {
        const data: NocPingResult = await res.json();
        setPingResult(data);
      }
    } catch (err) {
      console.error('Ping test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. EXECUTE TRACEROUTE
  const handleRunTraceroute = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setTracerouteResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/diagnostics/traceroute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ target: target.trim(), maxHops }),
      });

      if (res.ok) {
        const data: NocTracerouteResult = await res.json();
        setTracerouteResult(data);
      }
    } catch (err) {
      console.error('Traceroute test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. EXECUTE BTEST
  const handleRunBtest = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setBtestResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/diagnostics/btest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetIp: target.trim(),
          direction: btestDirection,
          durationSec: btestDuration,
          protocol: btestProtocol,
        }),
      });

      if (res.ok) {
        const data: NocBtestResult = await res.json();
        setBtestResult(data);
      }
    } catch (err) {
      console.error('Bandwidth test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. EXECUTE PORT CHECK
  const handleRunPortCheck = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setPortCheckResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/monitoring/diagnostics/port-check`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ target: target.trim() }),
      });

      if (res.ok) {
        const data: NocPortCheckResult = await res.json();
        setPortCheckResult(data);
      }
    } catch (err) {
      console.error('Port check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`noc-diag-container ${isCompact ? 'compact' : ''}`}>
      {/* 1. TOP TOOL SWITCHER BAR */}
      <div className="noc-diag-nav-bar">
        <div className="noc-diag-tabs">
          <button
            className={`diag-tab-btn ${activeTool === 'ping' ? 'active' : ''}`}
            onClick={() => setActiveTool('ping')}
          >
            <Terminal size={16} />
            <span>Live ICMP Ping</span>
          </button>
          <button
            className={`diag-tab-btn ${activeTool === 'traceroute' ? 'active' : ''}`}
            onClick={() => setActiveTool('traceroute')}
          >
            <Compass size={16} />
            <span>Traceroute / MTR</span>
          </button>
          <button
            className={`diag-tab-btn ${activeTool === 'btest' ? 'active' : ''}`}
            onClick={() => setActiveTool('btest')}
          >
            <Zap size={16} />
            <span>Bandwidth Test (BTest)</span>
          </button>
          <button
            className={`diag-tab-btn ${activeTool === 'portcheck' ? 'active' : ''}`}
            onClick={() => setActiveTool('portcheck')}
          >
            <ShieldCheck size={16} />
            <span>Port Scanner</span>
          </button>
        </div>

        {/* Quick Target Input */}
        <div className="noc-diag-target-box">
          <div className="target-input-wrap">
            <Globe size={16} className="text-cyan-400" />
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="IP Target / Hostname (e.g. 8.8.8.8)"
              className="target-input"
            />
            <button
              className="copy-btn"
              onClick={handleCopyTarget}
              title="Salin Target"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Presets */}
          <div className="target-presets">
            {quickPresets.map((p) => (
              <button
                key={p.value}
                className={`preset-pill ${target === p.value ? 'active' : ''}`}
                onClick={() => setTarget(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. ACTIVE TOOL BODY */}
      <div className="noc-diag-body">
        {/* ==================================================== */}
        {/* TAB 1: PING */}
        {/* ==================================================== */}
        {activeTool === 'ping' && (
          <div className="diag-section-card glass-panel">
            <div className="diag-controls-row">
              <div className="control-group">
                <label>Packet Count:</label>
                <select
                  value={pingCount}
                  onChange={(e) => setPingCount(Number(e.target.value))}
                  className="noc-select select-sm"
                >
                  <option value={4}>4 Packets</option>
                  <option value={8}>8 Packets</option>
                  <option value={15}>15 Packets</option>
                  <option value={20}>20 Packets (Stress)</option>
                </select>
              </div>

              <div className="control-group">
                <label>Packet Size:</label>
                <select
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className="noc-select select-sm"
                >
                  <option value={32}>32 Bytes (Standard)</option>
                  <option value={56}>56 Bytes (ICMP Echo)</option>
                  <option value={1472}>1472 Bytes (MTU 1500 Test)</option>
                </select>
              </div>

              <button
                className="btn-run-diag"
                onClick={handleRunPing}
                disabled={loading || !target.trim()}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{loading ? 'Pinging...' : 'Start Ping'}</span>
              </button>
            </div>

            {/* Ping Result Stats */}
            {pingResult && (
              <div className="diag-stats-grid">
                <div className="diag-stat-card">
                  <div className="stat-label">Min Latency</div>
                  <div className="stat-val text-emerald-400">{pingResult.minRttMs} ms</div>
                </div>
                <div className="diag-stat-card">
                  <div className="stat-label">Avg Latency</div>
                  <div className="stat-val text-cyan-400">{pingResult.avgRttMs} ms</div>
                </div>
                <div className="diag-stat-card">
                  <div className="stat-label">Max Latency</div>
                  <div className="stat-val text-amber-400">{pingResult.maxRttMs} ms</div>
                </div>
                <div className="diag-stat-card">
                  <div className="stat-label">Packet Loss</div>
                  <div className={`stat-val ${pingResult.packetLossPercent > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {pingResult.packetLossPercent}%
                  </div>
                </div>
                <div className="diag-stat-card">
                  <div className="stat-label">Jitter / StdDev</div>
                  <div className="stat-val text-purple-400">±{pingResult.jitterMs} ms</div>
                </div>
              </div>
            )}

            {/* Terminal Live Output */}
            <div className="diag-terminal-box">
              <div className="terminal-header">
                <div className="term-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <span className="term-title">ICMP Echo Sequence: {target}</span>
                <span className="term-source">From: {pingResult?.sourceIp || 'NOC Core Gateway'}</span>
              </div>
              <div className="terminal-content">
                {!pingResult && !loading && (
                  <div className="term-empty">
                    <Terminal size={24} className="text-slate-600 mb-2" />
                    <span>Klik <strong>Start Ping</strong> untuk memulai pengujian konektivitas & latensi.</span>
                  </div>
                )}
                {loading && (
                  <div className="term-loading">
                    <RefreshCw size={20} className="animate-spin text-cyan-400 mb-2" />
                    <span>Transmitting ICMP Echo packets to {target}...</span>
                  </div>
                )}
                {pingResult && (
                  <div className="term-lines">
                    <div className="term-line info">
                      PING {pingResult.target} ({pingResult.target}): {packetSize} data bytes
                    </div>
                    {pingResult.sequences.map((s) => (
                      <div
                        key={s.seq}
                        className={`term-line seq-line ${s.status === 'ok' ? 'ok' : 'timeout'}`}
                      >
                        <span className="seq-badge">#{s.seq}</span>
                        {s.status === 'ok' ? (
                          <>
                            <span className="text-slate-400">{s.bytes} bytes from {s.host}:</span>
                            <span className="text-cyan-300">icmp_seq={s.seq}</span>
                            <span className="text-slate-400">ttl={s.ttl}</span>
                            <span className={`time-chip ${s.timeMs > 50 ? 'high' : s.timeMs > 20 ? 'med' : 'low'}`}>
                              time={s.timeMs} ms
                            </span>
                          </>
                        ) : (
                          <span className="text-rose-400 font-semibold">Request timed out. (Packet Lost)</span>
                        )}
                      </div>
                    ))}
                    <div className="term-line summary">
                      --- {pingResult.target} ping statistics ---<br />
                      {pingResult.packetsTransmitted} packets transmitted, {pingResult.packetsReceived} received, {pingResult.packetLossPercent}% packet loss<br />
                      rtt min/avg/max/mdev = {pingResult.minRttMs}/{pingResult.avgRttMs}/{pingResult.maxRttMs}/{pingResult.jitterMs} ms
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TRACEROUTE */}
        {/* ==================================================== */}
        {activeTool === 'traceroute' && (
          <div className="diag-section-card glass-panel">
            <div className="diag-controls-row">
              <div className="control-group">
                <label>Max Hops:</label>
                <select
                  value={maxHops}
                  onChange={(e) => setMaxHops(Number(e.target.value))}
                  className="noc-select select-sm"
                >
                  <option value={8}>8 Hops (Local/Metro)</option>
                  <option value={12}>12 Hops (Standard)</option>
                  <option value={20}>20 Hops (Transit Global)</option>
                </select>
              </div>

              <button
                className="btn-run-diag"
                onClick={handleRunTraceroute}
                disabled={loading || !target.trim()}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{loading ? 'Tracing Route...' : 'Start Traceroute'}</span>
              </button>
            </div>

            {/* Traceroute Visual Table & Hop Tree */}
            <div className="traceroute-results-wrap">
              {!tracerouteResult && !loading && (
                <div className="term-empty">
                  <Compass size={24} className="text-slate-600 mb-2" />
                  <span>Klik <strong>Start Traceroute</strong> untuk memetakan seluruh hop & router perantara.</span>
                </div>
              )}

              {loading && (
                <div className="term-loading">
                  <RefreshCw size={24} className="animate-spin text-cyan-400 mb-2" />
                  <span>Probing gateway and backbone router hops to {target}...</span>
                </div>
              )}

              {tracerouteResult && (
                <div className="hops-timeline">
                  <div className="hops-header-summary">
                    <div className="summary-pill">
                      <span>Target:</span> <strong>{tracerouteResult.target}</strong>
                    </div>
                    <div className="summary-pill">
                      <span>Total Hops:</span> <strong>{tracerouteResult.totalHops}</strong>
                    </div>
                    <div className="summary-pill">
                      <span>Status:</span>{' '}
                      <strong className={tracerouteResult.completed ? 'text-emerald-400' : 'text-amber-400'}>
                        {tracerouteResult.completed ? 'Reached Target' : 'Partial Hops'}
                      </strong>
                    </div>
                  </div>

                  <div className="hops-list">
                    {tracerouteResult.hops.map((h) => (
                      <div key={h.hop} className={`hop-card ${h.status}`}>
                        <div className="hop-left">
                          <div className="hop-number">{h.hop}</div>
                          <div className="hop-connector-line"></div>
                        </div>

                        <div className="hop-content">
                          <div className="hop-top">
                            <div className="hop-ip-block">
                              <span className="hop-ip">{h.ip}</span>
                              <span className="hop-host">{h.host}</span>
                            </div>
                            {h.locationOrAsn && (
                              <span className="hop-asn-badge">{h.locationOrAsn}</span>
                            )}
                          </div>

                          <div className="hop-rtt-bar-row">
                            <div className="rtt-pills">
                              <span className="rtt-val">{h.rtt1} ms</span>
                              <span className="rtt-val">{h.rtt2} ms</span>
                              <span className="rtt-val">{h.rtt3} ms</span>
                            </div>
                            <div className="hop-avg-rtt">
                              Avg: <strong className={h.avgRtt > 50 ? 'text-amber-400' : 'text-emerald-400'}>{h.avgRtt} ms</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: BANDWIDTH TEST (BTEST) */}
        {/* ==================================================== */}
        {activeTool === 'btest' && (
          <div className="diag-section-card glass-panel">
            <div className="diag-controls-row">
              <div className="control-group">
                <label>Direction:</label>
                <select
                  value={btestDirection}
                  onChange={(e) => setBtestDirection(e.target.value as any)}
                  className="noc-select select-sm"
                >
                  <option value="both">Both (Bi-directional)</option>
                  <option value="receive">Receive (Download Only)</option>
                  <option value="transmit">Transmit (Upload Only)</option>
                </select>
              </div>

              <div className="control-group">
                <label>Protocol:</label>
                <select
                  value={btestProtocol}
                  onChange={(e) => setBtestProtocol(e.target.value as any)}
                  className="noc-select select-sm"
                >
                  <option value="udp">UDP (Max Pipe Throughput)</option>
                  <option value="tcp">TCP (Reliable Flow)</option>
                </select>
              </div>

              <div className="control-group">
                <label>Duration:</label>
                <select
                  value={btestDuration}
                  onChange={(e) => setBtestDuration(Number(e.target.value))}
                  className="noc-select select-sm"
                >
                  <option value={5}>5 Seconds</option>
                  <option value={10}>10 Seconds</option>
                  <option value={15}>15 Seconds</option>
                </select>
              </div>

              <button
                className="btn-run-diag"
                onClick={handleRunBtest}
                disabled={loading || !target.trim()}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{loading ? 'Testing Throughput...' : 'Start BTest'}</span>
              </button>
            </div>

            {/* BTest Throughput Gauges & Summary */}
            {btestResult && (
              <div className="btest-results-container">
                <div className="btest-gauges-grid">
                  <div className="btest-card main-speed">
                    <div className="card-top">
                      <Gauge size={20} className="text-cyan-400" />
                      <span>AVG TOTAL THROUGHPUT</span>
                    </div>
                    <div className="speed-huge text-cyan-400">
                      {btestResult.avgThroughputMbps} <span className="unit">Mbps</span>
                    </div>
                    <div className="speed-sub">
                      Peak Burst: <strong className="text-emerald-400">{btestResult.peakThroughputMbps} Mbps</strong>
                    </div>
                  </div>

                  <div className="btest-card rx-speed">
                    <div className="card-top">
                      <ArrowDownRight size={20} className="text-emerald-400" />
                      <span>AVG RECEIVE (RX)</span>
                    </div>
                    <div className="speed-huge text-emerald-400">
                      {btestResult.avgRxMbps} <span className="unit">Mbps</span>
                    </div>
                    <div className="speed-sub">Download Stream</div>
                  </div>

                  <div className="btest-card tx-speed">
                    <div className="card-top">
                      <ArrowUpRight size={20} className="text-blue-400" />
                      <span>AVG TRANSMIT (TX)</span>
                    </div>
                    <div className="speed-huge text-blue-400">
                      {btestResult.avgTxMbps} <span className="unit">Mbps</span>
                    </div>
                    <div className="speed-sub">Upload Stream</div>
                  </div>

                  <div className="btest-card data-card">
                    <div className="card-top">
                      <Layers size={20} className="text-purple-400" />
                      <span>DATA TRANSFERRED</span>
                    </div>
                    <div className="speed-huge text-purple-400">
                      {btestResult.totalDataTransferredMB} <span className="unit">MB</span>
                    </div>
                    <div className="speed-sub">Duration: {btestResult.durationSec}s | {btestResult.protocol.toUpperCase()}</div>
                  </div>
                </div>

                {/* Timeline Chart Bars */}
                <div className="btest-history-box">
                  <div className="btest-history-title">Realtime Second-by-Second Throughput Stream</div>
                  <div className="btest-bars-stream">
                    {btestResult.history.map((h) => (
                      <div key={h.second} className="stream-bar-col">
                        <div className="bar-labels">
                          <span className="text-emerald-400 font-bold">{h.totalMbps}M</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill-tx"
                            style={{ height: `${Math.min(100, (h.txMbps / (btestResult.peakThroughputMbps || 1)) * 100)}%` }}
                            title={`Tx: ${h.txMbps} Mbps`}
                          ></div>
                          <div
                            className="bar-fill-rx"
                            style={{ height: `${Math.min(100, (h.rxMbps / (btestResult.peakThroughputMbps || 1)) * 100)}%` }}
                            title={`Rx: ${h.rxMbps} Mbps`}
                          ></div>
                        </div>
                        <div className="bar-sec">s{h.second}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!btestResult && !loading && (
              <div className="term-empty">
                <Zap size={24} className="text-slate-600 mb-2" />
                <span>Klik <strong>Start BTest</strong> untuk mengukur kapasitas throughput pipa bandwidth real-time.</span>
              </div>
            )}

            {loading && (
              <div className="term-loading">
                <RefreshCw size={24} className="animate-spin text-cyan-400 mb-2" />
                <span>Generating high-throughput stream to {target} ({btestProtocol.toUpperCase()})...</span>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: PORT SCANNER */}
        {/* ==================================================== */}
        {activeTool === 'portcheck' && (
          <div className="diag-section-card glass-panel">
            <div className="diag-controls-row">
              <span className="text-sm text-slate-300">
                Pindai status keterbukaan port penting jaringan (Winbox, API, SSH, HTTP, DNS, SNMP, dsb.)
              </span>

              <button
                className="btn-run-diag"
                onClick={handleRunPortCheck}
                disabled={loading || !target.trim()}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{loading ? 'Scanning Ports...' : 'Scan Essential Ports'}</span>
              </button>
            </div>

            {portCheckResult && (
              <div className="ports-grid">
                {portCheckResult.ports.map((p) => (
                  <div key={p.port} className={`port-card ${p.isOpen ? 'open' : 'closed'}`}>
                    <div className="port-header">
                      <div className="port-num">Port {p.port}</div>
                      <span className={`port-status-badge ${p.isOpen ? 'badge-open' : 'badge-closed'}`}>
                        {p.isOpen ? 'OPEN' : 'CLOSED / FILTERED'}
                      </span>
                    </div>
                    <div className="port-name">{p.serviceName}</div>
                    <div className="port-footer">
                      <Clock size={12} />
                      <span>{p.isOpen ? `Response in ${p.latencyMs}ms` : p.error || 'Connection Refused'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!portCheckResult && !loading && (
              <div className="term-empty">
                <ShieldCheck size={24} className="text-slate-600 mb-2" />
                <span>Klik <strong>Scan Essential Ports</strong> untuk memeriksa ketersediaan port servis target.</span>
              </div>
            )}

            {loading && (
              <div className="term-loading">
                <RefreshCw size={24} className="animate-spin text-cyan-400 mb-2" />
                <span>Scanning TCP ports on {target}...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
