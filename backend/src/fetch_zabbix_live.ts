import dotenv from 'dotenv';
dotenv.config();

const url = process.env.ZABBIX_API_URL;
const token = process.env.ZABBIX_API_TOKEN;

console.log('--- Zabbix API Connection Test ---');
console.log('URL:', url);
console.log('Token exists:', !!token);

async function callZabbix(method: string, params: any) {
  if (!url) {
    throw new Error('ZABBIX_API_URL not set in .env');
  }
  const payload = {
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now(),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json-rpc',
  };
  if (token && method !== 'apiinfo.version') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const data: any = await res.json();
  if (data.error) {
    console.error(`Error in [${method}]:`, data.error);
    return null;
  }
  return data.result;
}

async function main() {
  try {
    console.log('\n1. Checking Zabbix API Version...');
    const version = await callZabbix('apiinfo.version', []);
    console.log('✅ Zabbix API Version:', version);

    console.log('\n2. Fetching Host Groups...');
    const hostGroups = await callZabbix('hostgroup.get', {
      output: ['groupid', 'name'],
    });
    console.log(`Found ${hostGroups?.length || 0} Host Groups:`);
    for (const g of hostGroups || []) {
      console.log(` - ID: ${g.groupid} | Name: "${g.name}"`);
    }

    console.log('\n3. Fetching All Hosts (including OLT C-Data)...');
    const hosts = await callZabbix('host.get', {
      output: ['hostid', 'host', 'name', 'status', 'available', 'description'],
      selectInterfaces: ['interfaceid', 'ip', 'port', 'type', 'main'],
      selectHostGroups: ['groupid', 'name'],
      selectGroups: ['groupid', 'name'],
      selectTags: ['tag', 'value'],
      selectItems: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'status'],
      selectDiscoveries: ['itemid', 'name', 'key_'],
    });

    console.log(`\n✅ Total Hosts Returned: ${hosts?.length || 0}`);
    for (const h of hosts || []) {
      const groups = h.hostgroups || h.groups || [];
      const groupNames = groups.map((g: any) => g.name).join(', ');
      const ip = h.interfaces?.[0]?.ip || 'N/A';
      console.log(`\n========================================`);
      console.log(`Host ID: ${h.hostid}`);
      console.log(`Host / Name: "${h.host}" / "${h.name}"`);
      console.log(`IP: ${ip} (Status: ${h.status === '0' ? 'Monitored' : 'Unmonitored'}, Available: ${h.available})`);
      console.log(`Groups: [${groupNames}]`);
      console.log(`Tags:`, h.tags || []);
      console.log(`Total Items: ${h.items?.length || 0}`);
      
      // Look for OLT / PON / Optical / Interface items
      const interestingItems = (h.items || []).filter((it: any) => {
        const n = (it.name || '').toLowerCase();
        const k = (it.key_ || '').toLowerCase();
        return (
          n.includes('olt') ||
          n.includes('pon') ||
          n.includes('onu') ||
          n.includes('optical') ||
          n.includes('power') ||
          n.includes('traffic') ||
          n.includes('cpu') ||
          n.includes('temp') ||
          n.includes('cdata') ||
          n.includes('ping') ||
          n.includes('uptime') ||
          k.includes('pon') ||
          k.includes('onu') ||
          k.includes('optical')
        );
      });

      if (interestingItems.length > 0) {
        console.log(`Notable Items (${interestingItems.length}):`);
        for (const item of interestingItems.slice(0, 15)) {
          console.log(`   * [${item.key_}] ${item.name} => "${item.lastvalue}" ${item.units || ''}`);
        }
        if (interestingItems.length > 15) {
          console.log(`   ... and ${interestingItems.length - 15} more items`);
        }
      } else if (h.items?.length > 0) {
        console.log(`Sample Items (first 5):`);
        for (const item of h.items.slice(0, 5)) {
          console.log(`   * [${item.key_}] ${item.name} => "${item.lastvalue}" ${item.units || ''}`);
        }
      }
    }

    console.log('\n4. Fetching Active Problems / Triggers...');
    const problems = await callZabbix('problem.get', {
      output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'acknowledged'],
      recent: false,
      limit: 10,
    });
    console.log(`Found ${problems?.length || 0} active problems:`);
    for (const p of problems || []) {
      console.log(` - [Severity ${p.severity}] ${p.name} (Event ID: ${p.eventid})`);
    }

  } catch (err: any) {
    console.error('Execution error:', err.message || err);
  }
}

main();
