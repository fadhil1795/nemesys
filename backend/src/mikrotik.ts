import { RouterOSAPI } from 'node-routeros';
import { pool } from './db';

let currentClient: RouterOSAPI | null = null;
let lastConnectedTime: number = 0;

export async function getMikrotikConfig() {
  const [rows] = await pool.query('SELECT * FROM mikrotik_credentials ORDER BY id DESC LIMIT 1') as any;
  if (rows && rows[0]) return rows[0];

  // Fallback to environment variables if available
  if (process.env.MIKROTIK_HOST && process.env.MIKROTIK_USER) {
    return {
      host: process.env.MIKROTIK_HOST,
      port: Number(process.env.MIKROTIK_PORT) || 8728,
      username: process.env.MIKROTIK_USER,
      password: process.env.MIKROTIK_PASSWORD || '',
    };
  }

  return null;
}

export async function connectMikrotik() {
  const cfg = await getMikrotikConfig();
  if (!cfg) throw new Error('Mikrotik config not found in DB or .env');

  // Reuse client if connected within last 1 minute to avoid constant reconnects
  if (currentClient && currentClient.connected && (Date.now() - lastConnectedTime < 60000)) {
    return currentClient;
  }

  if (currentClient) {
    currentClient.close().catch(() => {});
  }

  const port = Number(cfg.port) || 8728;
  const isTls = port === 8729 || cfg.use_tls === 1 || cfg.use_tls === true;

  currentClient = new RouterOSAPI({
    host: cfg.host,
    user: cfg.username,
    password: cfg.password,
    port: port,
    timeout: 10,
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
  });

  try {
    currentClient.on('error', (e: any) => console.warn('RouterOS socket error:', e?.errno || e?.message || e));
    await currentClient.connect();
  } catch (err: any) {
    // If port 8729 or plain failed, try with/without TLS fallback
    if (!isTls && port === 8729) {
      currentClient = new RouterOSAPI({
        host: cfg.host,
        user: cfg.username,
        password: cfg.password,
        port: 8729,
        timeout: 10,
        tls: { rejectUnauthorized: false }
      });
      await currentClient.connect();
    } else {
      throw err;
    }
  }

  lastConnectedTime = Date.now();
  
  // Update DB status if config exists in DB
  if (cfg.id) {
    await pool.query('UPDATE mikrotik_credentials SET is_connected = 1, last_test = NOW() WHERE id = ?', [cfg.id]).catch(() => {});
  }

  return currentClient;
}

export async function getNetwatchList() {
  const client: any = await connectMikrotik();
  if (typeof client.menu === 'function') return await client.menu('/tool/netwatch').get();
  return await client.write('/tool/netwatch/print');
}

export async function getHotspotActive() {
  const client: any = await connectMikrotik();
  if (typeof client.menu === 'function') return await client.menu('/ip/hotspot/active').get();
  return await client.write('/ip/hotspot/active/print');
}

export async function getDhcpLeases() {
  const client: any = await connectMikrotik();
  if (typeof client.menu === 'function') return await client.menu('/ip/dhcp-server/lease').get();
  return await client.write('/ip/dhcp-server/lease/print');
}

export async function getArpList() {
  const client: any = await connectMikrotik();
  if (typeof client.menu === 'function') return await client.menu('/ip/arp').get();
  return await client.write('/ip/arp/print');
}

let logFetchCooldownUntil = 0;

export async function getMikrotikLogs() {
  if (Date.now() < logFetchCooldownUntil) return [];
  try {
    const client: any = await connectMikrotik();
    if (typeof client.menu === 'function') return await client.menu('/log').get();
    return await client.write('/log/print');
  } catch (err: any) {
    // Back off for 60s so the 5s dashboard polling doesn't hammer an unreachable API port
    logFetchCooldownUntil = Date.now() + 60_000;
    if (currentClient) { currentClient.close().catch(() => {}); currentClient = null; }
    console.warn(`RouterOS API log fetch failed (${err?.errno || ''} ${err?.message || err}). Retry in 60s.`);
    return [];
  }
}

export interface MikrotikSecuritySnapshot {
  metrics: Array<{ label: string; value: string | number; status: 'safe' | 'warning' | 'critical'; highlight?: boolean; hint?: string }>;
  windowLabel: string;
  source: 'routeros';
}

let securityCache: { at: number; data: MikrotikSecuritySnapshot } | null = null;

async function safeWrite(client: any, cmd: string, params: string[] = []): Promise<any[]> {
  try {
    const r = await client.write(cmd, params);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

/**
 * Real security metrics from the live MikroTik (RouterOS API, read-only):
 *  - failed logins & DHCP/ARP anomalies  -> parsed from the /log buffer
 *  - auto-blocked IPs                    -> dynamic entries in /ip/firewall/address-list
 *  - rogue DHCP servers                  -> /ip/dhcp-server/alert (unknown-server)
 *  - RouterOS version / update status    -> /system/resource + /system/package/update
 * Cached for 30s so the 5s dashboard polling stays light.
 */
export async function getMikrotikSecuritySnapshot(logs: any[]): Promise<MikrotikSecuritySnapshot | null> {
  if (securityCache && Date.now() - securityCache.at < 30_000) return securityCache.data;
  if (!Array.isArray(logs) || logs.length === 0) return null;

  let client: any;
  try {
    client = await connectMikrotik();
  } catch {
    return null;
  }

  // 1. Log buffer analysis
  const msg = (l: any) => String(l.message || '');
  const failedLogins = logs.filter((l) => /authentication failed|login failure/i.test(msg(l)));
  const failedSources = new Set(
    failedLogins.map((l) => msg(l).match(/from\s+([\d.]+)/i)?.[1]).filter(Boolean) as string[]
  );
  const viaPpp = failedLogins.filter((l) => /ppp|pptp|l2tp|sstp/i.test(String(l.topics || ''))).length;
  const dhcpFailed = logs.filter((l) => /offering lease .* without success/i.test(msg(l))).length;
  const arpConflicts = logs.filter((l) => /conflict by ARP/i.test(msg(l))).length;
  const rogueFromLog = logs.filter((l) => /unknown dhcp server|dhcp alert/i.test(msg(l))).length;

  // 2. Auto-blocked IPs (dynamic address-list entries = added by firewall rules with timeout)
  const [dynList, dhcpAlerts, resource, pkgUpdate] = await Promise.all([
    safeWrite(client, '/ip/firewall/address-list/print', ['?dynamic=true']),
    safeWrite(client, '/ip/dhcp-server/alert/print'),
    safeWrite(client, '/system/resource/print'),
    safeWrite(client, '/system/package/update/print'),
  ]);
  const listNames = Array.from(new Set(dynList.map((e: any) => e.list).filter(Boolean)));

  // 3. Rogue DHCP
  const alertsConfigured = dhcpAlerts.length > 0;
  const rogueServers = dhcpAlerts.reduce((sum: number, a: any) => {
    const u = String(a['unknown-server'] || '').trim();
    return sum + (u ? u.split(',').filter(Boolean).length : 0);
  }, 0) + rogueFromLog;

  // 4. RouterOS version
  const version = String(resource[0]?.version || pkgUpdate[0]?.['installed-version'] || '-');
  const installed = String(pkgUpdate[0]?.['installed-version'] || version.split(' ')[0]);
  const latest = String(pkgUpdate[0]?.['latest-version'] || '');
  const outdated = !!latest && latest !== installed;
  const board = String(resource[0]?.['board-name'] || '');

  const firstTime = String(logs[0]?.time || '');
  const data: MikrotikSecuritySnapshot = {
    source: 'routeros',
    windowLabel: `Live RouterOS · ${logs.length} log sejak ${firstTime}`,
    metrics: [
      {
        label: 'Login gagal (Winbox/SSH/PPP)',
        value: failedLogins.length,
        status: failedLogins.length >= 20 ? 'critical' : failedLogins.length > 0 ? 'warning' : 'safe',
        hint: `${viaPpp} via PPP/PPTP${failedSources.size ? ` · ${failedSources.size} IP sumber` : ''}`,
      },
      {
        label: 'IP diblokir otomatis',
        value: dynList.length,
        status: 'safe',
        hint: listNames.length ? `list: ${listNames.slice(0, 3).join(', ')}` : 'tidak ada address-list dinamis',
      },
      {
        label: 'Rogue DHCP terdeteksi',
        value: alertsConfigured || rogueFromLog ? rogueServers : 'Belum diaktifkan',
        status: rogueServers > 0 ? 'critical' : alertsConfigured ? 'safe' : 'warning',
        highlight: !alertsConfigured && !rogueFromLog,
        hint: alertsConfigured ? `${dhcpAlerts.length} interface dipantau` : '/ip dhcp-server alert belum dikonfigurasi',
      },
      {
        label: 'DHCP gagal memberi lease',
        value: dhcpFailed,
        status: dhcpFailed > 50 ? 'warning' : 'safe',
        hint: 'offering lease ... without success',
      },
      {
        label: 'Konflik IP (ARP)',
        value: arpConflicts,
        status: arpConflicts > 0 ? 'warning' : 'safe',
        hint: 'Detected conflict by ARP response',
      },
      {
        label: 'Versi RouterOS',
        value: outdated ? `${installed} → ${latest}` : `v${installed}`,
        status: outdated ? 'warning' : 'safe',
        highlight: outdated,
        hint: `${board}${latest ? (outdated ? ' · update tersedia' : ' · terbaru') : ''}`,
      },
    ],
  };

  securityCache = { at: Date.now(), data };
  return data;
}



