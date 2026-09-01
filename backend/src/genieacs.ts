/**
 * GenieACS API Client (TypeScript)
 * Port dari lib/GenieACS.php ke Node.js/TypeScript
 * Mendukung seluruh operasi TR-069 yang dibutuhkan Nemesys.
 */

export interface GenieACSConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface GenieACSDevice {
  _id: string;
  serialNumber: string;
  oui: string;
  manufacturer: string;
  productClass: string;
  hardwareVersion: string;
  softwareVersion: string;
  macAddress: string;
  ipAddress: string;
  ipTr069: string;
  status: 'online' | 'offline';
  lastInform: string | null;
  lastInformTs: number | null;
  uptime: string;
  wifiSsid: string;
  wifiPassword: string;
  rxPower: string | number | null;
  temperature: string | number | null;
  ping: number | null;
  wanDetails: WanDetail[];
  raw?: Record<string, any>;
}

export interface WanDetail {
  type: 'PPPoE' | 'IP';
  name: string;
  status: string;
  connectionType: string;
  externalIp: string;
  gateway: string;
  subnetMask: string;
  dnsServers: string;
  macAddress: string;
  username: string;
  uptime: string;
  lastError: string;
  binding: string;
}

// ----------------------------------------------------------------
// Internal helper: HTTP request ke GenieACS NBI
// ----------------------------------------------------------------
async function genieRequest(
  config: GenieACSConfig,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: object,
  timeoutMs: number = 30000
): Promise<{ success: boolean; data?: any; httpCode?: number; error?: string }> {
  const baseUrl = `http://${config.host}:${config.port}`;
  const url = baseUrl + endpoint;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.username && config.password) {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { success: res.ok, data, httpCode: res.status };
  } catch (err: any) {
    clearTimeout(timer);
    return { success: false, error: err.message || String(err) };
  }
}

// ----------------------------------------------------------------
// Test Connection
// ----------------------------------------------------------------
export async function testConnection(config: GenieACSConfig): Promise<boolean> {
  const res = await genieRequest(config, '/devices/?limit=1', 'GET', undefined, 10000);
  return res.success;
}

// ----------------------------------------------------------------
// Summon / Connection Request
// ----------------------------------------------------------------
export async function summonDevice(
  config: GenieACSConfig,
  deviceId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  // To trigger a connection request in GenieACS, we send a POST to /tasks
  const body = {
    name: 'refreshObject',
    objectName: '',
    device: deviceId
  };

  const res = await genieRequest(config, `/tasks/${encodeURIComponent(deviceId)}`, 'POST', body, 15000);
  
  // Since we also want to ping or refresh the connection, a standard connection request task
  if (!res.success) {
    // fallback or alternative way if needed
    const connReqBody = { name: 'connectionRequest', device: deviceId };
    return await genieRequest(config, `/tasks/${encodeURIComponent(deviceId)}`, 'POST', connReqBody, 15000);
  }
  
  return res;
}

// ----------------------------------------------------------------
// Set WiFi Configuration (TR-069)
// ----------------------------------------------------------------
export async function setWifiConfig(
  config: GenieACSConfig,
  deviceId: string,
  ssid?: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  
  // TR-069 standard paths for WiFi (can vary by vendor, usually InternetGatewayDevice.LANDevice.1.WLANConfiguration.1)
  // For safety, we will attempt setting the most common path.
  const wlanPath = 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1';
  
  const parameterValues: [string, string, string][] = [];
  
  if (ssid) {
    parameterValues.push([`${wlanPath}.SSID`, ssid, 'xsd:string']);
  }
  
  if (password) {
    parameterValues.push([`${wlanPath}.KeyPassphrase`, password, 'xsd:string']);
  }

  if (parameterValues.length === 0) return { success: true };

  const body = {
    name: 'setParameterValues',
    parameterValues: parameterValues,
    device: deviceId
  };

  const res = await genieRequest(config, `/tasks/${encodeURIComponent(deviceId)}`, 'POST', body, 20000);
  
  if (!res.success) return { success: false, error: res.error };
  return { success: true };
}

// ----------------------------------------------------------------
// Get Devices (paginated)
// ----------------------------------------------------------------
export async function getDevices(
  config: GenieACSConfig,
  query: Record<string, any> = {},
  limit = 0,
  skip = 0
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const params: string[] = [];

  if (Object.keys(query).length > 0) {
    params.push('query=' + encodeURIComponent(JSON.stringify(query)));
  }
  if (limit > 0) params.push(`limit=${limit}`);
  if (skip > 0) params.push(`skip=${skip}`);

  const qs = params.length > 0 ? '?' + params.join('&') : '';
  const res = await genieRequest(config, `/devices/${qs}`, 'GET', undefined, 300000);

  if (!res.success) return { success: false, error: res.error };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

// ----------------------------------------------------------------
// Get Single Device by ID
// ----------------------------------------------------------------
export async function getDevice(
  config: GenieACSConfig,
  deviceId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const query = { _id: deviceId };
  const res = await genieRequest(
    config,
    '/devices/?query=' + encodeURIComponent(JSON.stringify(query)),
    'GET'
  );

  if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
    return { success: false, error: 'Device not found' };
  }
  return { success: true, data: res.data[0] };
}



// ----------------------------------------------------------------
// Refresh Inform
// ----------------------------------------------------------------
export async function refreshInform(
  config: GenieACSConfig,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  return summonDevice(config, deviceId);
}

// ----------------------------------------------------------------
// Reboot Device
// ----------------------------------------------------------------
export async function rebootDevice(
  config: GenieACSConfig,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  const encodedId = encodeURIComponent(deviceId);
  const res = await genieRequest(config, `/devices/${encodedId}/tasks`, 'POST', { name: 'reboot' });
  return { success: res.success, error: res.error };
}

// ----------------------------------------------------------------
// Add Refresh Task (refreshObject)
// ----------------------------------------------------------------
export async function addRefreshTask(
  config: GenieACSConfig,
  deviceId: string,
  objectPath: string
): Promise<{ success: boolean; error?: string }> {
  const encodedId = encodeURIComponent(deviceId);
  const res = await genieRequest(
    config,
    `/devices/${encodedId}/tasks?timeout=3000&connection_request`,
    'POST',
    { name: 'refreshObject', objectName: objectPath }
  );
  return { success: res.success, error: res.error };
}

// ----------------------------------------------------------------
// Get Parameter Values
// ----------------------------------------------------------------
export async function getParameterValues(
  config: GenieACSConfig,
  deviceId: string,
  parameterNames: string[],
  timeout = 3000
): Promise<{ success: boolean; error?: string }> {
  const encodedId = encodeURIComponent(deviceId);
  const res = await genieRequest(
    config,
    `/devices/${encodedId}/tasks?timeout=${timeout}&connection_request`,
    'POST',
    { name: 'getParameterValues', parameterNames }
  );
  return { success: res.success, error: res.error };
}

// ----------------------------------------------------------------
// Set Parameter Values
// ----------------------------------------------------------------
export async function setParameterValues(
  config: GenieACSConfig,
  deviceId: string,
  parameters: [string, string | boolean | number, string][],
  timeout = 3000
): Promise<{ success: boolean; error?: string }> {
  const encodedId = encodeURIComponent(deviceId);
  const res = await genieRequest(
    config,
    `/devices/${encodedId}/tasks?timeout=${timeout}&connection_request`,
    'POST',
    { name: 'setParameterValues', parameterValues: parameters }
  );
  return { success: res.success, error: res.error };
}

// ----------------------------------------------------------------
// Set WiFi Config (SSID + Password)
// ----------------------------------------------------------------
export async function setWiFiConfig(
  config: GenieACSConfig,
  deviceId: string,
  ssid: string,
  password: string,
  wlanIndex = 1,
  securityMode = 'WPA2PSK'
): Promise<{ success: boolean; error?: string }> {
  const beaconTypeMap: Record<string, string> = {
    WPA2PSK: '11i',
    WPAPSK: 'WPA',
    WPA2PSKWPAPSK: 'WPAand11i',
    None: 'Basic',
  };
  const beaconType = beaconTypeMap[securityMode] ?? '11i';

  const parameters: [string, string, string][] = [
    [
      `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.SSID`,
      ssid,
      'xsd:string',
    ],
    [
      `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.BeaconType`,
      beaconType,
      'xsd:string',
    ],
  ];

  if (securityMode !== 'None' && password) {
    parameters.push([
      `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.KeyPassphrase`,
      password,
      'xsd:string',
    ]);
    parameters.push([
      `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.WPAAuthenticationMode`,
      'PSKAuthentication',
      'xsd:string',
    ]);
  }

  return setParameterValues(config, deviceId, parameters);
}

// ----------------------------------------------------------------
// Parse raw TR-069 device data to clean GenieACSDevice object
// ----------------------------------------------------------------
export function parseDeviceData(device: Record<string, any>): GenieACSDevice {
  const getParam = (path: string): any => {
    const keys = path.split('.');
    let val: any = device;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return null;
      }
    }
    if (val && typeof val === 'object' && '_value' in val) return val._value;
    return typeof val === 'object' ? null : val;
  };

  // Basic info
  const serialNumber =
    getParam('_deviceId._SerialNumber') ??
    getParam('InternetGatewayDevice.DeviceInfo.SerialNumber') ??
    'N/A';

  // MAC address (try multiple paths)
  let macAddress =
    getParam('InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress') ??
    getParam('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.MACAddress') ??
    getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BSSID') ??
    getParam('Device.Ethernet.Interface.1.MACAddress') ??
    getParam('_deviceId._MACAddress');

  if (!macAddress) {
    const oui = getParam('_deviceId._OUI');
    const serial = getParam('_deviceId._SerialNumber');
    if (oui && serial && serial.length >= 6) {
      const last6 = serial.slice(-6);
      if (/^[0-9A-Fa-f]{6}$/.test(last6)) {
        const ouiFmt = `${oui.slice(0,2)}:${oui.slice(2,4)}:${oui.slice(4,6)}`.toUpperCase();
        macAddress = `${ouiFmt}:${last6.slice(0,2).toUpperCase()}:${last6.slice(2,4).toUpperCase()}:${last6.slice(4,6).toUpperCase()}`;
      }
    }
  }

  // Status
  const lastInformRaw: string | null = device._lastInform ?? null;
  let lastInformTs: number | null = null;
  let lastInform: string | null = null;
  let status: 'online' | 'offline' = 'offline';

  if (lastInformRaw) {
    lastInformTs = new Date(lastInformRaw).getTime() / 1000;
    lastInform = new Date(lastInformRaw).toLocaleString('id-ID');
    status = Date.now() / 1000 - lastInformTs < 300 ? 'online' : 'offline';
  }

  // Ping estimate
  let ping: number | null = null;
  const pingParam = getParam('VirtualParameters.Ping') ?? getParam('VirtualParameters.ping');
  if (status === 'online') {
    if (pingParam !== null && !isNaN(Number(pingParam))) {
      ping = Math.round(Number(pingParam));
    } else if (lastInformTs !== null) {
      const age = Date.now() / 1000 - lastInformTs;
      if (age < 30) ping = Math.floor(Math.random() * 4) + 1;
      else if (age < 60) ping = Math.floor(Math.random() * 10) + 5;
      else if (age < 120) ping = Math.floor(Math.random() * 35) + 15;
      else ping = Math.floor(Math.random() * 150) + 50;
    }
  }

  // IP address
  const connectionUrl =
    getParam('InternetGatewayDevice.ManagementServer.ConnectionRequestURL') ??
    getParam('Device.ManagementServer.ConnectionRequestURL') ??
    '';

  let ipAddress = 'N/A';
  const urlMatch = connectionUrl.match(/https?:\/\/([^:/]+)/);
  if (urlMatch) {
    ipAddress = urlMatch[1];
  } else {
    ipAddress =
      getParam('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress') ??
      getParam('Device.IP.Interface.1.IPv4Address.1.IPAddress') ??
      'N/A';
  }

  // WiFi
  const wifiSsid =
    getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') ??
    getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID') ??
    getParam('Device.WiFi.SSID.1.SSID') ??
    'N/A';

  const wifiPassword =
    getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase') ??
    getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase') ??
    getParam('Device.WiFi.AccessPoint.1.Security.KeyPassphrase') ??
    'N/A';

  // Optical power
  let rxPowerRaw =
    getParam('VirtualParameters.RXPower') ??
    getParam('InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower') ??
    getParam('Device.Optical.Interface.1.RxPower');

  let rxPower: string | number | null = null;
  if (rxPowerRaw !== null && !isNaN(Number(rxPowerRaw))) {
    let v = parseFloat(rxPowerRaw);
    if (v > 100) v = v / 100 - 40;
    rxPower = parseFloat(v.toFixed(2));
  }

  // Temperature
  let tempRaw =
    getParam('VirtualParameters.gettemp') ??
    getParam('InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.TransceiverTemperature') ??
    getParam('VirtualParameters.Temperature') ??
    getParam('InternetGatewayDevice.DeviceInfo.Temperature');

  let temperature: string | number | null = null;
  if (tempRaw !== null && !isNaN(Number(tempRaw))) {
    let v = parseFloat(tempRaw);
    if (v > 1000) v = v / 256;
    temperature = parseFloat(v.toFixed(1));
  }

  // WAN details (PPPoE + IP)
  const wanDetails: WanDetail[] = [];
  const buildBinding = (lanInterface: string | null): string => {
    if (!lanInterface) return 'N/A';
    const wlanMatch = lanInterface.match(/WLANConfiguration\.(\d+)/);
    if (wlanMatch) return `WLAN ${wlanMatch[1]}`;
    const lanMatch = lanInterface.match(/LANEthernetInterfaceConfig\.(\d+)/);
    if (lanMatch) return `LAN Ethernet ${lanMatch[1]}`;
    if (/LANHostConfigManagement/.test(lanInterface)) return 'All LAN Ports';
    return lanInterface;
  };

  for (let i = 1; i <= 8; i++) {
    for (const connType of ['WANPPPConnection', 'WANIPConnection'] as const) {
      const base = `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${i}.${connType}.1`;
      const name = getParam(`${base}.Name`);
      const externalIp = getParam(`${base}.ExternalIPAddress`);
      const serviceList = getParam(`${base}.X_CT-COM_ServiceList`);
      if (!name && !externalIp && !serviceList) continue;

      let connStatus = getParam(`${base}.ConnectionStatus`);
      if (!connStatus || connStatus === 'Unknown') {
        const enabled = getParam(`${base}.Enable`);
        connStatus = enabled !== null ? (enabled ? 'Connected' : 'Disconnected') : 'Unknown';
      }

      wanDetails.push({
        type: connType === 'WANPPPConnection' ? 'PPPoE' : 'IP',
        name: name ?? (serviceList ? `WAN_${serviceList}_${i}` : `WAN_${connType}_${i}`),
        status: connStatus,
        connectionType: getParam(`${base}.ConnectionType`) ?? 'N/A',
        externalIp: externalIp ?? 'N/A',
        gateway: getParam(`${base}.RemoteIPAddress`) ?? getParam(`${base}.DefaultGateway`) ?? 'N/A',
        subnetMask: getParam(`${base}.SubnetMask`) ?? 'N/A',
        dnsServers: getParam(`${base}.DNSServers`) ?? 'N/A',
        macAddress: getParam(`${base}.MACAddress`) ?? 'N/A',
        username: getParam(`${base}.Username`) ?? 'N/A',
        uptime: getParam(`${base}.Uptime`) ?? 'N/A',
        lastError: getParam(`${base}.LastConnectionError`) ?? 'N/A',
        binding: buildBinding(getParam(`${base}.X_CT-COM_LanInterface`)),
      });
    }
  }

  return {
    _id: device._id ?? '',
    serialNumber,
    oui: getParam('_deviceId._OUI') ?? getParam('InternetGatewayDevice.DeviceInfo.ManufacturerOUI') ?? 'N/A',
    manufacturer: getParam('_deviceId._Manufacturer') ?? getParam('InternetGatewayDevice.DeviceInfo.Manufacturer') ?? 'N/A',
    productClass: getParam('_deviceId._ProductClass') ?? getParam('InternetGatewayDevice.DeviceInfo.ProductClass') ?? 'N/A',
    hardwareVersion: getParam('InternetGatewayDevice.DeviceInfo.HardwareVersion') ?? 'N/A',
    softwareVersion: getParam('InternetGatewayDevice.DeviceInfo.SoftwareVersion') ?? 'N/A',
    macAddress: macAddress ?? 'N/A',
    ipAddress,
    ipTr069: connectionUrl || 'N/A',
    status,
    lastInform,
    lastInformTs,
    uptime: getParam('InternetGatewayDevice.DeviceInfo.UpTime') ?? getParam('Device.DeviceInfo.UpTime') ?? 'N/A',
    wifiSsid,
    wifiPassword,
    rxPower,
    temperature,
    ping,
    wanDetails,
    raw: device,
  };
}

// ----------------------------------------------------------------
// Get Device Stats (Total, Online, Offline)
// ----------------------------------------------------------------
export async function getDeviceStats(
  config: GenieACSConfig
): Promise<{ success: boolean; data?: { total: number; online: number; offline: number }; error?: string }> {
  // Try to fetch only _lastInform to save bandwidth
  const res = await genieRequest(config, '/devices?projection=_lastInform', 'GET', undefined, 120000);
  if (!res.success || !Array.isArray(res.data)) {
    return { success: false, error: res.error || 'Failed to fetch devices' };
  }

  const now = Date.now() / 1000;
  let online = 0;
  let offline = 0;

  for (const device of res.data) {
    if (device._lastInform) {
      const lastInformTs = new Date(device._lastInform).getTime() / 1000;
      if (now - lastInformTs < 300) {
        online++;
      } else {
        offline++;
      }
    } else {
      offline++;
    }
  }

  return {
    success: true,
    data: {
      total: res.data.length,
      online,
      offline
    }
  };
}

// ----------------------------------------------------------------
// Get Uplink Signal Stats (Excellent, Good, Fair, Poor, No Signal)
// ----------------------------------------------------------------
export async function getUplinkStats(
  config: GenieACSConfig
): Promise<{ success: boolean; data?: { excellent: number; good: number; fair: number; poor: number; no_signal: number }; error?: string }> {
  const projection = 'VirtualParameters.RXPower,InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower,Device.Optical.Interface.1.RxPower';
  const res = await genieRequest(config, `/devices?projection=${projection}`, 'GET', undefined, 120000);
  
  if (!res.success || !Array.isArray(res.data)) {
    return { success: false, error: res.error || 'Failed to fetch devices' };
  }

  let excellent = 0;
  let good = 0;
  let fair = 0;
  let poor = 0;
  let no_signal = 0;

  for (const device of res.data) {
    const getParam = (path: string): any => {
      const keys = path.split('.');
      let val: any = device;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          return null;
        }
      }
      if (val && typeof val === 'object' && '_value' in val) return val._value;
      return typeof val === 'object' ? null : val;
    };

    let rxPowerRaw =
      getParam('VirtualParameters.RXPower') ??
      getParam('InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower') ??
      getParam('Device.Optical.Interface.1.RxPower');

    let rxPower: number | null = null;
    if (rxPowerRaw !== null && !isNaN(Number(rxPowerRaw))) {
      let v = parseFloat(rxPowerRaw);
      if (v > 100) v = v / 100 - 40;
      rxPower = parseFloat(v.toFixed(2));
    }

    if (rxPower === null) {
      no_signal++;
    } else if (rxPower >= -20) {
      excellent++;
    } else if (rxPower >= -25) {
      good++;
    } else if (rxPower >= -27) {
      fair++;
    } else {
      poor++;
    }
  }

  return {
    success: true,
    data: { excellent, good, fair, poor, no_signal }
  };
}

// ----------------------------------------------------------------
// Get Recent Devices
// ----------------------------------------------------------------
export async function getRecentDevices(
  config: GenieACSConfig,
  limit = 10
): Promise<{ success: boolean; data?: GenieACSDevice[]; error?: string }> {
  // Sort by _lastInform descending
  const sort = encodeURIComponent(JSON.stringify({ _lastInform: -1 }));
  const res = await genieRequest(config, `/devices/?sort=${sort}&limit=${limit}`, 'GET', undefined, 60000);
  
  if (!res.success || !Array.isArray(res.data)) {
    return { success: false, error: res.error || 'Failed to fetch devices' };
  }

  return {
    success: true,
    data: res.data.map(parseDeviceData)
  };
}

// ----------------------------------------------------------------
// Export genieRequest for external use (bulk actions, webhooks)
// ----------------------------------------------------------------
export async function genieRawRequest(
  config: GenieACSConfig,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: object
): Promise<{ success: boolean; data?: any; httpCode?: number; error?: string }> {
  return genieRequest(config, endpoint, method, body);
}

// ----------------------------------------------------------------
// GAP #1: WAN Config Management
// ----------------------------------------------------------------
export async function setWanConfig(
  config: GenieACSConfig,
  deviceId: string,
  index: number,
  type: 'ppp' | 'ip',
  params: Record<string, any>,
  name?: string
): Promise<{ success: boolean; taskStatus?: string; error?: string }> {
  const connPath = type === 'ppp' ? 'WANPPPConnection' : 'WANIPConnection';
  const basePath = `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${index}.${connPath}.1`;

  const allowedParams: Record<string, string> = {
    Name: 'xsd:string',
    Enable: 'xsd:boolean',
    ConnectionType: 'xsd:string',
    Username: 'xsd:string',
    Password: 'xsd:string',
    NATEnabled: 'xsd:boolean',
    'X_CT-COM_ServiceList': 'xsd:string',
    'X_CT-COM_LanInterface': 'xsd:string',
    'X_CT-COM_VLANID': 'xsd:unsignedInt',
  };

  const paramTuples: [string, any, string][] = [];
  if (name) paramTuples.push([`${basePath}.Name`, name, 'xsd:string']);
  for (const [key, val] of Object.entries(params)) {
    if (allowedParams[key] !== undefined) {
      paramTuples.push([`${basePath}.${key}`, val, allowedParams[key]]);
    }
  }

  if (paramTuples.length === 0) return { success: false, error: 'No valid parameters provided' };

  const result = await setParameterValues(config, deviceId, paramTuples);
  return { ...result, taskStatus: result.success ? 'queued' : undefined };
}

export async function disableWanConnection(
  config: GenieACSConfig,
  deviceId: string,
  index: number,
  type: 'ppp' | 'ip',
  serviceList?: string,
  connectionName?: string,
  confirmTr069Delete?: boolean
): Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }> {
  // Guard: detect TR-069/CWMP connection
  const lsl = (serviceList || '').toLowerCase();
  const lcn = (connectionName || '').toLowerCase();
  const isTr069 = lsl.includes('tr069') || lsl.includes('cwmp') || lcn.includes('tr069') || lcn.includes('cwmp');
  if (isTr069 && !confirmTr069Delete) {
    return {
      success: false,
      requiresConfirmation: true,
      error: 'Koneksi ini sepertinya adalah koneksi management TR-069/CWMP. Menonaktifkannya dapat memutus komunikasi ACS dengan perangkat ini.'
    };
  }

  const connPath = type === 'ppp' ? 'WANPPPConnection' : 'WANIPConnection';
  const basePath = `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${index}.${connPath}.1`;
  const result = await setParameterValues(config, deviceId, [[`${basePath}.Enable`, false, 'xsd:boolean']]);
  return result;
}

// ----------------------------------------------------------------
// GAP #2: DHCP Config via ACS
// ----------------------------------------------------------------
export async function setDhcpConfig(
  config: GenieACSConfig,
  deviceId: string,
  params: {
    DHCPServerEnable?: boolean;
    DHCPServerConfigurable?: boolean;
    MinAddress?: string;
    MaxAddress?: string;
    SubnetMask?: string;
    IPRouters?: string;
    DNSServers?: string;
    DHCPLeaseTime?: number;
  }
): Promise<{ success: boolean; taskStatus?: string; error?: string }> {
  const basePath = 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement';

  const typeMap: Record<string, string> = {
    DHCPServerEnable: 'xsd:boolean',
    DHCPServerConfigurable: 'xsd:boolean',
    MinAddress: 'xsd:string',
    MaxAddress: 'xsd:string',
    SubnetMask: 'xsd:string',
    IPRouters: 'xsd:string',
    DNSServers: 'xsd:string',
    DHCPLeaseTime: 'xsd:unsignedInt',
  };

  const paramTuples: [string, any, string][] = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && typeMap[key]) {
      paramTuples.push([`${basePath}.${key}`, val, typeMap[key]]);
    }
  }

  if (paramTuples.length === 0) return { success: false, error: 'No valid parameters provided' };
  const result = await setParameterValues(config, deviceId, paramTuples);
  return { ...result, taskStatus: result.success ? 'queued' : undefined };
}
