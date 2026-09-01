# LAPORAN SISTEM IT HELPDESK & NETWORK MANAGEMENT
# UNIVERSITAS 17 AGUSTUS 1945 BANYUWANGI

---

**Disusun oleh:** Tim Biro Teknologi Informasi  
**Tanggal:** Juni 2026  
**Versi Sistem:** 1.3.0  

---

## RINGKASAN EKSEKUTIF

Universitas 17 Agustus 1945 (UNTAG) Banyuwangi telah berhasil mengimplementasikan sistem IT Helpdesk dan Network Management System yang terintegrasi untuk meningkatkan kualitas layanan IT kepada seluruh civitas akademika. Sistem ini menggabungkan manajemen tiket layanan, monitoring infrastruktur jaringan real-time, dan otomasi proses penanganan gangguan.

### Pencapaian Utama:
- ✅ **Portal Layanan Publik** untuk pengaduan civitas akademika
- ✅ **Dashboard Monitoring Jaringan** dengan visualisasi topology & map
- ✅ **Sistem Tiket Otomatis** dengan klasifikasi SLA 4 tingkat prioritas
- ✅ **Integrasi Telegram Bot** untuk notifikasi real-time ke teknisi
- ✅ **Integrasi Zabbix** untuk monitoring infrastruktur otomatis
- ✅ **Manajemen Tim & Misi** dengan tracking performa teknisi
- ✅ **Sistem Statistik & Laporan** untuk evaluasi layanan

---

## 1. LATAR BELAKANG

### 1.1 Kondisi Sebelum Implementasi
Sebelumnya, penanganan kendala IT di UNTAG Banyuwangi masih dilakukan secara manual melalui:
- Laporan via WhatsApp personal atau telepon langsung
- Tidak ada sistem pencatatan dan tracking yang terstruktur
- Sulit memantau status penanganan gangguan
- Tidak ada data historis untuk evaluasi kinerja
- Prioritas penanganan tidak berdasarkan tingkat urgensi yang jelas

### 1.2 Kebutuhan Strategis
Untuk mendukung transformasi digital kampus, diperlukan sistem yang mampu:
1. Memberikan akses mudah bagi civitas untuk melaporkan kendala
2. Melakukan monitoring proaktif terhadap infrastruktur jaringan
3. Mengotomasi proses penanganan tiket dengan SLA yang jelas
4. Menyediakan dashboard untuk manajemen dan teknisi
5. Menghasilkan data untuk evaluasi dan perbaikan berkelanjutan


---

## 2. ARSITEKTUR SISTEM

### 2.1 Komponen Utama

#### A. Frontend (React + TypeScript)
Portal berbasis web modern dengan tampilan responsif yang terdiri dari:

**1. Portal Publik (Tanpa Login)**
- Form pengaduan IT Helpdesk untuk semua civitas
- Cek status tiket berdasarkan nomor tiket atau NIM/NIP
- Dokumentasi layanan dan panduan FAQ
- Akses 24/7 dari mana saja

**2. Dashboard Admin/Manager (Dengan Autentikasi)**
- Dashboard monitoring real-time status jaringan
- Manajemen tiket gangguan (approve/reject/assign)
- Visualisasi network topology
- Peta lokasi device dengan integrasi Leaflet
- Statistik dan laporan performa
- Manajemen tim teknisi
- Manajemen misi dan tugas khusus
- CRUD data perangkat, user, dan kategori

#### B. Backend (Node.js + Express + TypeScript)
API Server yang menangani:
- RESTful API untuk semua operasi CRUD
- Autentikasi dan otorisasi berbasis session
- Integrasi dengan database MySQL
- Real-time updates via WebSocket (Socket.io)
- Integrasi Telegram Bot API
- Integrasi Zabbix Monitoring API
- Webhook receiver untuk alert otomatis


#### C. Database (MySQL)
Skema database yang terstruktur dengan tabel:
- `users` - Data teknisi dan admin
- `devices` - Inventaris perangkat jaringan
- `device_categories` - Kategori perangkat (Router, Switch, AP, dll)
- `tasks` - Tiket gangguan jaringan internal
- `open_tickets` - Tiket pengaduan dari civitas
- `missions` - Riwayat penyelesaian tugas
- `custom_missions` - Misi khusus tim
- `daily_todos` - Checklist harian teknisi
- `temp_logs` - Log monitoring suhu ruang server

#### D. Integrasi Eksternal
**1. Telegram Bot**
- Notifikasi otomatis ke grup teknisi saat ada gangguan
- Update status tiket real-time
- Interaksi cepat (terima/selesaikan tiket) langsung dari Telegram

**2. Zabbix Monitoring System**
- Sinkronisasi otomatis data host/device setiap 30 detik
- Deteksi gangguan infrastruktur secara proaktif
- Webhook untuk trigger otomatis pembuatan tiket
- Monitoring real-time status UP/DOWN devices

### 2.2 Deployment Architecture
- **Hosting:** Vercel (Serverless Functions untuk production)
- **Database:** MySQL Server (dapat dihost di VPS atau cloud)
- **Frontend:** Static hosting dengan CDN
- **Backend:** Serverless functions dengan fallback ke mode lokal
- **Real-time:** Socket.io untuk update live dashboard


---

## 3. FITUR DAN FUNGSIONALITAS

### 3.1 Sistem Tiket IT Helpdesk

#### A. Portal Pengaduan Publik
Civitas akademika dapat mengakses portal tanpa login untuk:
1. **Submit Tiket Baru**
   - Mengisi identitas (Nama, NIM/NIP, Email, WhatsApp)
   - Memilih kategori layanan:
     - Layanan Webmail
     - Kendala Teknis Hardware
     - Kendala Teknis Software
     - Kendala Jaringan & WiFi
     - Request Perubahan Data Website
     - Request Publikasi Informasi
   - Mendeskripsikan kendala secara detail
   - Upload foto/screenshot bukti kendala
   - Mendapat nomor tiket otomatis (format: TKT-[timestamp])

2. **Cek Status Tiket**
   - Cari berdasarkan nomor tiket atau NIM/NIP
   - Lihat status real-time: Open → In Progress → Resolved/Closed
   - Lihat teknisi yang ditugaskan
   - Lihat catatan solusi/perbaikan

#### B. Manajemen Tiket (Dashboard Admin)
Admin dan Manager dapat:
1. Melihat semua tiket masuk secara real-time
2. Assign tiket ke teknisi yang tersedia
3. Update status tiket (Open, In Progress, Resolved, Closed, Rejected)
4. Menulis catatan resolusi/solusi
5. Mengelola prioritas berdasarkan kategori layanan


### 3.2 Network Management System

#### A. Dashboard Monitoring Real-time
1. **Status Overview**
   - Jumlah device total, UP, dan DOWN
   - Jumlah tiket aktif berdasarkan status
   - Jumlah teknisi available vs busy
   - Monitor suhu ruang server real-time

2. **Daily Task Management**
   - Daftar gangguan jaringan aktif (network incidents)
   - Assign teknisi ke tugas
   - Tracking waktu SLA (Service Level Agreement)
   - Workflow approval Manager untuk tiket Emergency/Alert
   - Checklist langkah-langkah troubleshooting
   - Update status penyelesaian dengan catatan teknis

3. **Visualisasi Network**
   - **Network Topology:** Diagram interaktif hubungan antar device
   - **Network Map:** Peta geografis lokasi device di area kampus
   - **Device List:** Tabel lengkap dengan detail IP, lokasi, status, kategori

#### B. Sistem Prioritas & SLA (Sesuai Dokumen Panduan)

| Prioritas | Waktu Respon | Waktu Resolusi | Contoh Kasus |
|-----------|--------------|----------------|--------------|
| **P1 - Emergency** | 15 Menit | Maks. 2 Jam | Backbone down, SIAKAD tidak dapat diakses |
| **P2 - Alert** | 30 Menit | Maks. 4 Jam | WiFi satu gedung terputus, proyektor rusak saat kuliah |
| **P3 - Warning** | Maks. 2 Jam | Maks. 24 Jam | PC dosen lambat, printer jam, lupa password email |
| **P4 - Request** | Maks. 4 Jam | Maks. 48 Jam | Pembuatan akun baru, update website |


#### C. Approval Workflow Manager
Untuk gangguan kritis (Emergency/Alert), sistem menerapkan approval workflow:
1. Tiket masuk dengan status **"Open"**
2. Manager meninjau dan memutuskan:
   - **Approve:** Tiket dapat dilanjutkan ke teknisi
   - **Reject:** Tiket ditolak dengan alasan (misal: bukan prioritas, duplicate)
3. Setelah approval, teknisi dapat di-assign
4. Device yang direject otomatis kembali ke status "Up"

### 3.3 Manajemen Tim & Sumber Daya

#### A. Manajemen Teknisi
1. **Profil Teknisi**
   - Data lengkap: Nama, Username, Role, Jabatan
   - Status ketersediaan: Available / Busy
   - Jumlah tugas harian aktif (daily_tasks_count)
   - Jumlah total misi selesai (mission_completed)

2. **Sistem Auto-Assignment**
   - Mencari teknisi dengan status "Available"
   - Update otomatis status menjadi "Busy" saat assign
   - Tracking beban kerja untuk load balancing

#### B. Manajemen Misi Khusus
1. **Custom Missions**
   - Membuat tugas proyek khusus (misal: instalasi lab baru)
   - Assign multiple teknisi ke satu misi
   - Set target deadline dan durasi
   - Tracking progress percentage
   - Upload dokumentasi gambar
   - Status: Active, Completed, Cancelled

2. **Mission History**
   - Riwayat semua tugas yang telah diselesaikan
   - Catatan resolusi dan dokumentasi
   - Evaluasi waktu penyelesaian vs SLA


### 3.4 Integrasi Telegram Bot

#### Fitur Telegram Bot:
1. **Notifikasi Otomatis**
   - Alert instant ke grup teknisi saat ada gangguan baru
   - Format pesan: Nomor tiket, nama device, IP address, lokasi, severity
   - Include inline buttons untuk aksi cepat

2. **Interaksi Langsung**
   - Button "✅ Terima Tugas" - Auto assign ke teknisi pertama yang klik
   - Button "✔️ Selesai" - Mark task as completed dari Telegram
   - Update status otomatis sinkron ke dashboard web

3. **Update Real-time**
   - Edit message existing saat status berubah
   - Notifikasi progres (Open → In Progress → Completed)
   - Mencegah spam dengan update inline

**Benefit:**
- Respon lebih cepat dari teknisi (tidak perlu buka web)
- Koordinasi tim lebih efisien via grup Telegram
- Riwayat komunikasi tersimpan di chat

### 3.5 Integrasi Zabbix Monitoring

#### A. Auto-Discovery Devices
- Sinkronisasi otomatis daftar host dari Zabbix setiap 30 detik
- Update status UP/DOWN real-time dari Zabbix
- Ekstraksi informasi: Hostname, IP, Group/Kategori, Status

#### B. Proactive Monitoring
- Deteksi gangguan sebelum user komplain
- Trigger otomatis pembuatan tiket saat device DOWN
- Notifikasi ke Telegram saat terdeteksi anomali

#### C. Test Connection Dashboard
- Endpoint untuk validasi koneksi ke Zabbix API
- Tampilkan status API version dan authentication
- Troubleshooting tool untuk admin


### 3.6 Statistik & Reporting

#### A. Dashboard Statistik
1. **Key Performance Indicators (KPI)**
   - Total tiket per bulan/tahun
   - Rata-rata waktu resolusi per kategori
   - Persentase tiket selesai dalam SLA
   - Tingkat kepuasan civitas (jika survey enabled)

2. **Breakdown by Category**
   - Distribusi tiket per jenis layanan
   - Kategori dengan kendala terbanyak
   - Identifikasi area yang perlu improvement

3. **Technician Performance**
   - Ranking teknisi berdasarkan jumlah misi selesai
   - Load balancing visualization
   - Evaluasi efisiensi penugasan

#### B. Historical Data
- Trend gangguan per periode waktu
- Pattern recurring issues
- Data untuk perencanaan upgrade infrastruktur

---

## 4. TEKNOLOGI YANG DIGUNAKAN

### 4.1 Frontend Stack
- **React 19.2.6** - Library UI modern dengan component-based
- **TypeScript 6.0** - Type-safe development
- **Vite 8.0** - Build tool cepat dengan HMR (Hot Module Replacement)
- **Leaflet** - Library untuk visualisasi peta interaktif
- **Vis-Network** - Library untuk visualisasi network topology
- **Lucide React** - Icon set modern
- **Socket.io Client** - Real-time bidirectional communication

### 4.2 Backend Stack
- **Node.js** - JavaScript runtime untuk server
- **Express 4.19** - Web framework minimalist dan flexible
- **TypeScript 5.4** - Type safety untuk backend code
- **MySQL2** - Database driver untuk MySQL
- **Socket.io 4.7** - WebSocket server untuk real-time updates
- **CORS** - Cross-Origin Resource Sharing middleware
- **Dotenv** - Environment variable management


### 4.3 External Services
- **Telegram Bot API** - Platform messaging untuk notifikasi teknisi
- **Zabbix API** - Enterprise monitoring solution
- **Vercel** - Platform deployment serverless
- **MySQL Database** - Relational database system

### 4.4 Development Tools
- **ts-node-dev** - Development server dengan hot reload
- **ESLint** - Code linting untuk quality assurance
- **Git** - Version control system

---

## 5. KEAMANAN SISTEM

### 5.1 Autentikasi & Otorisasi
1. **Login System**
   - Session-based authentication
   - Password hashing (implementasi best practice)
   - Role-based access control (Admin, Manager, Teknisi)

2. **Protected Endpoints**
   - Middleware `requireAuth` untuk endpoint sensitif
   - Public endpoints hanya untuk submit dan cek status tiket
   - Private endpoints untuk manajemen sistem

### 5.2 Data Protection
1. **Input Validation**
   - Validasi semua input dari user
   - Sanitization untuk mencegah SQL injection
   - File upload validation

2. **CORS Policy**
   - Konfigurasi allowed origins
   - Secure headers untuk API requests

### 5.3 Environment Variables
Sensitive data disimpan di file `.env`:
- Database credentials
- Telegram Bot token
- Zabbix API credentials
- Port dan configuration


---

## 6. MANFAAT IMPLEMENTASI

### 6.1 Untuk Civitas Akademika
1. ✅ **Kemudahan Akses**
   - Portal dapat diakses 24/7 dari mana saja
   - Tidak perlu login untuk submit dan cek status tiket
   - Interface user-friendly dan responsif (mobile-ready)

2. ✅ **Transparansi**
   - Tracking status real-time dengan nomor tiket
   - Tahu siapa teknisi yang menangani
   - Lihat catatan solusi setelah selesai

3. ✅ **Akuntabilitas**
   - Setiap laporan tercatat dengan timestamp
   - SLA yang jelas untuk setiap kategori
   - Bukti dokumentasi penanganan

### 6.2 Untuk Tim IT
1. ✅ **Efisiensi Operasional**
   - Tidak ada tiket terlewat atau terlupa
   - Auto-assignment mengurangi beban koordinasi manual
   - Notifikasi real-time via Telegram

2. ✅ **Prioritisasi yang Jelas**
   - Sistem prioritas 4 level (P1-P4)
   - SLA timer untuk deadline tracking
   - Workflow approval untuk kasus kritis

3. ✅ **Monitoring Proaktif**
   - Integrasi Zabbix untuk deteksi dini gangguan
   - Tiket otomatis saat device DOWN
   - Visual topology dan map untuk troubleshooting

4. ✅ **Manajemen Tim**
   - Load balancing berdasarkan ketersediaan
   - Tracking performa individual
   - Koordinasi misi khusus

### 6.3 Untuk Manajemen
1. ✅ **Data-Driven Decision**
   - Statistik lengkap untuk evaluasi layanan
   - Identifikasi area dengan kendala recurring
   - Data historis untuk perencanaan upgrade

2. ✅ **Kontrol Kualitas**
   - Monitoring SLA compliance
   - Approval workflow untuk kasus kritis
   - Dashboard overview untuk quick insight

3. ✅ **Cost Efficiency**
   - Mengurangi downtime dengan respon cepat
   - Optimasi alokasi sumber daya teknisi
   - Mencegah masalah kecil menjadi besar


---

## 7. STATUS IMPLEMENTASI SAAT INI

### 7.1 Fitur yang Sudah Berjalan
✅ Portal Public IT Helpdesk (Submit & Check Ticket)  
✅ Dashboard Admin dengan Real-time Monitoring  
✅ Sistem Tiket dengan SLA Management  
✅ Network Topology Visualization  
✅ Network Map dengan Leaflet Integration  
✅ Integrasi Telegram Bot untuk Notifikasi  
✅ Integrasi Zabbix untuk Auto-Sync Devices  
✅ Manajemen Tim Teknisi  
✅ Custom Missions Management  
✅ Daily Task & Todo Management  
✅ Mission History & Statistics  
✅ Temperature Monitoring (Ruang Server)  
✅ CRUD Management untuk Devices, Users, Categories  
✅ Login & Authentication System  
✅ Approval Workflow (Manager Approve/Reject)  

### 7.2 Infrastruktur
- ✅ Backend API sudah production-ready (support local & serverless)
- ✅ Frontend sudah responsive dan mobile-friendly
- ✅ Database schema sudah lengkap dan normalized
- ✅ Environment configuration sudah terpisah (development & production)
- ✅ Dokumentasi panduan layanan sudah tersedia

### 7.3 Versi Sistem
- **Backend:** v1.3.0 (NEMESYS Network Management System)
- **Frontend:** Active development dengan Vite + React 19
- **Database:** MySQL dengan multiple tables (users, devices, tasks, tickets, missions)


---

## 8. ROADMAP & PENGEMBANGAN LANJUTAN

### 8.1 Short-term (1-3 Bulan)
1. **Email Notification**
   - Notifikasi email otomatis ke pelapor saat status berubah
   - Email reminder untuk tiket mendekati deadline SLA

2. **WhatsApp Integration**
   - WhatsApp notification via WhatsApp Business API
   - Auto-reply status tiket via WhatsApp bot

3. **Survey Kepuasan**
   - Form feedback setelah tiket selesai
   - Rating teknisi dan kualitas penanganan

4. **Export Reports**
   - Export data tiket ke Excel/PDF
   - Monthly report generation otomatis

### 8.2 Mid-term (3-6 Bulan)
1. **Knowledge Base System**
   - Library solusi common issues
   - Self-service troubleshooting guide
   - Video tutorial untuk user

2. **Advanced Analytics**
   - Predictive analytics untuk forecasting gangguan
   - Machine learning untuk auto-categorization tiket
   - Anomaly detection pattern

3. **Mobile App**
   - Android & iOS app untuk civitas dan teknisi
   - Push notification native
   - Offline mode untuk teknisi lapangan

4. **Asset Management**
   - Inventory lengkap hardware kampus
   - Tracking warranty dan maintenance schedule
   - QR code untuk quick device identification


### 8.3 Long-term (6-12 Bulan)
1. **AI Chatbot Assistant**
   - Chatbot untuk first-level support
   - Auto-response untuk pertanyaan umum
   - Smart routing ke kategori yang tepat

2. **IoT Integration**
   - Sensor monitoring tambahan (AC, humidity, power)
   - Smart building integration
   - Preventive maintenance automation

3. **Multi-Campus Support**
   - Sistem dapat di-scale untuk multiple campus/branch
   - Centralized dashboard untuk management
   - Inter-campus resource sharing

4. **Service Catalog**
   - Layanan IT yang bisa di-request (software, hardware)
   - Approval workflow untuk procurement
   - Budget tracking per unit/fakultas

---

## 9. REKOMENDASI & TINDAK LANJUT

### 9.1 Sosialisasi & Training
1. **Kampanye Awareness**
   - Sosialisasi ke semua fakultas dan unit kerja
   - Poster/flyer di area strategis kampus
   - Email blast dan announcement di portal akademik

2. **Pelatihan Pengguna**
   - Workshop untuk civitas cara menggunakan portal
   - Training khusus untuk admin fakultas/prodi
   - Video tutorial dan quick guide

3. **Training Teknisi**
   - SOP penggunaan sistem untuk teknisi
   - Best practice handling tiket
   - Troubleshooting dashboard dan tools


### 9.2 Monitoring & Evaluasi
1. **Regular Review**
   - Weekly review meeting tim IT untuk evaluasi tiket
   - Monthly report ke pimpinan tentang KPI layanan
   - Quarterly review untuk improvement plan

2. **User Feedback Loop**
   - Survey kepuasan pengguna setiap semester
   - Forum feedback untuk improvement suggestions
   - Bug report channel untuk technical issues

3. **System Health Check**
   - Daily backup database
   - Weekly system performance check
   - Monthly security audit

### 9.3 Sumber Daya & Budget
**Kebutuhan Infrastruktur:**
1. Server/VPS untuk production deployment
   - Estimasi: Rp 500.000 - 1.000.000/bulan (tergantung spesifikasi)
   - Alternatif: Gunakan Vercel free tier + MySQL cloud

2. Domain & SSL Certificate
   - Domain: Rp 150.000/tahun
   - SSL: Free dari Let's Encrypt atau Cloudflare

3. Telegram Bot (Free)
4. Zabbix Server (sudah tersedia/dapat diinstall di server existing)

**Kebutuhan SDM:**
- Maintain existing tim IT (tidak perlu tambahan personel)
- 1 person untuk system maintenance & development
- Administrator untuk monitoring dashboard daily


---

## 10. KESIMPULAN

Sistem IT Helpdesk & Network Management UNTAG Banyuwangi telah berhasil dibangun dengan fitur yang komprehensif dan terintegrasi. Sistem ini dirancang untuk:

1. **Meningkatkan Kualitas Layanan IT**
   - Respon time lebih cepat dengan SLA yang jelas
   - Transparansi penanganan untuk civitas
   - Monitoring proaktif infrastruktur jaringan

2. **Meningkatkan Efisiensi Operasional Tim IT**
   - Otomasi workflow dan assignment
   - Notifikasi real-time via Telegram
   - Dashboard terpusat untuk monitoring

3. **Menyediakan Data untuk Pengambilan Keputusan**
   - Statistik dan analytics lengkap
   - Historical data untuk trend analysis
   - KPI untuk evaluasi performa layanan

4. **Scalable dan Future-Ready**
   - Arsitektur modern dan modular
   - Mudah dikembangkan dengan fitur baru
   - Support serverless deployment

**Status:** Sistem sudah production-ready dan siap untuk go-live. Dokumentasi panduan layanan untuk civitas sudah tersedia di file `PANDUAN_IT_HELPDESK.md`.

### Langkah Selanjutnya:
1. ✅ Approval manajemen untuk deployment production
2. ⏳ Setup infrastruktur hosting (server/domain)
3. ⏳ Migrasi database ke production environment
4. ⏳ Sosialisasi ke seluruh civitas akademika
5. ⏳ Launch official dan monitoring fase awal


---

## LAMPIRAN

### A. Dokumentasi Terkait
1. **PANDUAN_IT_HELPDESK.md** - Panduan lengkap untuk civitas akademika
2. **README.md** - Technical documentation untuk developer
3. **unifi.yml** - Configuration file untuk integrasi UniFi (jika ada)

### B. Screenshot Sistem (Dapat ditambahkan)
*Disarankan menambahkan screenshot untuk:*
- Dashboard overview
- Portal submit tiket publik
- Network topology view
- Network map visualization
- Dashboard manajemen tiket
- Mobile responsive view
- Notifikasi Telegram
- Statistik & reporting page

### C. Informasi Kontak Tim IT
**Biro Teknologi Informasi UNTAG Banyuwangi**
- 📧 Email: ithelpdesk@untag-bwi.ac.id
- 💬 WhatsApp: 085864892610
- 🏢 Lokasi: Gedung Rektorat Lt. 1, UNTAG Banyuwangi
- ⏰ Jam Operasional: 
  - Senin-Jumat: 07:30 - 16:30 WIB
  - Sabtu: 08:00 - 13:00 WIB
  - Minggu & Libur: TUTUP (Monitoring otomatis aktif)

### D. URL Akses Sistem (Akan diisi setelah deployment)
- **Portal Publik:** [URL akan diisi]
- **Dashboard Admin:** [URL akan diisi]
- **API Endpoint:** [URL akan diisi]
- **Telegram Bot:** @[nama_bot]

---

**Dokumen ini disusun sebagai laporan komprehensif sistem IT Helpdesk & Network Management yang telah diimplementasikan di Universitas 17 Agustus 1945 Banyuwangi.**

*Disusun oleh: Tim Biro Teknologi Informasi UNTAG Banyuwangi*  
*Tanggal: Juni 2026*  
*Versi Dokumen: 1.0*

