import { RouterOSAPI } from 'node-routeros';
import { pool } from './db';

let currentClient: RouterOSAPI | null = null;
let lastConnectedTime: number = 0;

export async function getMikrotikConfig() {
  const [rows] = await pool.query('SELECT * FROM mikrotik_credentials ORDER BY id DESC LIMIT 1') as any;
  return rows[0] || null;
}

export async function connectMikrotik() {
  const cfg = await getMikrotikConfig();
  if (!cfg) throw new Error('Mikrotik config not found');

  // Reuse client if connected within last 1 minute to avoid constant reconnects
  if (currentClient && currentClient.connected && (Date.now() - lastConnectedTime < 60000)) {
    return currentClient;
  }

  if (currentClient) {
    currentClient.close().catch(() => {});
  }

  currentClient = new RouterOSAPI({
    host: cfg.host,
    user: cfg.username,
    password: cfg.password,
    port: cfg.port || 8728,
    timeout: 10
  });

  await currentClient.connect();
  lastConnectedTime = Date.now();
  
  // Update DB status
  await pool.query('UPDATE mikrotik_credentials SET is_connected = 1, last_test = NOW() WHERE id = ?', [cfg.id]);

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

