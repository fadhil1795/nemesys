import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Database, 
  RefreshCw
} from 'lucide-react';
import { BACKEND_URL } from '../App';

export const ExecutiveReport: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/executive-summary`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch executive report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = (type: string) => {
    window.open(`${BACKEND_URL}/api/reports/export-csv?type=${type}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
        <RefreshCw className="spin" size={32} style={{ marginBottom: '12px' }} />
        <div>Memuat Laporan Eksekutif Operasional...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#e0e0e0' }}>
      {/* Header Actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText style={{ color: '#6366f1' }} size={28} /> Laporan Eksekutif Operasional IT
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Rekapitulasi Kinerja Jaringan, Pengadaan Asset, Backup, & SLA MTTR (Print PDF Ready)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => handleDownloadCSV('incidents')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <Download size={15} /> Export CSV Insiden
          </button>
          <button 
            onClick={() => handleDownloadCSV('procurements')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid #6366f1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <Download size={15} /> Export CSV Pengadaan
          </button>
          <button 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <Printer size={15} /> Cetak Laporan (PDF)
          </button>
        </div>
      </div>

      {/* Printable Report Sheet Layout */}
      <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '32px' }}>
        
        {/* Company / Univ Header */}
        <div style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.2)', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI</h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Direktorat Teknologi Informasi & Infrastruktur Jaringan (NEMESYS)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>{data?.period || 'Agustus 2026'}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Generated: {new Date().toLocaleString('id-ID')}</div>
          </div>
        </div>

        {/* Executive KPI Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              REKAP INSIDEN & SLA <AlertTriangle size={16} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
              {data?.incidents?.resolved} <span style={{ fontSize: '13px', color: '#34d399' }}>Selesai</span>
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
              Total: {data?.incidents?.total} | Breached SLA: {data?.incidents?.slaBreached}
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              INVESTASI PENGADAAN IT <DollarSign size={16} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '8px', color: '#34d399' }}>
              Rp {(data?.procurement?.totalInvestment || 0).toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
              Total {data?.procurement?.totalItems} Barang & Perangkat
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              BACKUP SUCCESS RATE <Database size={16} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', color: '#60a5fa' }}>
              {data?.backups?.successRatePercent}%
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
              {data?.backups?.verified} / {data?.backups?.total} Perangkat Terverifikasi
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              PENYELESAIAN TUGAS <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', color: '#a78bfa' }}>
              {data?.tasks?.completionRatePercent}%
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
              {data?.tasks?.completed} / {data?.tasks?.total} Tugas Harian Selesai
            </div>
          </div>
        </div>

        {/* Section 1: Breakdown Severity Insiden */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            1. Analisis Gangguan Jaringan Berdasarkan Severity
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)', color: 'rgba(255,255,255,0.8)' }}>
                <th style={{ padding: '10px 14px' }}>Tingkat Keparahan (Severity)</th>
                <th style={{ padding: '10px 14px' }}>Jumlah Insiden</th>
                <th style={{ padding: '10px 14px' }}>Persentase</th>
              </tr>
            </thead>
            <tbody>
              {data?.incidents?.bySeverity?.map((s: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.severity}</td>
                  <td style={{ padding: '10px 14px' }}>{s.count} insiden</td>
                  <td style={{ padding: '10px 14px' }}>
                    {data?.incidents?.total > 0 ? ((s.count / data.incidents.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 2: Breakdown Pengadaan IT Berdasarkan Lokasi */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            2. Distribusi Anggaran Pengadaan IT per Lokasi
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)', color: 'rgba(255,255,255,0.8)' }}>
                <th style={{ padding: '10px 14px' }}>Lokasi / Kampus</th>
                <th style={{ padding: '10px 14px' }}>Jumlah Item</th>
                <th style={{ padding: '10px 14px' }}>Total Biaya Pengadaan (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {data?.procurement?.byLocation?.map((loc: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#818cf8' }}>📍 {loc.location}</td>
                  <td style={{ padding: '10px 14px' }}>{loc.items} barang</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#34d399' }}>
                    Rp {(loc.cost || 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 3: Teknisi Terbaik */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            3. Peringkat Kinerja Teknisi Jaringan (Top Performers)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)', color: 'rgba(255,255,255,0.8)' }}>
                <th style={{ padding: '10px 14px' }}>Nama Teknisi</th>
                <th style={{ padding: '10px 14px' }}>Tugas Selesai</th>
                <th style={{ padding: '10px 14px' }}>Misi Selesai</th>
              </tr>
            </thead>
            <tbody>
              {data?.topTechnicians?.map((tech: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#a78bfa' }}>👤 {tech.name}</td>
                  <td style={{ padding: '10px 14px' }}>{tech.daily_tasks_count} tugas</td>
                  <td style={{ padding: '10px 14px', color: '#fbbf24', fontWeight: 600 }}>{tech.mission_completed} misi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
          <div>
            <div>Mengetahui,</div>
            <div style={{ fontWeight: 700, color: '#fff', marginTop: '60px' }}>Kepala IT & Network Engineer</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>UNTAG Banyuwangi</div>
          </div>
          <div>
            <div>Disetujui Oleh,</div>
            <div style={{ fontWeight: 700, color: '#fff', marginTop: '60px' }}>Direktur Pengelola TI</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Yayasan Perpenas</div>
          </div>
        </div>

      </div>
    </div>
  );
};
