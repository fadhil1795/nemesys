import React, { useState, useEffect } from 'react';
import { QrCode, Camera, Search, Printer, CheckCircle, RefreshCw, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { BACKEND_URL } from '../App';
import type { Device } from '../types';

interface QRCodeManagerProps {
  devices: Device[];
}

export const QRCodeManager: React.FC<QRCodeManagerProps> = ({ devices }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(devices[0]?.id || 1);
  const [qrData, setQrData] = useState<any>(null);
  const [qrImageSrc, setQrImageSrc] = useState<string>('');
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
        const data = await res.json();
        setQrData(data);
        if (data.asset_code) {
          const qrUrl = await QRCode.toDataURL(data.asset_code, {
            width: 220,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
          });
          setQrImageSrc(qrUrl);
        }
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

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    setScannedResult(null);

    try {
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = await createImageBitmap(file);
        const codes = await detector.detect(img);
        if (codes && codes.length > 0) {
          const rawValue = codes[0].rawValue;
          setScanInputCode(rawValue);
          const res = await fetch(`${BACKEND_URL}/api/qr/scan/${encodeURIComponent(rawValue.trim())}`);
          if (res.ok) {
            setScannedResult(await res.json());
            return;
          }
        }
      }
      // Extract from filename fallback if named with asset code
      const nameMatch = file.name.match(/NEM-[A-Z]+-\d+/i);
      if (nameMatch) {
        setScanInputCode(nameMatch[0]);
        const res = await fetch(`${BACKEND_URL}/api/qr/scan/${encodeURIComponent(nameMatch[0])}`);
        if (res.ok) {
          setScannedResult(await res.json());
          return;
        }
      }
      setScanError('QR Code terdeteksi, namun data aset belum ditemukan atau browser tidak mendukung auto-decode. Silakan ketik kode aset secara manual.');
    } catch (err: any) {
      setScanError(`Gagal memproses gambar: ${err.message || err}`);
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  const handleDownloadQR = () => {
    if (!qrImageSrc) return;
    const a = document.createElement('a');
    a.href = qrImageSrc;
    a.download = `QR_${qrData?.asset_code || 'Asset'}.png`;
    a.click();
  };

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QrCode style={{ color: '#6366f1' }} size={28} /> Mobile QR Asset Scanner &amp; Tag Manager
        </h1>
        <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
          Generator QR Code Asli (Dapat Dipindai Smartphone / Scanner) &amp; Pemindai Aset Lapangan
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
            <div id="printable-qr-sticker" style={{ background: '#fff', color: '#000', padding: '22px', borderRadius: '12px', textAlign: 'center', border: '2px solid #6366f1', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#4f46e5' }}>
                PROPERTY OF UNTAG BANYUWANGI NMS
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, margin: '6px 0', color: '#000', letterSpacing: '0.5px' }}>
                {qrData.asset_code}
              </div>
              
              {/* Render Real Scannable 2D QR Code Matrix */}
              <div style={{ margin: '14px auto', width: '170px', height: '170px', background: '#fff', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                {qrImageSrc ? (
                  <img 
                    src={qrImageSrc} 
                    alt={`QR Code ${qrData.asset_code}`}
                    style={{ width: '155px', height: '155px', display: 'block' }}
                  />
                ) : (
                  <RefreshCw className="spin" size={24} color="#6366f1" />
                )}
              </div>

              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{qrData.device?.name}</div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                <code>{qrData.device?.ip_address}</code> • {qrData.device?.location}
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Scan via Mobile NMS / Google Lens / Handheld Scanner
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button 
                  onClick={handleDownloadQR}
                  style={{ flex: 1, padding: '9px 12px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', border: '1px solid #6366f1', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Download size={15} /> Unduh PNG
                </button>
                <button 
                  onClick={handlePrintQR}
                  style={{ flex: 1, padding: '9px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Printer size={15} /> Cetak Stiker
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Field Scanner & Asset Lookup */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} style={{ color: '#34d399' }} /> Pindai Kode QR / Asset Lookup
          </h3>

          <form onSubmit={handleScanLookup} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="text" 
              placeholder="Input/Scan Asset Code (e.g. NEM-DEV-0039)..."
              value={scanInputCode}
              onChange={(e) => setScanInputCode(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '14px' }}
            />
            <button type="submit" style={{ padding: '10px 16px', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={16} /> Scan
            </button>
          </form>

          <div style={{ marginBottom: '20px' }}>
            <label 
              htmlFor="qr-camera-input"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Camera size={14} /> Scan / Upload Foto QR Kamera
            </label>
            <input 
              id="qr-camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageScan}
              style={{ display: 'none' }}
            />
          </div>

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
