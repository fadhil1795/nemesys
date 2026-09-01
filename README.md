# NEMESYS - Network Management & IT Helpdesk System

NEMESYS is an integrated Network Management System (NMS) and IT Helpdesk application designed for real-time network device monitoring, topology visualization, ticketing, and automated notifications.

## 🚀 Features

- **Dashboard & Statistics**: Real-time overview of devices, active alerts, ticketing status, and network topology health.
- **Device Management**: Monitor Routers, Switches, Access Points, Servers, and OLTs (MikroTik, UniFi, Zabbix integration).
- **Interactive Network Topology**: Visual network map and topology powered by Vis Network and Leaflet GIS mapping.
- **IT Helpdesk & Ticketing**: Complete ticketing lifecycle management (Open, In Progress, Resolved, Closed).
- **Automated Alerts & Telegram Bot**: Instant notifications for device outages, threshold alerts, and status changes via Telegram.
- **Traffic & Bandwidth Monitoring**: Real-time traffic graphs and performance metrics using Chart.js.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **UI & Icons**: Lucide React, Custom Responsive CSS
- **Charts & Maps**: Chart.js, React-Chartjs-2, Leaflet, React-Leaflet, Vis-Network
- **Real-time**: Socket.io Client

### Backend
- **Runtime**: Node.js + Express + TypeScript
- **Database**: MySQL / MariaDB (via mysql2)
- **Integrations**: MikroTik API (`node-routeros`), Zabbix JSON-RPC API, Telegram Bot API (`node-telegram-bot-api`)
- **Real-time & Cron**: Socket.io, Node-Cron

---

## 📦 Installation & Setup

### 1. Prerequisites
- Node.js (v18 or higher)
- MySQL / MariaDB Server

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env to match your database, Telegram, and Zabbix credentials
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
