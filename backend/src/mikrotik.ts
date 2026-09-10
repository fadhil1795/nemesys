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

