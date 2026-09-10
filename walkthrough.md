# Walkthrough - Dedicated NOC Network Monitoring Command Center

Modul baru **NOC Network Monitoring Command Center** telah berhasil dibangun dan diintegrasikan ke dalam sistem. Modul ini berdiri sendiri (*standalone*) dan berfokus murni pada monitoring jaringan skala enterprise berbasis **TypeScript** dan **Zabbix API (JSON-RPC 2.0)**.

---

## 📸 Ringkasan Visual & Modul yang Dibangun

### 1. Header NOC Command Bar
- **Global Network Health**: Indikator persentase uptime jaringan live (misal `99.8%`).
- **Zabbix Telemetry State**: Indikator koneksi live Zabbix JSON-RPC.
- **Real-Time Clock**: Jam lokal sinkron presisi detik.
- **Audio Buzzer Synthesizer**: Tombol on/off suara alarm sirine untuk deteksi insiden *Disaster/High* yang belum di-Ack.
- **Auto-Refresh Selector**: Opsi refresh otomatis (5s, 10s, 30s, Pause) dan tombol *Manual Refresh*.

### 2. Tab: Overview & Topology
- **Top 4 KPI Cards**:
  - 📟 **Mikrotik Routers**: Total node, Healthy, Warning (CPU/RAM/Temp), Down.
  - ⚡ **OLT GPON / EPON**: Total OLT, status PON port, total ONU aktif terdaftar.
  - 📶 **Access Points**: Total AP, status online/offline, total connected Wi-Fi clients.
  - 📡 **Modems / ONTs**: Total modem pelanggan, normal, warning (*redaman buruk < -27 dBm*), LOS (*fiber cut*).
- **Interactive Network Topology Graph**:
  - Diagram visual 4 tingkatan: `Internet Transit Gateway ➔ Mikrotik Core / Distribusi ➔ OLT GPON & Access Points ➔ Modem/ONT`.
  - Garis link dinamis berwarna hijau (*normal*), kuning (*high traffic / warning*), dan merah berkedip (*down / link loss*).
  - Hover / Click Tooltip: Menampilkan IP, Throughput Uplink, RX Optical dBm, Client count, dan CPU load.
- **Live Alarm Incident Ticker**: Feed daftar gangguan aktif Zabbix di sisi kanan.

### 3. Tab: Bandwidth Analytics
- **Dual Speedometer Gauges**:
  - Inbound Traffic (Download) & Outbound Traffic (Upload) dalam Gbps/Mbps.
  - Circular progress ring persentase utilisasi kapasitas pipa ISP (misal `71% Capacity`).
  - Peak 24h & Allocated Pipe metrics.
- **Interactive Time-Series Bandwidth Chart**:
  - Area chart (Chart.js) dengan dual neon gradient (*Cyan untuk Inbound, Emerald untuk Outbound*).
  - Filter rentang waktu: `LIVE`, `1H`, `24H`, dan `7D`.
- **Top 5 Busiest Interfaces**:
  - Ranking link Mikrotik, port PON OLT, dan AP terpadat dengan progress bar utilisasi kapasitas.
- **95th Percentile Meter**:
  - Perhitungan standar SLA ISP untuk analisis kapasitas riil.

### 4. Tab: Problem & Alarm Console
- **Glowing Severity Counters**: *Disaster* (Merah), *High* (Oranye), *Warning* (Kuning), *Info* (Biru).
- **Interactive Incident Table**:
  - Timestamp, durasi down, severity badge, device type, deskripsi alarm dari Zabbix, IP host, dan status Acknowledge.
- **2-Way Acknowledge Modal**:
  - Teknisi dapat mengklik **[Ack]**, menginput nama teknisi dan catatan investigasi, lalu mengirimkannya langsung ke Zabbix API (`event.acknowledge`).
- **Convert to Ticket Action**:
  - Tombol **[Create Ticket]** untuk mengubah alarm Zabbix menjadi tiket penanganan gangguan.
- **Filter Bar**:
  - Filter berdasarkan Severity, Kategori Perangkat (Mikrotik/OLT/AP/ONT), Status Ack, dan Pencarian keyword.

### 5. Tab: Device Matrix & Granular Inspector Modal
- Tabel terfilter seluruh aset jaringan dengan status live, IP, lokasi fisik, Ping latency (ms), CPU %, RX Optical Power (dBm), dan client count.
- **Granular Device Detail Modal (Klik pada perangkat manapun di Topology / Matrix)**:
  - **Router Mikrotik**: Model hardware, RouterOS version, CPU Cores distribution (Core 1-4), Memory RAM gauge, **DHCP Leases Table** (Active leases, Bound client IP/MAC/Hostname), **Firewall & NAT** (Active connections, Dropped attacks count, Top NAT rules), dan Real-time per-port traffic (SFP+/Ether/VLAN).
  - **OLT GPON / EPON**: Model hardware, Board temperature, **PON Ports Matrix (PON 1-8)** dengan status Online/Offline ONUs & Optical Tx Power, dan **Registered ONUs Table** (Optical Rx dBm, Distance, Serial Number).
  - **Access Points (AP)**: Model, MAC, PoE voltage, **Dual-Band Wi-Fi Radios (2.4 GHz & 5 GHz)** dengan Channel width & Tx power, **SSID Performance**, dan **Connected Client Devices List** (Galaxy S24, MacBook Pro, ThinkPad, iPhone dengan RSSI dBm & PHY Rate).
  - **Modems / ONTs Pelanggan**: Data langganan (50 Mbps Dedicated), **Optical Signal Quality Gauge** (Rx -18.2 dBm Normal vs Warning vs LOS), **WAN PPPoE Status**, dan Status Port LAN 1-4 Gigabit + Wi-Fi clients.

---

## 🗂️ File dan Komponen yang Dibuat

### Backend (`backend/src/`)
- [nocZabbixService.ts](file:///d:/aplikasi/nmsystem/backend/src/services/nocZabbixService.ts): Service JSON-RPC Zabbix, kalkulator bandwidth, normalisasi multi-device, dan smart telemetri simulator.
- [nocMonitoring.ts](file:///d:/aplikasi/nmsystem/backend/src/routes/nocMonitoring.ts): Router endpoint `/api/monitoring/*` (`summary`, `devices`, `bandwidth`, `problems`, `ack`, `test-connection`).
- [index.ts](file:///d:/aplikasi/nmsystem/backend/src/index.ts): Registrasi router monitoring.

### Frontend (`frontend/src/`)
- [noc.ts](file:///d:/aplikasi/nmsystem/frontend/src/types/noc.ts): Kontrak tipe data TypeScript untuk NOC.
- [NocDashboard.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocDashboard.tsx): Master container NOC dashboard, header, live clock, audio synthesizer, dan tab routing.
- [NocOverview.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocOverview.tsx): KPI cards, mini bandwidth, topology embed, dan alarm ticker.
- [NocTopology.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocTopology.tsx): Interactive SVG network topology visualizer.
- [NocBandwidth.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocBandwidth.tsx): Real-time traffic gauges, Chart.js time-series, dan Top 5 busiest interfaces.
- [NocProblems.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocProblems.tsx): Zabbix problem console, severity filters, audio alarm, dan acknowledge modal.
- [NocDeviceMatrix.tsx](file:///d:/aplikasi/nmsystem/frontend/src/components/NocMonitoring/NocDeviceMatrix.tsx): Multi-device inventory matrix dengan telemetri.
- [App.tsx](file:///d:/aplikasi/nmsystem/frontend/src/App.tsx): Menu item baru `"NOC Monitoring"` pada sidebar.
- [index.css](file:///d:/aplikasi/nmsystem/frontend/src/index.css): Styling glassmorphism dark theme, neon glows, dan layout NOC.

---

## 🚀 Cara Akses & Uji Coba

1. Buka aplikasi di browser (contoh: `http://localhost:5173` atau URL dashboard yang sedang berjalan).
2. Di sidebar menu kiri, klik menu baru **"NOC Monitoring"** dengan badge `ZABBIX`.
3. Anda dapat menavigasi ke:
   - **Overview & Topology**: Melihat ringkasan KPI dan diagram jaringan interaktif.
   - **Bandwidth Analytics**: Melihat speedometer live traffic, grafik time-series, dan ranking port terpadat.
   - **Problem & Alarm Console**: Melihat alarm Zabbix, mencoba tombol **Ack**, dan mengatur audio buzzer sirine.
   - **Device Matrix**: Memfilter perangkat berdasarkan Mikrotik, OLT GPON, Access Points, atau Modem/ONT.
