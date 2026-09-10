export type NocDeviceCategory = 'mikrotik' | 'server' | 'olt' | 'ap' | 'ont';
export type NocDeviceStatus = 'healthy' | 'warning' | 'down';
export type ProblemSeverity = 1 | 2 | 3 | 4 | 5; // 1: Info, 2: Warning, 3: Average, 4: High, 5: Disaster

export interface NocDevice {
  id: string;
  name: string;
  ip: string;
  category: NocDeviceCategory;
  status: NocDeviceStatus;
  location: string;
  uptime: string;
  pingMs: number;
  packetLossPercent?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  opticalDbm?: number; // Rx Optical Power (dBm)
  txOpticalDbm?: number; // Tx Optical Power (dBm)
  opticalTempC?: number; // Optical Laser Temp (°C)
  supplyVoltageV?: number; // Supply Voltage (V)
  biasCurrentMa?: number; // Laser Bias Current (mA)
  signalQuality?: string;
  connectedClients?: number; // for AP & Modem Wi-Fi
  dhcpLeasesCount?: number; // for Modem & Router DHCP
  activePonPorts?: number; // for OLT
  totalOnuCount?: number; // for OLT
  trafficInMbps: number;
  trafficOutMbps: number;
  lanPorts?: Array<{ port: string; status: string; speed?: string; errors?: number }>;
  lastSeen: string;
}

export interface NocProblem {
  eventId: string;
  triggerId: string;
  name: string;
  severity: ProblemSeverity;
  severityLabel: 'Disaster' | 'High' | 'Average' | 'Warning' | 'Info';
  clock: number;
  durationText: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedMessage?: string;
  deviceId?: string;
  deviceName: string;
  deviceIp: string;
  deviceCategory: NocDeviceCategory;
}

export interface InterfaceTrafficInfo {
  id: string;
  deviceName: string;
  interfaceName: string;
  deviceType: NocDeviceCategory;
  capacityBps: number;
  currentInBps: number;
  currentOutBps: number;
  utilizationPercent: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface BandwidthTimeSeriesPoint {
  timestamp: number;
  timeLabel: string;
  inboundMbps: number;
  outboundMbps: number;
}

export interface NocBandwidthData {
  totalInboundBps: number;
  totalOutboundBps: number;
  capacityBps: number;
  inboundUtilizationPercent: number;
  outboundUtilizationPercent: number;
  peakInboundBps: number;
  peakOutboundBps: number;
  percentile95Bps: number;
  topInterfaces: InterfaceTrafficInfo[];
  history24h: BandwidthTimeSeriesPoint[];
}

export interface NocSummaryKPI {
  totalBandwidthGbps: number;
  overallUptimePercent: number;
  totalDevices: number;
  healthyDevices: number;
  warningDevices: number;
  downDevices: number;
  mikrotik: { total: number; healthy: number; warning: number; down: number };
  servers?: { total: number; healthy: number; warning: number; down: number };
  olt?: { total: number; healthy: number; warning: number; down: number; totalOnus?: number };
  ap?: { total: number; healthy: number; warning: number; down: number; totalClients?: number };
  ont?: { total: number; healthy: number; warning: number; down: number };
  subnetsCount?: number;
  dhcpLeasesCount?: number;
  dhcpLeases?: {
    total: number;
    active: number;
    dynamic?: number;
    static?: number;
    source?: string;
  };
  problemsSummary: {
    disaster: number;
    high: number;
    warning: number;
    info: number;
    total: number;
    unackedCount: number;
  };
}

// ==========================================
// DIAGNOSTIC TYPES
// ==========================================

export interface NocPingSequence {
  seq: number;
  host: string;
  bytes: number;
  ttl: number;
  timeMs: number;
  status: 'ok' | 'timeout' | 'error';
}

export interface NocPingResult {
  target: string;
  sourceIp: string;
  packetsTransmitted: number;
  packetsReceived: number;
  packetLossPercent: number;
  minRttMs: number;
  avgRttMs: number;
  maxRttMs: number;
  stdDevMs: number;
  jitterMs: number;
  sequences: NocPingSequence[];
  rawOutput?: string;
}

export interface NocTracerouteHop {
  hop: number;
  ip: string;
  host: string;
  rtt1: number;
  rtt2: number;
  rtt3: number;
  avgRtt: number;
  status: 'ok' | 'partial' | 'timeout';
  locationOrAsn?: string;
}

export interface NocTracerouteResult {
  target: string;
  sourceIp: string;
  totalHops: number;
  completed: boolean;
  hops: NocTracerouteHop[];
  rawOutput?: string;
}

export interface NocBtestSample {
  second: number;
  rxMbps: number;
  txMbps: number;
  totalMbps: number;
  jitterMs: number;
  lossPercent: number;
}

export interface NocBtestResult {
  targetIp: string;
  direction: 'receive' | 'transmit' | 'both';
  durationSec: number;
  protocol: 'udp' | 'tcp';
  avgThroughputMbps: number;
  peakThroughputMbps: number;
  avgRxMbps: number;
  avgTxMbps: number;
  totalDataTransferredMB: number;
  history: NocBtestSample[];
}

export interface NocPortCheckItem {
  port: number;
  serviceName: string;
  isOpen: boolean;
  latencyMs: number;
  error?: string;
}

export interface NocPortCheckResult {
  target: string;
  checkedAt: string;
  ports: NocPortCheckItem[];
}

