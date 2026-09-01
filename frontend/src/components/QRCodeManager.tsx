import React, { useState, useEffect } from 'react';
import { QrCode, Camera, Search, Printer, CheckCircle, RefreshCw } from 'lucide-react';
import { BACKEND_URL } from '../App';
import type { Device } from '../types';

interface QRCodeManagerProps {
  devices: Device[];
}

export const QRCodeManager: React.FC<QRCodeManagerProps> = ({ devices }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(devices[0]?.id || 1);
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Scanner lookup state
  const [scanInputCode, setScanInputCode] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string>('');

  const fetchQRCode = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/qr/device/${id}`);
      if (res.ok) {
        setQrData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      fetchQRCode(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const handleScanLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInputCode.trim()) return;
    setScanError('');
    setScannedResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/qr/scan/${scanInputCode.trim()}`);
      if (res.ok) {
        setScannedResult(await res.json());
      } else {
        setScanError('Perangkat atau aset tidak ditemukan untuk kode QR tersebut.');
      }
    } catch (err) {
      setScanError('Gagal memindai kode QR.');
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QrCode style={{ color: '#6366f1' }} size={28} /> Mobile QR Asset Scanner & Tag Manager
        </h1>
        <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
          Generator QR Code Stiker Perangkat & Pemindai Aset Lapangan Teknisi
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Card 1: Generator Stiker QR Code */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} style={{ color: '#818cf8' }} /> Generator Stiker QR Perangkat
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Pilih Perangkat Jaringan</label>
            <select 
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '14px', marginTop: '6px' }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.type}] {d.name} ({d.ip_address}) - {d.location}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}><RefreshCw className="spin" size={24} /></div>
          ) : qrData && (
            <div style={{ background: '#fff', color: '#000', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '2px solid #6366f1' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#4f46e5' }}>
                PROPERTY OF UNTAG BANYUWANGI NMS
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, margin: '6px 0', color: '#000' }}>
                {qrData.asset_code}
              </div>
              
              {/* Render Simulated Visual QR Code */}
              <div style={{ margin: '16px auto', width: '160px', height: '160px', background: '#000', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
                <QrCode size={120} />
                <div style={{ fontSize: '9px', marginTop: '4px', fontFamily: 'monospace' }}>SCAN ME FOR NMS INFO</div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700 }}>{qrData.device?.name}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>IP: {qrData.device?.ip_address} | {qrData.device?.location}</div>

              <button 
                onClick={handlePrintQR}
                style={{ marginTop: '16px', width: '100%', padding: '8px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cetak Stiker QR Ini
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Field Scanner & Asset Lookup */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} style={{ color: '#34d399' }} /> Pindai Kode QR / Asset Lookup
          </h3>

          <form onSubmit={handleScanLookup} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Input/Scan Asset Code (e.g. NEM-DEV-0001)..."
              value={scanInputCode}
              onChange={(e) => setScanInputCode(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '14px' }}
            />
            <button type="submit" style={{ padding: '10px 16px', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              <Search size={16} /> Scan
            </button>
          </form>

          {scanError && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '8px', fontSize: '13px' }}>
              {scanError}
            </div>
          )}

          {scannedResult && (
            <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #34d399', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
                <CheckCircle size={18} /> Asset Terverifikasi [{scannedResult.asset_code}]
              </div>

              {scannedResult.type === 'device' ? (
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                  <div><b>Nama Perangkat:</b> {scannedResult.data.name}</div>
                  <div><b>Kategori/Tipe:</b> {scannedResult.data.type}</div>
                  <div><b>Alamat IP:</b> {scannedResult.data.ip_address}</div>
                  <div><b>Lokasi Rack:</b> {scannedResult.data.location}</div>
                  <div><b>Status Operasional:</b> <span style={{ color: scannedResult.data.status === 'Up' ? '#34d399' : '#f87171', fontWeight: 700 }}>{scannedResult.data.status}</span></div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                  <div><b>Nama Barang:</b> {scannedResult.data.item_name}</div>
                  <div><b>Kategori:</b> {scannedResult.data.category}</div>
                  <div><b>Lokasi:</b> {scannedResult.data.location}</div>
                  <div><b>Harga Satuan:</b> Rp {scannedResult.data.unit_price?.toLocaleString('id-ID')}</div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
