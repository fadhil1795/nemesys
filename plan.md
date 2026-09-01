## 🗺️ Master Plan Migrasi dari GACS-Dashboard ke `nemesys`

Dokumen ini merangkum master plan pengambilan dan pengembangan fitur dari proyek referensi `GACS-Dashboard` ke proyek `nemesys` secara bertahap dan terstruktur.

### Sumber inspirasi

Semua fitur utama yang akan masuk ke `nemesys` akan diambil dan dikembangkan berdasarkan pola dan fungsi yang sudah ada di `GACS-Dashboard`, bukan hanya dari API. Sumber inspirasi mencakup halaman UI, alur kerja pengguna, integrasi backend, logika bisnis, serta struktur data yang sudah terbukti pada proyek referensi.

### Tujuan migrasi

- Mengembangkan `nemesys` sebagai dashboard monitoring jaringan yang lebih modern.
- Mempertahankan fitur inti yang sudah terbukti dari dashboard lama.
- Membuat arsitektur yang lebih scalable untuk frontend dan backend.

### Prioritas fitur yang harus dipindahkan

#### Phase 1 - MVP
- Autentikasi pengguna (login, logout, session, password change)
- Dashboard overview
  - total devices
  - online/offline devices
  - avg uptime
  - recent device activity
- Device list
  - search
  - filter
  - pagination / chunked loading
- Device detail
  - metadata perangkat
  - status parameter
  - signal dan uplink info
- Remote action device
  - summon device
  - refresh inform
  - reboot perangkat
  - get parameter values
- Konfigurasi sistem
  - ACS config
  - MikroTik config
  - Telegram config
- Network topology map
  - marker perangkat
  - polyline / connection line
  - editable topology
  - save dan update position / waypoint
- Traffic dan uplink monitoring
- Client logs dan view logs
- Telegram notification dan webhook
- Scheduled report
- Bulk operation device

### Roadmap implementasi
- Auth module
- Dashboard stats API
- UI dashboard utama

- Device list
- Device detail
- Filter dan search
- Remote action integration
- Reboot, summon, refresh task
- Topology map dan marker management
- Configuration module
- ACS / MikroTik / Telegram setup
- Logs, reports, notification, webhook

### Rekomendasi struktur pengembangan

- Frontend: `TSX` untuk UI modern seperti di projek `nemesys`
- Backend: API service yang konsisten untuk device, status, dan konfigurasi
- Database: tetap memakai skema yang sudah ada dari proyek lama, dengan pengembangan lanjutan sesuai kebutuhan `nemesys`
- Integrasi: seluruh fitur akan dikembangkan berdasarkan pendekatan yang sudah ada di `GACS-Dashboard`, lalu disesuaikan secara modular agar lebih rapi dan scalable

### Rincian fitur yang bisa dipindahkan ke `nemesys`

#### 1. Fitur inti operasional
- Dashboard summary
  - total perangkat
  - perangkat online/offline
  - rata-rata uptime
  - recent activity
- Device list
  - tabel daftar perangkat
  - status online/offline
  - pencarian
  - filter
  - pagination
- Device detail
  - informasi perangkat
  - parameter device
  - signal strength
  - uplink status
  - status koneksi
- Device action
  - summon device
  - refresh inform
  - reboot
  - get parameter values

#### 2. Fitur konfigurasi sistem
- Konfigurasi GenieACS
  - host
  - port
  - username
  - password
  - test connection
  - save config
- Konfigurasi MikroTik
  - host
  - port API
  - username
  - password
  - test connection
- Konfigurasi Telegram Bot
  - bot token
  - chat ID
  - test connection
  - webhook setup

#### 3. Fitur topologi jaringan
- Network map
  - peta lokasi perangkat
  - marker ONU / device
  - garis koneksi
  - editing topology
  - save dan update posisi
  - point of interest mapping
- ODP / PON mapping
- Pemetaan item dan waypoint

#### 4. Fitur monitoring & statistik
- Uplink signal stats
- Hotspot traffic monitoring
- Device health summary
- Perubahan status perangkat secara real-time

#### 5. Fitur log & notifikasi
- Client log
- View logs
- Notification via Telegram
- Scheduled report
- Webhook integration

#### 6. Fitur administrasi
- User management
- Permission / access control
- Configuration backup / restore

### Rekomendasi fitur masuk MVP

Prioritaskan fitur berikut terlebih dahulu:
1. Login & session auth
2. Dashboard overview
3. Device list
4. Device detail
5. Remote action device
6. Configuration ACS / MikroTik / Telegram
7. Network map

### Hal yang harus dihindari

- Menyalin semua file mentah tanpa seleksi fitur dari `GACS-Dashboard`
- Menggabungkan kode lama dan kode baru dalam satu struktur yang tidak rapi
- Mengabaikan security hardening untuk session, token, dan CSRF
- Menganggap hasil migrasi selesai hanya karena fitur sudah ada, tanpa membangun arsitektur yang konsisten di `nemesys`