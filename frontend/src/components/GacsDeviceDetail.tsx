import React, { useState } from 'react';
import {
  ArrowLeft, Wifi, Zap, RotateCcw, RefreshCw, Edit3,
  Thermometer, Signal, Globe, Info, CheckCircle, XCircle,
  Terminal, Server, Users, Plus, Save
} from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { GenieACSDevice } from '../types';

interface GacsDeviceDetailProps {
  device: GenieACSDevice;
  token: string;
  onBack: () => void;
}

type TabType = 'overview' | 'connected' | 'wan' | 'dhcp';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 0', alignItems: 'flex-start', gap: '16px' }}>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: '180px', flexShrink: 0, fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)' }}>{value ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}</span>
  </div>
);

const badgeStyle = (ok: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
  borderRadius: '99px', fontSize: '12px', fontWeight: 700,
  background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
  color: ok ? '#22c55e' : '#ef4444',
  border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
});

export const GacsDeviceDetail: React.FC<GacsDeviceDetailProps> = ({ device: d, token, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [actionMsg, setActionMsg] = useState('');
  const [actionOk, setActionOk] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [mtLeases, setMtLeases] = useState<any[]>([]);
  const [loadingMt, setLoadingMt] = useState(false);

  const [wifiModal, setWifiModal] = useState(false);
  const [newSsid, setNewSsid] = useState(d.wifiSsid !== 'N/A' ? d.wifiSsid : '');
  const [newPass, setNewPass] = useState(d.wifiPassword !== 'N/A' ? d.wifiPassword : '');
  const [wifiIndex, setWifiIndex] = useState('1');
  const [wifiSecurity, setWifiSecurity] = useState('WPA2PSK');
  const [wifiMsg, setWifiMsg] = useState('');
  const [wifiMsgOk, setWifiMsgOk] = useState(true);
  const [wifiSending, setWifiSending] = useState(false);

  const [paramsModal, setParamsModal] = useState(false);
  const [paramInput, setParamInput] = useState('InternetGatewayDevice.DeviceInfo.SoftwareVersion');
  const [paramMsg, setParamMsg] = useState('');
  const [paramOk, setParamOk] = useState(true);
  const [paramSending, setParamSending] = useState(false);

  // Hotspot Traffic State
  const [hotspotUsers, setHotspotUsers] = useState<any[]>([]);
  const [loadingHotspot, setLoadingHotspot] = useState(false);

  // WAN Modal State
  const [wanModal, setWanModal] = useState(false);
  const [wanMode, setWanMode] = useState<'add' | 'edit'>('add');
  const [wanIndex, setWanIndex] = useState(1);
  const [wanType, setWanType] = useState<'ppp' | 'ip'>('ppp');
  const [wanName, setWanName] = useState('WAN_PPPoE_1');
  const [wanUsername, setWanUsername] = useState('');
  const [wanPassword, setWanPassword] = useState('');
  const [wanVlanId, setWanVlanId] = useState('');
  const [wanServiceList, setWanServiceList] = useState('INTERNET');
  const [wanMsg, setWanMsg] = useState('');
  const [wanMsgOk, setWanMsgOk] = useState(true);
  const [wanSending, setWanSending] = useState(false);

  // DHCP Form State
  const [dhcpEnable, setDhcpEnable] = useState(true);
  const [dhcpMin, setDhcpMin] = useState('192.168.1.2');
  const [dhcpMax, setDhcpMax] = useState('192.168.1.254');
  const [dhcpSubnet, setDhcpSubnet] = useState('255.255.255.0');
  const [dhcpLease, setDhcpLease] = useState('86400');
  const [dhcpMsg, setDhcpMsg] = useState('');
  const [dhcpMsgOk, setDhcpMsgOk] = useState(true);
  const [dhcpSending, setDhcpSending] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const deviceId = encodeURIComponent(d._id);

  const handleFetchHotspot = async () => {
    setLoadingHotspot(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mikrotik/hotspot`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setHotspotUsers(data.users);
      }
    } catch {}
    setLoadingHotspot(false);
  };

  const handleSaveWan = async () => {
    setWanSending(true);
    setWanMsg('');
    try {
      const endpoint = `${BACKEND_URL}/api/gacs/devices/${deviceId}/wan`;
      const method = wanMode === 'add' ? 'POST' : 'PUT';
      const body: any = {
        index: wanIndex,
        type: wanType,
        name: wanName,
        params: {
          'X_CT-COM_ServiceList': wanServiceList,
        }
      };

      if (wanType === 'ppp') {
        body.params.Username = wanUsername;
        body.params.Password = wanPassword;
      }
      if (wanVlanId) {
        body.params['X_CT-COM_VLANID'] = parseInt(wanVlanId);
      }

      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      setWanMsg(data.message || (data.success ? 'Berhasil dikirim ke ACS' : 'Gagal'));
      setWanMsgOk(data.success);
      if (data.success) {
        setTimeout(() => setWanModal(false), 1500);
      }
    } catch (e: any) {
      setWanMsg(e.message || 'Error koneksi');
      setWanMsgOk(false);
    }
    setWanSending(false);
  };

  const handleDeleteWan = async (wan: any, index: number) => {
    const isTr069 = (wan.name || '').toLowerCase().includes('tr069') || (wan.binding || '').toLowerCase().includes('cwmp');
    let confirmTr069 = false;
    if (isTr069) {
      const ok = window.confirm('⚠️ PERINGATAN: Koneksi ini terdeteksi sebagai koneksi TR-069 ACS. Menonaktifkan koneksi ini dapat membuat modem terputus selamanya dari ACS.\n\nApakah Anda yakin ingin melanjutkan?');
      if (!ok) return;
      confirmTr069 = true;
    } else {
      if (!window.confirm(`Yakin ingin menonaktifkan koneksi WAN [${wan.name}]?`)) return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${deviceId}/wan`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          index: index + 1,
          type: wan.type === 'PPPoE' ? 'ppp' : 'ip',
          service_list: wan.name,
          connection_name: wan.name,
          confirm_tr069_delete: confirmTr069
        })
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Koneksi WAN dinonaktifkan' : 'Gagal'));
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSaveDhcp = async () => {
    setDhcpSending(true);
    setDhcpMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${deviceId}/dhcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: {
            DHCPServerEnable: dhcpEnable,
            MinAddress: dhcpMin,
            MaxAddress: dhcpMax,
            SubnetMask: dhcpSubnet,
            DHCPLeaseTime: parseInt(dhcpLease)
          }
        })
      });
      const data = await res.json();
      setDhcpMsg(data.message || (data.success ? 'Konfigurasi DHCP berhasil dikirim ke ACS' : 'Gagal'));
      setDhcpMsgOk(data.success);
    } catch (e: any) {
      setDhcpMsg(e.message || 'Error koneksi');
      setDhcpMsgOk(false);
    }
    setDhcpSending(false);
  };


  const doAction = async (action: 'summon' | 'reboot' | 'refresh') => {
    setIsActing(true);
    setActionMsg(action === 'summon' ? 'Mengirim summon...' : action === 'reboot' ? 'Mengirim reboot...' : 'Mengirim refresh...');
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${deviceId}/${action}`, { method: 'POST', headers });
      const data = await res.json();
      setActionMsg(data.message || (data.success ? 'Berhasil' : 'Gagal'));
      setActionOk(data.success);
    } catch { setActionMsg('Error koneksi'); setActionOk(false); }
    setIsActing(false);
    setTimeout(() => setActionMsg(''), 4000);
  };

  const handleFetchMtLeases = async () => {
    setLoadingMt(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mikrotik/leases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMtLeases(data.data);
      } else {
        alert('Gagal mengambil data dari Mikrotik: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error fetching Mikrotik leases: ' + e.message);
    }
    setLoadingMt(false);
  };

  const doWifi = async () => {
    if (!newSsid.trim()) { setWifiMsg('SSID tidak boleh kosong'); setWifiMsgOk(false); return; }
    setWifiSending(true); setWifiMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${deviceId}/wifi`, {
        method: 'POST', headers,
        body: JSON.stringify({ ssid: newSsid, password: newPass, wlanIndex: parseInt(wifiIndex), securityMode: wifiSecurity })
      });
      const data = await res.json();
      setWifiMsg(data.message || (data.success ? 'Perintah WiFi dikirim ke ACS' : 'Gagal'));
      setWifiMsgOk(data.success);
    } catch { setWifiMsg('Error koneksi'); setWifiMsgOk(false); }
    setWifiSending(false);
  };

  const doGetParams = async () => {
    const names = paramInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) { setParamMsg('Masukkan minimal satu parameter'); setParamOk(false); return; }
    setParamSending(true); setParamMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/gacs/devices/${deviceId}/get-params`, {
        method: 'POST', headers, body: JSON.stringify({ parameterNames: names })
      });
      const data = await res.json();
      setParamMsg(data.message || (data.success ? 'Task dikirim. Cek device setelah beberapa saat.' : 'Gagal'));
      setParamOk(data.success);
    } catch { setParamMsg('Error koneksi'); setParamOk(false); }
    setParamSending(false);
  };

  const rxNum = d.rxPower !== null ? Number(d.rxPower) : null;
  const rxColor = rxNum !== null ? (rxNum < -27 ? '#ef4444' : rxNum < -24 ? '#f59e0b' : '#22c55e') : 'var(--text-secondary)';

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px',
    padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', width: '100%', outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
            borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer'
          }}>
            <ArrowLeft size={16} /> Kembali
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{d.serialNumber}</h2>
              <span style={badgeStyle(d.status === 'online')}>
                {d.status === 'online' ? <><CheckCircle size={12} /> Online</> : <><XCircle size={12} /> Offline</>}
              </span>
              {d.ping !== null && d.status === 'online' && (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <Signal size={14} /> {d.ping}ms
                </span>
              )}
            </div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {d.manufacturer} · {d.productClass} · {d.ipAddress} · OUI: {d.oui}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => doAction('summon')} disabled={isActing} className="btn-primary" style={{ padding: '10px 16px', fontSize: '13px' }}>
              <Zap size={14} /> Summon
            </button>
            <button onClick={() => doAction('reboot')} disabled={isActing} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}><RotateCcw size={14} /> Reboot</button>
            <button onClick={() => doAction('refresh')} disabled={isActing} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)',
              borderRadius: '8px', color: '#818cf8', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}><RefreshCw size={14} /> Refresh</button>
            <button onClick={() => setParamsModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
              borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}><Terminal size={14} /> Get Params</button>
          </div>
        </div>

        {actionMsg && (
          <div style={{
            marginTop: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600,
            background: actionOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: actionOk ? '#22c55e' : '#ef4444',
            border: `1px solid ${actionOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {actionMsg}
          </div>
        )}
      </div>

      <div className="glass-card">
        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 10px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: <Info size={16} /> },
            { id: 'wan', label: 'WAN Management', icon: <Globe size={16} /> },
            { id: 'connected', label: 'Connected Devices', icon: <Users size={16} /> },
            { id: 'dhcp', label: 'DHCP Server', icon: <Server size={16} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as TabType)} style={{
              padding: '16px 20px', background: 'transparent', cursor: 'pointer',
              border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === t.id ? 700 : 600, fontSize: '13.5px',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={18} /> Info Perangkat</h3>
                <Row label="Device ID" value={<span style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{d._id}</span>} />
                <Row label="Serial Number" value={d.serialNumber} />
                <Row label="MAC Address" value={<span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.macAddress}</span>} />
                <Row label="IP Address" value={<span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.ipAddress}</span>} />
                <Row label="Hardware Version" value={d.hardwareVersion} />
                <Row label="Software Version" value={d.softwareVersion} />
                <Row label="TR-069 URL" value={<span style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{d.ipTr069}</span>} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', color: '#22c55e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Signal size={18} /> Status & Sinyal</h3>
                  <Row label="Status" value={<span style={badgeStyle(d.status === 'online')}>{d.status === 'online' ? 'Online' : 'Offline'}</span>} />
                  <Row label="Last Inform" value={d.lastInform ?? '—'} />
                  <Row label="Uptime" value={d.uptime} />
                  <Row label="Ping" value={d.ping !== null ? `${d.ping}ms` : '—'} />
                  <Row label="RxPower (Optical)" value={d.rxPower !== null ? <span style={{ fontWeight: 800, color: rxColor, fontSize: '15px' }}>{d.rxPower} dBm</span> : '—'} />
                  <Row label="Suhu Transceiver" value={d.temperature !== null ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 700 }}><Thermometer size={14} />{d.temperature}°C</span> : '—'} />
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}><Wifi size={18} /> WLAN 1 (2.4GHz)</h3>
                    <button onClick={() => setWifiModal(true)} style={{
                      padding: '6px 12px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}><Edit3 size={12} /> Edit WiFi</button>
                  </div>
                  <Row label="SSID" value={d.wifiSsid} />
                  <Row label="Password" value={d.wifiPassword !== 'N/A' ? <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{d.wifiPassword}</span> : '—'} />
                </div>
              </div>
            </div>
          )}

          {/* WAN MANAGEMENT TAB */}
          {activeTab === 'wan' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>WAN Connections</h3>
                <button style={{
                  padding: '8px 16px', background: 'var(--accent-primary)', border: 'none',
                  borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }} onClick={() => {
                  setWanMode('add');
                  setWanName('WAN_PPPoE_1');
                  setWanUsername('');
                  setWanPassword('');
                  setWanVlanId('');
                  setWanServiceList('INTERNET');
                  setWanMsg('');
                  setWanModal(true);
                }}><Plus size={14} /> Add WAN Connection</button>
              </div>

              {d.wanDetails.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                  Tidak ada konfigurasi WAN yang terdeteksi di perangkat ini.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {d.wanDetails.map((wan, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={16} /> [{wan.type}] {wan.name}
                      </div>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: wan.status === 'Connected' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: wan.status === 'Connected' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {wan.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <Row label="Connection Type" value={wan.connectionType} />
                      <Row label="External IP" value={<span style={{ fontFamily: 'monospace' }}>{wan.externalIp}</span>} />
                      <Row label="Gateway" value={<span style={{ fontFamily: 'monospace' }}>{wan.gateway}</span>} />
                      <Row label="DNS" value={wan.dnsServers} />
                      <Row label="VLAN / Binding" value={wan.binding} />
                      {wan.type === 'PPPoE' && (
                        <Row label="PPPoE Username" value={<span style={{ fontWeight: 600 }}>{wan.username}</span>} />
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }} onClick={() => {
                        setWanMode('edit');
                        setWanIndex(i + 1);
                        setWanType(wan.type === 'PPPoE' ? 'ppp' : 'ip');
                        setWanName(wan.name);
                        setWanUsername(wan.username !== 'N/A' ? wan.username : '');
                        setWanPassword('');
                        setWanServiceList(wan.name);
                        setWanMsg('');
                        setWanModal(true);
                      }}>Edit</button>
                      <button style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleDeleteWan(wan, i)}>Disable / Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONNECTED DEVICES TAB */}
          {activeTab === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Connected Hosts</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Daftar perangkat yang tersambung ke router ini.</p>
                </div>
                <button className="btn-primary" onClick={() => doGetParams()} style={{ fontSize: '13px' }}>
                  <RefreshCw size={14} /> Refresh Hosts via ACS
                </button>
              </div>

              {/* Mikrotik DHCP Leases */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px' }}>Mikrotik DHCP Leases</h4>
                  <button 
                    onClick={handleFetchMtLeases} 
                    disabled={loadingMt}
                    style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    {loadingMt ? 'Loading...' : 'Fetch Leases'}
                  </button>
                </div>

                {mtLeases.length > 0 ? (
                  <table className="custom-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Address</th>
                        <th>MAC Address</th>
                        <th>Server</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mtLeases.map((l: any, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{l.address}</td>
                          <td style={{ fontFamily: 'monospace' }}>{l['mac-address']}</td>
                          <td>{l.server}</td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: l.status === 'bound' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', color: l.status === 'bound' ? '#22c55e' : '#aaa' }}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px', fontSize: '13px' }}>
                    Klik <strong>Fetch Leases</strong> untuk melihat lease dari Mikrotik.
                  </div>
                )}
              </div>

              {/* GAP #7: Hotspot Active Users */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px' }}>Hotspot Active Users (MikroTik)</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>Pengguna hotspot aktif dengan pemakaian bandwidth real-time.</p>
                  </div>
                  <button 
                    onClick={handleFetchHotspot} 
                    disabled={loadingHotspot}
                    style={{ padding: '8px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    {loadingHotspot ? 'Loading...' : 'Fetch Hotspot Users'}
                  </button>
                </div>

                {hotspotUsers.length > 0 ? (
                  <table className="custom-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>IP Address</th>
                        <th>MAC Address</th>
                        <th>Uptime</th>
                        <th>Bytes In ↓</th>
                        <th>Bytes Out ↑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspotUsers.map((u: any, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{u.user || u.username}</td>
                          <td style={{ fontFamily: 'monospace' }}>{u.address || u.ip}</td>
                          <td style={{ fontFamily: 'monospace' }}>{u['mac-address'] || u.mac}</td>
                          <td>{u.uptime}</td>
                          <td style={{ color: '#22c55e', fontWeight: 600 }}>{(Number(u['bytes-in'] || 0) / 1024 / 1024).toFixed(2)} MB</td>
                          <td style={{ color: '#38bdf8', fontWeight: 600 }}>{(Number(u['bytes-out'] || 0) / 1024 / 1024).toFixed(2)} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px', fontSize: '13px' }}>
                    Klik <strong>Fetch Hotspot Users</strong> untuk mengambil daftar user hotspot aktif.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DHCP SERVER TAB */}
          {activeTab === 'dhcp' && (
            <div>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: 'var(--text-primary)' }}>DHCP Server Configuration</h3>
              <div style={{ maxWidth: '600px', background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Status DHCP Server</label>
                    <select style={inputStyle} value={dhcpEnable ? 'enabled' : 'disabled'} onChange={e => setDhcpEnable(e.target.value === 'enabled')}>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Min IP Address</label>
                      <input style={inputStyle} value={dhcpMin} onChange={e => setDhcpMin(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Max IP Address</label>
                      <input style={inputStyle} value={dhcpMax} onChange={e => setDhcpMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Subnet Mask</label>
                    <input style={inputStyle} value={dhcpSubnet} onChange={e => setDhcpSubnet(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Lease Time (seconds)</label>
                    <input style={inputStyle} type="number" value={dhcpLease} onChange={e => setDhcpLease(e.target.value)} />
                  </div>

                  {dhcpMsg && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      background: dhcpMsgOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: dhcpMsgOk ? '#22c55e' : '#ef4444',
                      border: `1px solid ${dhcpMsgOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}>
                      {dhcpMsg}
                    </div>
                  )}

                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" onClick={handleSaveDhcp} disabled={dhcpSending} style={{ fontSize: '13px' }}>
                      <Save size={14} /> {dhcpSending ? 'Mengirim ke ACS...' : 'Simpan Konfigurasi'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>


      {/* WiFi Edit Modal */}
      {wifiModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Wifi size={18} style={{ color: '#f59e0b' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Edit Konfigurasi WiFi</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>SSID Baru</label>
                <input style={inputStyle} value={newSsid} onChange={e => setNewSsid(e.target.value)} placeholder="SSID" />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Password Baru</label>
                <input style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password (min 8 karakter)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>WLAN Index</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={wifiIndex} onChange={e => setWifiIndex(e.target.value)}>
                    {['1', '2', '3', '4'].map(n => <option key={n} value={n}>WLAN {n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Security</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={wifiSecurity} onChange={e => setWifiSecurity(e.target.value)}>
                    <option value="WPA2PSK">WPA2-PSK</option>
                    <option value="WPAPSK">WPA-PSK</option>
                    <option value="WPA2PSKWPAPSK">WPA+WPA2</option>
                    <option value="None">Open (None)</option>
                  </select>
                </div>
              </div>
              {wifiMsg && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  background: wifiMsgOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: wifiMsgOk ? '#22c55e' : '#ef4444',
                  border: `1px solid ${wifiMsgOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  {wifiMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => { setWifiModal(false); setWifiMsg(''); }} style={{
                  padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}>Batal</button>
                <button onClick={doWifi} disabled={wifiSending} style={{
                  padding: '10px 18px', background: '#f59e0b', border: 'none',
                  borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}>{wifiSending ? 'Mengirim...' : 'Kirim Konfigurasi'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Get Params Modal */}
      {paramsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '520px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Terminal size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Get Parameter Values</h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Masukkan path parameter TR-069 (satu per baris). Task akan dikirim ke ACS.
            </p>
            <textarea
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12.5px' }}
              value={paramInput}
              onChange={e => setParamInput(e.target.value)}
              placeholder={'InternetGatewayDevice.DeviceInfo.SoftwareVersion\nInternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'}
            />
            {paramMsg && (
              <div style={{
                marginTop: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: paramOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: paramOk ? '#22c55e' : '#ef4444',
                border: `1px solid ${paramOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>
                {paramMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => { setParamsModal(false); setParamMsg(''); }} style={{
                padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}>Tutup</button>
              <button onClick={doGetParams} disabled={paramSending} style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
              }}>{paramSending ? 'Mengirim...' : 'Kirim Task'}</button>
            </div>
          </div>
        </div>
      )}

      {/* WAN Config Modal */}
      {wanModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '500px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Globe size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {wanMode === 'add' ? 'Tambah Koneksi WAN Baru' : `Edit WAN Connection [${wanName}]`}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Connection Index (1-8)</label>
                  <select style={inputStyle} value={wanIndex} onChange={e => setWanIndex(parseInt(e.target.value))} disabled={wanMode === 'edit'}>
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Index {n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tipe Koneksi</label>
                  <select style={inputStyle} value={wanType} onChange={e => setWanType(e.target.value as any)}>
                    <option value="ppp">PPPoE (PPP)</option>
                    <option value="ip">IP / Static / DHCP</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nama Koneksi</label>
                <input style={inputStyle} value={wanName} onChange={e => setWanName(e.target.value)} placeholder="Contoh: WAN_PPPoE_1" />
              </div>

              {wanType === 'ppp' && (
                <>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PPPoE Username</label>
                    <input style={inputStyle} value={wanUsername} onChange={e => setWanUsername(e.target.value)} placeholder="user@isp" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PPPoE Password</label>
                    <input style={inputStyle} type="password" value={wanPassword} onChange={e => setWanPassword(e.target.value)} placeholder="Password PPPoE" />
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>VLAN ID (Opsional)</label>
                  <input style={inputStyle} type="number" value={wanVlanId} onChange={e => setWanVlanId(e.target.value)} placeholder="Contoh: 100" />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Service List</label>
                  <input style={inputStyle} value={wanServiceList} onChange={e => setWanServiceList(e.target.value)} placeholder="INTERNET / VOIP / TR069" />
                </div>
              </div>

              {wanMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
                  background: wanMsgOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: wanMsgOk ? '#22c55e' : '#ef4444',
                  border: `1px solid ${wanMsgOk ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  {wanMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={() => { setWanModal(false); setWanMsg(''); }} style={{
                  padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}>Batal</button>
                <button onClick={handleSaveWan} disabled={wanSending} style={{
                  padding: '10px 18px', background: 'var(--accent-primary)', border: 'none',
                  borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}>{wanSending ? 'Mengirim...' : 'Simpan Koneksi WAN'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
