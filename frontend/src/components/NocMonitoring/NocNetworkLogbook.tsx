import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  Plus,
  Clock,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Maximize2,
  Calendar,
  Layers,
  Wrench,
  ShieldAlert,
  Server,
  Wifi,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Info,
  Sliders,
  Check,
  FileText,
  UploadCloud,
  ArrowLeft
} from 'lucide-react';
import { BACKEND_URL } from '../../App';

interface ChangeLogItem {
  id: number;
  device_type: 'mikrotik' | 'olt' | 'onu' | 'switch' | 'other';
  category: string;
  target_name: string;
  action_title: string;
  details?: string | null;
  before_state?: string | null;
  after_state?: string | null;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  pic_name: string;
  execution_start?: string | null;
  execution_end?: string | null;
  duration_minutes: number;
  documentation_images: string[];
  mission_id?: number | null;
  created_at: string;
}

interface MaintenanceWindow {
  id: number;
  device_type: string;
  target_name: string;
  reason: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_end?: string | null;
  is_active: number | boolean;
  silence_alarms: number | boolean;
  created_by: string;
  created_at: string;
  status_badge: 'IN_PROGRESS' | 'SCHEDULED' | 'OVERDUE' | 'COMPLETED';
}

interface LogbookStats {
  total_logs: number;
  mikrotik_count: number;
  olt_count: number;
  onu_count: number;
  switch_count: number;
  total_duration_minutes: number;
  avg_duration_minutes: number;
  active_maintenance: number;
}

interface Props {
  token?: string;
}

export const NocNetworkLogbook: React.FC<Props> = ({ token }) => {
  // View mode: 'list' = Dashboard & Timeline, 'create' = Full Page Worksheet Form (matching user's screenshot)
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  const [logs, setLogs] = useState<ChangeLogItem[]>([]);
  const [stats, setStats] = useState<LogbookStats>({
    total_logs: 0,
    mikrotik_count: 0,
    olt_count: 0,
    onu_count: 0,
    switch_count: 0,
    total_duration_minutes: 0,
    avg_duration_minutes: 0,
    active_maintenance: 0
  });
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals (only for Maintenance Window & Image Lightbox)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Helper for current date in YYYY-MM-DD
  const getTodayDateStr = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };

  // Worksheet Form State
  const [formData, setFormData] = useState({
    device_type: 'mikrotik' as 'mikrotik' | 'olt' | 'onu' | 'switch' | 'other',
    report_type: 'Tugas Rutin Operasional NOC',
    category: 'Queue / Bandwidth',
    report_date: getTodayDateStr(),
    target_name: '',
    action_title: '',
    details: '',
    before_state: '',
    after_state: '',
    obstacles: '',
    impact_level: 'low' as 'low' | 'medium' | 'high' | 'critical',
    pic_name: 'NOC Engineer',
    execution_start_time: '09:00',
    execution_end_time: '09:30',
    duration_minutes: 30,
    documentation_images: [] as string[]
  });

  // Maintenance Form State
  const [maintForm, setMaintForm] = useState({
    device_type: 'all',
    target_name: '',
    reason: '',
    scheduled_start: '',
    scheduled_end: '',
    silence_alarms: true,
    created_by: 'NOC Engineer'
  });

  // File Upload State
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Timer for Maintenance Window countdown
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Report Type Descriptions (mimics the blue alert box from the user's screenshot)
  const reportTypeDescriptions: Record<string, string> = {
    'Tugas Rutin Operasional NOC':
      'Deskripsi: Laporan kegiatan operasional harian/rutin sesuai tupoksi jabatan. Wajib mencantumkan hambatan/kendala dan rencana tindak lanjut.',
    'Perubahan Konfigurasi MikroTik (Queue/Firewall/Routing)':
      'Deskripsi: Perubahan aturan parameter pada router MikroTik (Queue limit bandwidth, firewall NAT/filter, VLAN ID, routing). Pastikan pengujian konektivitas telah dilakukan.',
    'Pemeliharaan Sisi OLT & Distribusi Optik (Splicing/Redaman)':
      'Deskripsi: Pemeliharaan fisik OLT GPON, penggantian atau pembersihan SFP transceiver, re-splicing kabel pigtail/feeder, dan perbaikan redaman ODC/ODP.',
    'Penggantian / Aktivasi Modem ONU Pelanggan':
      'Deskripsi: Pergantian unit modem ONU pelanggan yang rusak akibat petir/adaptor mati, registrasi serial number baru, dan pengetesan redaman optik penerimaan (RX Power).',
    'Konfigurasi Switch & Access Point Distribusi':
      'Deskripsi: Pengaturan port VLAN trunking/access pada switch gedung atau penanganan masalah interferensi / relokasi perangkat WiFi Access Point.',
    'Insiden & Perbaikan Darurat (Emergency Downtime)':
      'Deskripsi: Penanganan darurat akibat kabel fiber putus (cut), perangkat core reboot tak terduga, atau lonjakan traffic serangan DDoS.'
  };

  // Predefined Categories based on Device Type
  const categoryOptions: Record<string, string[]> = {
    mikrotik: [
      'Queue / Bandwidth',
      'Firewall / NAT',
      'VLAN / Routing',
      'DHCP / IP Pool',
      'Hotspot / User Manager',
      'Firmware / Config Backup',
      'Lainnya'
    ],
    olt: [
      'Splicing / Kabel Optik',
      'Pembersihan / Penggantian SFP',
      'ODC / ODP Maintenance',
      'Config / VLAN Profile OLT',
      'Firmware Upgrade OLT',
      'Lainnya'
    ],
    onu: [
      'Ganti Modem / ONU',
      'Perbaikan Redaman / Dropcore',
      'Registrasi / Provisioning Baru',
      'Relokasi Modem',
      'Lainnya'
    ],
    switch: [
      'VLAN Trunking / Access',
      'Port Mirroring / Link Aggregation',
      'Firmware Switch',
      'Penggantian Kabel Patchcord',
      'Lainnya'
    ],
    other: ['Genset / Listrik Rack', 'UPS / Baterai Server', 'Suhu & Pendingin Ruang NOC', 'Lainnya']
  };

  // Fetch Change Logs & Stats
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (deviceFilter !== 'all') params.append('device_type', deviceFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`${BACKEND_URL}/api/network-logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setErrorMsg(data.error || 'Gagal memuat log');
      }
    } catch (err: any) {
      console.error('Fetch logs error:', err);
      setErrorMsg(err.message || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Maintenance Windows
  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/network-logs/maintenance`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceList(data.data || []);
      }
    } catch (err) {
      console.error('Fetch maintenance error:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchMaintenance();
  }, [deviceFilter, categoryFilter, startDate, endDate]);

  // Live Countdown Timer for Active Maintenance
  useEffect(() => {
    const activeWindow = maintenanceList.find(
      (m) => m.is_active && new Date(m.scheduled_end).getTime() > Date.now()
    );

    if (!activeWindow) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(activeWindow.scheduled_end).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Waktu Maintenance Habis');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [maintenanceList]);

  // Auto-calculate duration from start & end time
  const handleTimeChange = (startTime: string, endTime: string) => {
    let calcDuration = 0;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes >= startMinutes) {
        calcDuration = endMinutes - startMinutes;
      }
    }
    setFormData((prev) => ({
      ...prev,
      execution_start_time: startTime,
      execution_end_time: endTime,
      duration_minutes: calcDuration
    }));
  };

  // Upload Photo to Server
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingImage(true);
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bodyFormData = new FormData();
        bodyFormData.append('photo', file);
        bodyFormData.append('folder', 'network-logs');

        const res = await fetch(`${BACKEND_URL}/api/upload/ticket-photo`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: bodyFormData
        });

        const data = await res.json();
        if (data.success && data.url) {
          const fullUrl = data.url.startsWith('http')
            ? data.url
            : `${BACKEND_URL}${data.url.startsWith('/') ? '' : '/'}${data.url}`;
          uploadedUrls.push(fullUrl);
        } else {
          alert(`Gagal upload file ${file.name}: ${data.error || 'Unknown error'}`);
        }
      }

      setFormData((prev) => ({
        ...prev,
        documentation_images: [...prev.documentation_images, ...uploadedUrls]
      }));
    } catch (err: any) {
      console.error('Error uploading image:', err);
      alert('Terjadi kesalahan saat mengunggah foto dokumentasi.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documentation_images: prev.documentation_images.filter((_, i) => i !== index)
    }));
  };

  // Handle switching report type
  const handleReportTypeSelect = (rType: string) => {
    let dType: 'mikrotik' | 'olt' | 'onu' | 'switch' | 'other' = 'mikrotik';
    let cat = 'Queue / Bandwidth';

    if (rType.includes('MikroTik')) {
      dType = 'mikrotik';
      cat = 'Queue / Bandwidth';
    } else if (rType.includes('OLT')) {
      dType = 'olt';
      cat = 'Splicing / Kabel Optik';
    } else if (rType.includes('ONU')) {
      dType = 'onu';
      cat = 'Ganti Modem / ONU';
    } else if (rType.includes('Switch')) {
      dType = 'switch';
      cat = 'VLAN Trunking / Access';
    } else {
      dType = 'other';
      cat = 'Tugas Rutin Harian';
    }

    setFormData((prev) => ({
      ...prev,
      report_type: rType,
      device_type: dType,
      category: cat
    }));
  };

  // Submit Worksheet Form
  const handleWorksheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.target_name.trim() || !formData.action_title.trim() || !formData.pic_name.trim()) {
      alert('Target perangkat, judul aktivitas/tindakan, dan nama PIC wajib diisi!');
      return;
    }

    try {
      // Build ISO datetimes using report_date and times
      const startDateTime = formData.report_date && formData.execution_start_time
        ? `${formData.report_date}T${formData.execution_start_time}:00`
        : null;
      const endDateTime = formData.report_date && formData.execution_end_time
        ? `${formData.report_date}T${formData.execution_end_time}:00`
        : null;

      // Concatenate details with obstacles if provided
      let fullDetails = formData.details;
      if (formData.obstacles.trim()) {
        fullDetails = fullDetails
          ? `${fullDetails}\n\n[Hambatan / Rencana Tindak Lanjut]: ${formData.obstacles.trim()}`
          : `[Hambatan / Rencana Tindak Lanjut]: ${formData.obstacles.trim()}`;
      }

      const payload = {
        device_type: formData.device_type,
        category: formData.category,
        target_name: formData.target_name,
        action_title: formData.action_title,
        details: fullDetails,
        before_state: formData.before_state,
        after_state: formData.after_state,
        impact_level: formData.impact_level,
        pic_name: formData.pic_name,
        execution_start: startDateTime,
        execution_end: endDateTime,
        duration_minutes: formData.duration_minutes,
        documentation_images: formData.documentation_images
      };

      const res = await fetch(`${BACKEND_URL}/api/network-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Switch back to list view and refresh
        setViewMode('list');
        fetchLogs();
      } else {
        alert(data.error || 'Gagal menyimpan catatan perubahan');
      }
    } catch (err: any) {
      console.error('Submit change log error:', err);
      alert('Terjadi kesalahan saat menyimpan catatan perubahan');
    }
  };

  // Delete Change Log
  const handleDeleteLog = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus catatan logbook ini secara permanen?')) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/network-logs/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        fetchLogs();
      } else {
        alert(data.error || 'Gagal menghapus log');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Terjadi kesalahan saat menghapus');
    }
  };

  // Submit Maintenance Window
  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintForm.target_name.trim() || !maintForm.reason.trim() || !maintForm.scheduled_start || !maintForm.scheduled_end) {
      alert('Semua kolom jadwal maintenance wajib diisi!');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/network-logs/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(maintForm)
      });

      const data = await res.json();
      if (data.success) {
        setMaintenanceModalOpen(false);
        fetchMaintenance();
        fetchLogs();
      } else {
        alert(data.error || 'Gagal menjadwalkan maintenance');
      }
    } catch (err: any) {
      console.error('Maintenance error:', err);
      alert('Terjadi kesalahan saat menjadwalkan maintenance');
    }
  };

  // End Maintenance Window
  const handleEndMaintenance = async (id: number) => {
    if (!window.confirm('Tutup jendela maintenance ini sekarang? Alarm dan notifikasi normal akan diaktifkan kembali.')) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/network-logs/maintenance/${id}/end`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        fetchMaintenance();
        fetchLogs();
      }
    } catch (err) {
      console.error('End maintenance error:', err);
    }
  };

  // Quick Preset Helper for Maintenance Start/End
  const applyDurationPreset = (minutes: number) => {
    const now = new Date();
    const end = new Date(now.getTime() + minutes * 60000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toInputFormat = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setMaintForm((prev) => ({
      ...prev,
      scheduled_start: toInputFormat(now),
      scheduled_end: toInputFormat(end)
    }));
  };

  // =========================================================================
  // EXPORT 1: EXCEL (.XLSX)
  // =========================================================================
  const handleExportExcel = () => {
    if (logs.length === 0) {
      alert('Tidak ada data logbook untuk diekspor.');
      return;
    }

    const exportData = logs.map((item, idx) => ({
      No: idx + 1,
      'Waktu Dibuat': new Date(item.created_at).toLocaleString('id-ID'),
      'Tipe Perangkat': item.device_type.toUpperCase(),
      Kategori: item.category,
      'Target Perangkat': item.target_name,
      'Judul Perubahan / Tindakan': item.action_title,
      'Tingkat Dampak': item.impact_level.toUpperCase(),
      'PIC / Pelaksana': item.pic_name,
      'Waktu Mulai': item.execution_start ? new Date(item.execution_start).toLocaleString('id-ID') : '-',
      'Waktu Selesai': item.execution_end ? new Date(item.execution_end).toLocaleString('id-ID') : '-',
      'Durasi (Menit)': item.duration_minutes || 0,
      'Kondisi Sebelum': item.before_state || '-',
      'Kondisi Sesudah': item.after_state || '-',
      'Detail Keterangan': item.details || '-',
      'Jumlah Foto Bukti': item.documentation_images ? item.documentation_images.length : 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 15 },
      { wch: 22 },
      { wch: 28 },
      { wch: 35 },
      { wch: 14 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 30 },
      { wch: 30 },
      { wch: 45 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Logbook Perubahan NOC');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Logbook_Perubahan_Jaringan_NOC_${dateStr}.xlsx`);
  };

  // =========================================================================
  // EXPORT 2: PDF LAPORAN RESMI NOC
  // =========================================================================
  const handleExportPDF = () => {
    if (logs.length === 0) {
      alert('Tidak ada data logbook untuk dicetak.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup diblokir oleh browser. Izinkan pop-up untuk mencetak PDF laporan.');
      return;
    }

    const printDate = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const rowsHtml = logs
      .map(
        (log, idx) => `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td>
            <strong>${log.target_name}</strong><br/>
            <span style="font-size: 11px; color: #475569;">${log.action_title}</span>
          </td>
          <td style="text-align: center;">
            <span style="padding: 2px 6px; font-size: 10px; font-weight: 600; border-radius: 4px; background: #e0e7ff; color: #3730a3; text-transform: uppercase;">
              ${log.device_type}
            </span><br/>
            <span style="font-size: 11px; color: #64748b;">${log.category}</span>
          </td>
          <td style="font-size: 11px;">
            <div><strong>Mulai:</strong> ${log.execution_start ? new Date(log.execution_start).toLocaleString('id-ID') : '-'}</div>
            <div><strong>Selesai:</strong> ${log.execution_end ? new Date(log.execution_end).toLocaleString('id-ID') : '-'}</div>
            <div style="font-weight: 600; color: #0284c7;">⏱ ${log.duration_minutes || 0} Menit</div>
          </td>
          <td style="font-size: 11px;">
            ${log.before_state ? `<div><span style="color: #dc2626;">[Sebelum]</span> ${log.before_state}</div>` : ''}
            ${log.after_state ? `<div><span style="color: #16a34a;">[Sesudah]</span> ${log.after_state}</div>` : ''}
            ${log.details ? `<div style="color: #475569; margin-top: 2px;"><em>${log.details}</em></div>` : ''}
          </td>
          <td style="text-align: center; font-size: 11px;">
            <strong>${log.pic_name}</strong><br/>
            <span style="font-size: 10px; color: #64748b;">Dampak: ${log.impact_level.toUpperCase()}</span>
          </td>
          <td style="text-align: center;">
            ${
              log.documentation_images && log.documentation_images.length > 0
                ? `<div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                    ${log.documentation_images
                      .slice(0, 2)
                      .map(
                        (img) =>
                          `<img src="${img}" style="width: 48px; height: 36px; object-fit: cover; border-radius: 3px; border: 1px solid #cbd5e1;" />`
                      )
                      .join('')}
                    ${log.documentation_images.length > 2 ? `<span style="font-size: 10px; color: #64748b;">+${log.documentation_images.length - 2}</span>` : ''}
                   </div>`
                : '<span style="color: #94a3b8; font-size: 10px;">-</span>'
            }
          </td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan_Logbook_Perubahan_Jaringan_NOC_${new Date().toISOString().split('T')[0]}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm 10mm 15mm 10mm;
            }
            body {
              font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 12px;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .kop-title {
              font-size: 18px;
              font-weight: 800;
              letter-spacing: -0.5px;
              text-transform: uppercase;
              color: #1e293b;
            }
            .kop-subtitle {
              font-size: 13px;
              color: #475569;
              font-weight: 500;
            }
            .meta-box {
              display: flex;
              justify-content: space-between;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 15px;
              font-size: 11px;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            table.data-table th {
              background: #0f172a;
              color: #ffffff;
              padding: 8px 6px;
              font-size: 11px;
              text-align: left;
              border: 1px solid #0f172a;
            }
            table.data-table td {
              padding: 8px 6px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
            }
            table.data-table tr:nth-child(even) {
              background: #f8fafc;
            }
            .signature-section {
              width: 100%;
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .sig-box {
              width: 40%;
              text-align: center;
              font-size: 12px;
            }
            .sig-space {
              height: 65px;
            }
            .sig-name {
              font-weight: bold;
              text-decoration: underline;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 70%;">
                <div class="kop-title">NEMESYS NETWORK OPERATIONS CENTER (NOC)</div>
                <div class="kop-subtitle">Buku Logbook Resmi Perubahan Konfigurasi &amp; Pemeliharaan Infrastruktur Jaringan</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">RouterOS MikroTik Core &bull; C-DATA GPON OLT &bull; Distribusi Fiber Optik FTTH</div>
              </td>
              <td style="width: 30%; text-align: right; font-size: 11px; color: #475569;">
                <div><strong>Dicetak Pada:</strong> ${printDate}</div>
                <div><strong>Total Catatan:</strong> ${logs.length} Perubahan</div>
                <div><strong>Status:</strong> Terverifikasi Digital NOC</div>
              </td>
            </tr>
          </table>

          <div class="meta-box">
            <div><strong>Filter Perangkat:</strong> ${deviceFilter.toUpperCase()}</div>
            <div><strong>Filter Kategori:</strong> ${categoryFilter}</div>
            <div><strong>Total Waktu Pengerjaan:</strong> ${stats.total_duration_minutes} Menit</div>
            <div><strong>Rata-Rata Waktu:</strong> ${stats.avg_duration_minutes} Menit/Tindakan</div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 4%; text-align: center;">No</th>
                <th style="width: 20%;">Target &amp; Judul Tindakan</th>
                <th style="width: 14%; text-align: center;">Perangkat &amp; Kategori</th>
                <th style="width: 18%;">Waktu &amp; Durasi</th>
                <th style="width: 24%;">Parameter Sebelum / Sesudah</th>
                <th style="width: 12%; text-align: center;">PIC / Pelaksana</th>
                <th style="width: 8%; text-align: center;">Bukti Foto</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table class="signature-section">
            <tr>
              <td class="sig-box" style="text-align: left; padding-left: 30px;">
                <div>Mengetahui,</div>
                <div><strong>Kepala Network Operations Center (NOC)</strong></div>
                <div class="sig-space"></div>
                <div class="sig-name">( Ir. Hendra Gunawan, M.T. )</div>
                <div style="font-size: 10px; color: #64748b;">NIP. 19820415 200812 1 002</div>
              </td>
              <td style="width: 20%;"></td>
              <td class="sig-box" style="text-align: right; padding-right: 30px;">
                <div>Tanggal, ${new Date().toLocaleDateString('id-ID')}</div>
                <div><strong>Koordinator Teknisi Jaringan &amp; FTTH</strong></div>
                <div class="sig-space"></div>
                <div class="sig-name">( Fadhil Pratama, S.Kom )</div>
                <div style="font-size: 10px; color: #64748b;">Lead NOC Systems Administrator</div>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Helper Badge Color for Impact
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.3)' };
      case 'medium':
        return { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: 'rgba(234, 179, 8, 0.3)' };
      default:
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
    }
  };

  const getDeviceIcon = (dev: string) => {
    switch (dev) {
      case 'mikrotik':
        return <Server size={14} style={{ color: '#38bdf8' }} />;
      case 'olt':
        return <Wifi size={14} style={{ color: '#818cf8' }} />;
      case 'onu':
        return <Layers size={14} style={{ color: '#34d399' }} />;
      case 'switch':
        return <Sliders size={14} style={{ color: '#f472b6' }} />;
      default:
        return <Wrench size={14} style={{ color: '#94a3b8' }} />;
    }
  };

  const activeMaintenance = maintenanceList.find((m) => m.is_active);

  // =========================================================================
  // VIEW 2: FORM INPUT BARU / BUAT LAPORAN KERJA (WORKSHEET FULL-PAGE VIEW)
  // (Sesuai dengan screenshot yang diberikan USER)
  // =========================================================================
  if (viewMode === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: '960px', margin: '0 auto' }}>
        {/* Breadcrumb Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span>Dashboard</span>
            <span>&rsaquo;</span>
            <span style={{ color: '#cbd5e1' }}>Worksheet / Logbook</span>
            <span>&rsaquo;</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Input Baru</span>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              color: '#cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Daftar Logbook</span>
          </button>
        </div>

        {/* Page Title */}
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.5px' }}>
            Buat Laporan Kerja (Worksheet)
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Formulir resmi pencatatan aktivitas pemeliharaan, re-konfigurasi MikroTik, dan troubleshooting jaringan optik.
          </p>
        </div>

        {/* White/Cyber Card Container (Identical to user's screenshot layout) */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.85))',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          <form onSubmit={handleWorksheetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            {/* 1. Jenis Laporan Kerja */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                Jenis Laporan Kerja *
              </label>
              <select
                value={formData.report_type}
                onChange={(e) => handleReportTypeSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Tugas Rutin Operasional NOC">Tugas Rutin Operasional NOC</option>
                <option value="Perubahan Konfigurasi MikroTik (Queue/Firewall/Routing)">
                  Perubahan Konfigurasi MikroTik (Queue/Firewall/VLAN/Routing)
                </option>
                <option value="Pemeliharaan Sisi OLT & Distribusi Optik (Splicing/Redaman)">
                  Pemeliharaan Sisi OLT &amp; Distribusi Optik (Splicing/Redaman/ODC)
                </option>
                <option value="Penggantian / Aktivasi Modem ONU Pelanggan">
                  Penggantian / Aktivasi Modem ONU Pelanggan
                </option>
                <option value="Konfigurasi Switch & Access Point Distribusi">
                  Konfigurasi Switch &amp; Access Point Distribusi
                </option>
                <option value="Insiden & Perbaikan Darurat (Emergency Downtime)">
                  Insiden &amp; Perbaikan Darurat (Emergency Downtime)
                </option>
              </select>

              {/* Blue Info Alert Box (Matching the screenshot exactly) */}
              <div
                style={{
                  marginTop: '0.75rem',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  color: '#bae6fd',
                  fontSize: '0.82rem',
                  lineHeight: '1.45'
                }}
              >
                <Info size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                <span>{reportTypeDescriptions[formData.report_type] || reportTypeDescriptions['Tugas Rutin Operasional NOC']}</span>
              </div>
            </div>

            {/* 2. Tanggal Laporan & Jam Pelaksanaan */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Tanggal Laporan *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={formData.report_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, report_date: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Waktu Mulai &amp; Selesai
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="time"
                    value={formData.execution_start_time}
                    onChange={(e) => handleTimeChange(e.target.value, formData.execution_end_time)}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.6rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>s/d</span>
                  <input
                    type="time"
                    value={formData.execution_end_time}
                    onChange={(e) => handleTimeChange(formData.execution_start_time, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.6rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Durasi Pengerjaan
                </label>
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '10px',
                    color: '#34d399',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Clock size={16} />
                  <span>{formData.duration_minutes} Menit (Kalkulasi Otomatis)</span>
                </div>
              </div>
            </div>

            {/* 3. Judul Aktivitas / Nama Program */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                Judul Aktivitas / Nama Program *
              </label>
              <input
                type="text"
                placeholder="Contoh: Pembuatan modul sinkronisasi database absensi / Upgrade limit bandwidth sidang skripsi"
                value={formData.action_title}
                onChange={(e) => setFormData((prev) => ({ ...prev, action_title: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* 4. Target Perangkat / Komponen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Target Perangkat / Komponen *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Simple Queue Dosen_TI, ODC Gedung C - Core 4, ONU-02 Lab Elektro..."
                  value={formData.target_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, target_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Kategori Spesifik
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {(categoryOptions[formData.device_type] || ['Lainnya']).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Uraian Kegiatan */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                Uraian Kegiatan
              </label>
              <textarea
                rows={4}
                placeholder="Jelaskan detail uraian pekerjaan/kegiatan yang telah dilakukan..."
                value={formData.details}
                onChange={(e) => setFormData((prev) => ({ ...prev, details: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: '1.5'
                }}
              />
            </div>

            {/* 6. Luaran / Hasil Kerja (Kondisi Sebelum & Sesudah) */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                Luaran / Hasil Kerja (Parameter Sebelum &amp; Sesudah)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    🔻 Parameter Sebelum Perubahan:
                  </span>
                  <input
                    type="text"
                    placeholder="Contoh: RX Redaman -29.4 dBm / Limit 20M/20M / Offline"
                    value={formData.before_state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, before_state: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    🟢 Parameter Sesudah Perubahan (Hasil Dicapai):
                  </span>
                  <input
                    type="text"
                    placeholder="Contoh: RX Redaman -18.2 dBm / Limit 50M/50M burst 70M / Online 1Gbps"
                    value={formData.after_state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, after_state: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 7. Hambatan / Kendala / Rencana Tindak Lanjut */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                Hambatan / Kendala / Rencana Tindak Lanjut
              </label>
              <textarea
                rows={2}
                placeholder="Catatan hambatan atau langkah penyelesaian selanjutnya (opsional)..."
                value={formData.obstacles}
                onChange={(e) => setFormData((prev) => ({ ...prev, obstacles: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: '1.5'
                }}
              />
            </div>

            {/* 8. Tingkat Dampak & PIC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Tingkat Dampak Jaringan
                </label>
                <select
                  value={formData.impact_level}
                  onChange={(e) => setFormData((prev) => ({ ...prev, impact_level: e.target.value as any }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="low">Rendah (Tanpa Gangguan Layanan)</option>
                  <option value="medium">Sedang (Jeda Singkat / 1-2 User)</option>
                  <option value="high">Tinggi (Subnet / 1 Gedung Terdampak)</option>
                  <option value="critical">Kritis (Backbone Core / OLT Down)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                  Nama PIC / Teknisi Pelaksana *
                </label>
                <input
                  type="text"
                  value={formData.pic_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pic_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* 9. Bukti Dokumentasi (Foto Pekerjaan / Screenshot Konfigurasi) */}
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  color: '#38bdf8',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '0.45rem'
                }}
              >
                <Camera size={16} />
                <span>Bukti Dokumentasi (Foto Pekerjaan / Screenshot Konfigurasi)</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />

              <div
                style={{
                  border: '1px dashed rgba(56, 189, 248, 0.4)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8'
                    }}
                  >
                    <UploadCloud size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                      Lampirkan Foto Hasil Pekerjaan
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Format JPG, PNG, atau WebP (Foto OPM, fusion splicer, terminal MikroTik, dsb.)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '1px solid rgba(56, 189, 248, 0.5)',
                    color: '#38bdf8',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Camera size={16} />
                  <span>{uploadingImage ? 'Mengunggah...' : '+ Pilih Foto'}</span>
                </button>
              </div>

              {/* Uploaded Thumbnails */}
              {formData.documentation_images.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                  {formData.documentation_images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                      }}
                    >
                      <img
                        src={imgUrl}
                        alt="Bukti Dokumentasi"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          background: 'rgba(0, 0, 0, 0.75)',
                          color: '#f87171',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '1rem',
                borderTop: '1px solid rgba(71, 85, 105, 0.4)',
                paddingTop: '1.25rem',
                marginTop: '0.5rem'
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  background: 'rgba(51, 65, 85, 0.5)',
                  color: '#cbd5e1',
                  border: 'none',
                  padding: '0.65rem 1.4rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Batal
              </button>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.8rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Check size={18} />
                <span>Simpan Laporan Kerja</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: DAFTAR LOGBOOK & TIMELINE (DASHBOARD LIST VIEW)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. TOP STATS CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Catatan
            </span>
            <BookOpen size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
            {stats.total_logs}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Seluruh riwayat perubahan tercatat
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              MikroTik RouterOS
            </span>
            <Server size={18} style={{ color: '#60a5fa' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60a5fa' }}>
            {stats.mikrotik_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Queue, Firewall, DHCP, Routing
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(129, 140, 248, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              OLT &amp; Fiber Optik
            </span>
            <Wifi size={18} style={{ color: '#818cf8' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#818cf8' }}>
            {(stats.olt_count || 0) + (stats.onu_count || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Splicing, Redaman, Ganti ONU
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Waktu Pengerjaan
            </span>
            <Clock size={18} style={{ color: '#34d399' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399' }}>
            {stats.total_duration_minutes} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Menit</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Rata-rata: {stats.avg_duration_minutes || 0} menit / perubahan
          </div>
        </div>
      </div>

      {/* 2. ACTIVE MAINTENANCE WINDOW BANNER (IF ACTIVE) */}
      {activeMaintenance && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15), rgba(180, 83, 9, 0.25))',
            border: '1px solid rgba(249, 115, 22, 0.5)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(249, 115, 22, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fb923c'
              }}
            >
              <AlertTriangle size={24} className="olt-pulse" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>
                  Jendela Pemeliharaan (Maintenance Window) Sedang Berjalan!
                </span>
                <span
                  style={{
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    letterSpacing: '0.5px'
                  }}
                >
                  LIVE AKTIF
                </span>
                {activeMaintenance.silence_alarms && (
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      color: '#fed7aa',
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '20px'
                    }}
                  >
                    🔕 Alarm &amp; Notifikasi Disenyapkan
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fed7aa', marginTop: '2px' }}>
                <strong>Target:</strong> {activeMaintenance.target_name} &bull; <strong>Alasan:</strong>{' '}
                {activeMaintenance.reason} &bull; <strong>PIC:</strong> {activeMaintenance.created_by}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {timeRemaining && (
              <div
                style={{
                  textAlign: 'right',
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(249, 115, 22, 0.3)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>SISA WAKTU:</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f97316', fontFamily: 'monospace' }}>
                  {timeRemaining}
                </div>
              </div>
            )}
            <button
              onClick={() => handleEndMaintenance(activeMaintenance.id)}
              style={{
                background: '#ea580c',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease'
              }}
            >
              <CheckCircle2 size={16} />
              <span>Selesaikan Maintenance</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. TOOLBAR & CONTROLS */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Device Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Semua Perangkat', icon: Layers },
              { id: 'mikrotik', label: 'MikroTik', icon: Server },
              { id: 'olt', label: 'OLT Core', icon: Wifi },
              { id: 'onu', label: 'Modem Pelanggan', icon: Wifi },
              { id: 'switch', label: 'Switch & AP', icon: Sliders }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = deviceFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setDeviceFilter(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: isActive ? '#38bdf8' : 'rgba(71, 85, 105, 0.4)',
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                    color: isActive ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons: Add Log (Now opens Full Page Worksheet), Start Maint, Export Excel, Export PDF */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setViewMode('create')}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Plus size={16} />
              <span>Buat Laporan Kerja Baru</span>
            </button>

            <button
              onClick={() => {
                applyDurationPreset(60); // Default 1 hour
                setMaintenanceModalOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #d97706, #ea580c)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
              }}
            >
              <Clock size={16} />
              <span>Buka Jadwal Maintenance</span>
            </button>

            <button
              onClick={handleExportExcel}
              title="Unduh Lembar Kerja Excel (.xlsx)"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              title="Cetak Laporan Resmi Format PDF"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Printer size={16} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder="Cari target perangkat, judul perubahan, PIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2rem',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              <option value="all">Semua Kategori</option>
              <option value="Queue / Bandwidth">Queue / Bandwidth</option>
              <option value="Firewall / NAT">Firewall / NAT</option>
              <option value="VLAN / Routing">VLAN / Routing</option>
              <option value="Splicing / Kabel Optik">Splicing / Kabel Optik</option>
              <option value="Ganti Modem / ONU">Ganti Modem / ONU</option>
              <option value="Firmware / Config Backup">Firmware / Config Backup</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '0.45rem 0.5rem',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '0.45rem 0.5rem',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          <button
            onClick={fetchLogs}
            style={{
              padding: '0.45rem 0.85rem',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              borderRadius: '8px',
              color: '#38bdf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem'
            }}
          >
            <RefreshCw size={14} className={loading ? 'olt-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 4. LOG LIST TIMELINE */}
      {loading && logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <RefreshCw size={24} className="olt-spin" style={{ margin: '0 auto 0.75rem', color: '#38bdf8' }} />
          <div>Memuat riwayat perubahan jaringan...</div>
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px dashed rgba(71, 85, 105, 0.4)',
            borderRadius: '12px',
            color: '#94a3b8'
          }}
        >
          <BookOpen size={36} style={{ color: '#64748b', margin: '0 auto 0.75rem' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
            Belum ada catatan perubahan untuk filter ini
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Klik tombol &quot;Buat Laporan Kerja Baru&quot; untuk mencatat pemeliharaan MikroTik atau OLT.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {logs.map((log) => {
            const impactStyle = getImpactBadge(log.impact_level);
            return (
              <div
                key={log.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.7))',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: '12px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Header row: Device, Category, Impact, and Time */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Device Badge */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    >
                      {getDeviceIcon(log.device_type)}
                      <span>{log.device_type}</span>
                    </span>

                    {/* Category */}
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: '#cbd5e1',
                        fontSize: '0.75rem'
                      }}
                    >
                      {log.category}
                    </span>

                    {/* Impact Level */}
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '12px',
                        background: impactStyle.bg,
                        border: `1px solid ${impactStyle.border}`,
                        color: impactStyle.color,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    >
                      Dampak: {log.impact_level}
                    </span>
                  </div>

                  {/* Created timestamp & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      title="Hapus catatan"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '3px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Target & Action Title */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                    🎯 Target: {log.target_name}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {log.action_title}
                  </div>
                </div>

                {/* Details text */}
                {log.details && (
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                    {log.details}
                  </div>
                )}

                {/* Before / After comparison if provided */}
                {(log.before_state || log.after_state) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '0.75rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      border: '1px solid rgba(51, 65, 85, 0.4)'
                    }}
                  >
                    {log.before_state && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                          🔻 Parameter Sebelum Perubahan:
                        </div>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#cbd5e1',
                            marginTop: '2px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            padding: '4px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {log.before_state}
                        </div>
                      </div>
                    )}
                    {log.after_state && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>
                          🟢 Luaran / Hasil Sesudah Perubahan:
                        </div>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#cbd5e1',
                            marginTop: '2px',
                            background: 'rgba(34, 197, 94, 0.08)',
                            padding: '4px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {log.after_state}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer: PIC, Execution Time, Duration badge, Documentation Images */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderTop: '1px solid rgba(51, 65, 85, 0.4)',
                    paddingTop: '0.65rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      👤 PIC: <strong style={{ color: '#f1f5f9' }}>{log.pic_name}</strong>
                    </div>

                    {log.execution_start && log.execution_end && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} style={{ color: '#38bdf8' }} />
                        <span>
                          {new Date(log.execution_start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}{' '}
                          &rarr;{' '}
                          {new Date(log.execution_end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {log.duration_minutes > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#34d399',
                          background: 'rgba(52, 211, 153, 0.1)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          border: '1px solid rgba(52, 211, 153, 0.25)'
                        }}
                      >
                        ⏱ {log.duration_minutes} Menit
                      </span>
                    )}
                  </div>

                  {/* Documentation Photos Thumbnails */}
                  {log.documentation_images && log.documentation_images.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Camera size={13} />
                        <span>Bukti ({log.documentation_images.length}):</span>
                      </span>
                      {log.documentation_images.map((imgUrl, imgIdx) => (
                        <div
                          key={imgIdx}
                          onClick={() => setPreviewImageUrl(imgUrl)}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          <img
                            src={imgUrl}
                            alt="Bukti Dokumentasi"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL JADWAL MAINTENANCE (HANYA UNTUK MAINTENANCE WINDOW)                  */}
      {/* ========================================================================= */}
      {maintenanceModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Clock size={20} style={{ color: '#f97316' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                  Jadwalkan Maintenance Window
                </h3>
              </div>
              <button
                onClick={() => setMaintenanceModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleMaintenanceSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Target Perangkat / Sektor yang Dipelihara *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: GPON OLT SFP Slot 1, Core Kabel Utama Gedung B, Router Core..."
                  value={maintForm.target_name}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, target_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Alasan Pemeliharaan (Downtime Reason) *
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pemotongan &amp; re-splicing kabel feeder ODC yang terputus di jalan utama..."
                  value={maintForm.reason}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, reason: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Preset Durasi Cepat
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    { label: '15 Menit', mins: 15 },
                    { label: '30 Menit', mins: 30 },
                    { label: '1 Jam', mins: 60 },
                    { label: '2 Jam', mins: 120 },
                    { label: '4 Jam', mins: 240 }
                  ].map((p) => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => applyDurationPreset(p.mins)}
                      style={{
                        background: 'rgba(249, 115, 22, 0.15)',
                        border: '1px solid rgba(249, 115, 22, 0.35)',
                        color: '#fb923c',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start & End */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Waktu Mulai *
                  </label>
                  <input
                    type="datetime-local"
                    value={maintForm.scheduled_start}
                    onChange={(e) => setMaintForm((prev) => ({ ...prev, scheduled_start: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Waktu Selesai *
                  </label>
                  <input
                    type="datetime-local"
                    value={maintForm.scheduled_end}
                    onChange={(e) => setMaintForm((prev) => ({ ...prev, scheduled_end: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>

              {/* Silence alarms checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(30, 41, 59, 0.5)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(71, 85, 105, 0.4)'
                }}
              >
                <input
                  type="checkbox"
                  id="silence_alarms"
                  checked={maintForm.silence_alarms}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, silence_alarms: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="silence_alarms" style={{ fontSize: '0.8rem', color: '#fed7aa', cursor: 'pointer' }}>
                  <strong>🔕 Senyapkan Notifikasi Alarm</strong> (Cegah bot alarm &amp; dashboard berbunyi saat link mati sementara)
                </label>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Nama Teknisi Penanggung Jawab *
                </label>
                <input
                  type="text"
                  value={maintForm.created_by}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, created_by: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid rgba(51, 65, 85, 0.5)',
                  paddingTop: '1rem'
                }}
              >
                <button
                  type="button"
                  onClick={() => setMaintenanceModalOpen(false)}
                  style={{
                    background: 'rgba(51, 65, 85, 0.6)',
                    color: '#f1f5f9',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #ea580c)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
                  }}
                >
                  Aktifkan Jadwal Maintenance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX PREVIEW FOTO BUKTI DOKUMENTASI                                    */}
      {/* ========================================================================= */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}
          >
            <img
              src={previewImageUrl}
              alt="Bukti Dokumentasi Full"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
            <button
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default NocNetworkLogbook;
