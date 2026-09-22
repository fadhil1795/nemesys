import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Map, 
  List, 
  BookOpen, 
  BarChart3, 
  MessageSquare,
  ShieldAlert,
  LogOut,
  Target,
  Sun,
  Moon,
  Ticket,
  Settings,
  Terminal,
  FileSpreadsheet,
  FileText,
  QrCode,
  Boxes,
  Award,
  Globe,
  MapPin,
  User as UserIcon
} from 'lucide-react';
import { io } from 'socket.io-client';
import type { Device, DailyTask, User, Mission, DailyTodo, CustomMission, DeviceCategory } from './types';
import { Dashboard } from './components/Dashboard';
import { DailyTaskComponent } from './components/DailyTask';
import { MissionPage } from './components/MissionPage';
import { Team } from './components/Team';
import { EngOpsManager } from './components/EngOpsManager';
import { ExecutiveReport } from './components/ExecutiveReport';
import { QRCodeManager } from './components/QRCodeManager';
import { InventoryManager } from './components/InventoryManager';
import { NetMap } from './components/NetMap';
import { NetList } from './components/NetList';
import { Documentation } from './components/Documentation';
import { Statistics } from './components/Statistics';
import { TelegramBot } from './components/TelegramBot';
import { Login } from './components/Login';
import { CrudManager } from './components/CrudManager';
import { EditLocation } from './components/EditLocation';
import { PublicHelpdesk } from './components/PublicHelpdesk';
import { ServiceDeskManager } from './components/ServiceDeskManager';
import { GacsDeviceList } from './components/GacsDeviceList';
import { GacsDeviceDetail } from './components/GacsDeviceDetail';
import { GacsPonMap } from './components/GacsPonMap';
import { GacsConfig } from './components/GacsConfig';
import { SystemLogs } from './components/SystemLogs';
import { Activity } from 'lucide-react';
import { NocDashboard } from './components/NocMonitoring/NocDashboard';
import { SlaReportManager } from './components/SlaReportManager';
import { MikrotikDashboard } from './components/MikrotikDashboard';
import { UserProfile } from './components/UserProfile';
import { NotificationCenter } from './components/NotificationCenter';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { MobileBottomBar } from './components/MobileBottomBar';
import { Router as RouterIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { initGlobalErrorLogging } from './utils/clientLogger';
import type { GenieACSDevice } from './types';

const rawBackendUrl = 
  import.meta.env.VITE_BACKEND_URL || 
  (window.location.hostname === 'https://nemesys-iota.vercel.app' ? 'http://localhost:5000' : 'https://nemesys.vercel.app');

export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 3,
  timeout: 5000,
});

socket.on('connect_error', () => {
  // Gracefully stop polling on Vercel serverless environment where socket.io server is disabled
  if (socket.active) {
    socket.disconnect();
  }
});

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: 'Administrator' | 'Manager' | 'Teknisi';
  status?: 'Available' | 'Busy';
  telegram_chat_id?: string | null;
  daily_tasks_count?: number;
  mission_completed?: number;
  mission_incompleted?: number;
  nipp?: string;
  division?: string;
  jabatan?: string;
  phone?: string;
  email?: string;
  location?: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nemesys_token'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(
    JSON.parse(localStorage.getItem('nemesys_user') || 'null')
  );

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nemesys_theme') as 'dark' | 'light') || 'dark';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('nemesys_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('nemesys_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    initGlobalErrorLogging();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('nemesys_theme', theme);
  }, [theme]);

  const [devices, setDevices] = useState<Device[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [dailyTodos, setDailyTodos] = useState<DailyTodo[]>([]);
  const [customMissions, setCustomMissions] = useState<CustomMission[]>([]);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  
  const [currentMenu, setCurrentMenu] = useState<string>('dashboard');
  const [telegramOpen, setTelegramOpen] = useState<boolean>(true);
  const [showPublicHelpdesk, setShowPublicHelpdesk] = useState<boolean>(true);
  const [selectedGacsDevice, setSelectedGacsDevice] = useState<GenieACSDevice | null>(null);

  const [tgMessages, setTgMessages] = useState<Array<{ id: number; text: string; taskId?: number; showButtons?: boolean }>>([
    { id: 1, text: "Selamat datang di Nemesys Telegram Notification Bot.\nKetik /start <username> untuk menghubungkan akun dashboard Anda." },
    { id: 2, text: "✓ Akun terhubung dengan Bot." }
  ]);

  // Auto-sync open tasks to simulated Telegram messages
  useEffect(() => {
    if (!token || tasks.length === 0) return;
    tasks.forEach((task) => {
      if (task.status === 'Open') {
        const hasMsg = tgMessages.some((m) => m.taskId === task.id);
        if (!hasMsg) {
          const alertText = `🚨 GANGGUAN BARU DETEKSI ZABBIX\nPerangkat: ${task.device_name}\nIP: ${task.ip_address}\nLokasi: ${task.location}\nStatus: DOWN\n\nSilakan pilih opsi tindakan:`;
          setTgMessages((prev) => {
            if (prev.some((m) => m.taskId === task.id)) return prev;
            return [
              ...prev,
              { id: Date.now() + task.id, text: alertText, taskId: task.id, showButtons: true }
            ];
          });
        }
      }
    });
  }, [tasks, tgMessages, token]);

  // Fetch all data from backend (with auth header)
  const fetchData = async () => {
    if (!token) return;

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const devRes = await fetch(`${BACKEND_URL}/api/devices`, { headers });
      const devData = await devRes.json();
      if (!devData.error) setDevices(devData);

      const taskRes = await fetch(`${BACKEND_URL}/api/tasks`, { headers });
      const taskData = await taskRes.json();
      if (!taskData.error) setTasks(taskData);

      const userRes = await fetch(`${BACKEND_URL}/api/users`, { headers });
      const userData = await userRes.json();
      if (!userData.error) setUsers(userData);

      const missionRes = await fetch(`${BACKEND_URL}/api/missions`, { headers });
      const missionData = await missionRes.json();
      if (!missionData.error) setMissions(missionData);

      const todoRes = await fetch(`${BACKEND_URL}/api/daily-todos`, { headers });
      const todoData = await todoRes.json();
      if (!todoData.error) setDailyTodos(todoData);

      const customMissionRes = await fetch(`${BACKEND_URL}/api/custom-missions`, { headers });
      const customMissionData = await customMissionRes.json();
      if (!customMissionData.error) setCustomMissions(customMissionData);

      const catRes = await fetch(`${BACKEND_URL}/api/categories`);
      const catData = await catRes.json();
      if (!catData.error) setCategories(catData);
    } catch (err) {
      console.error('Failed to fetch data from backend:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();

      // Listen to real-time broadcasts
      socket.on('data_changed', () => {
        fetchData();
      });
    }

    return () => {
      socket.off('data_changed');
    };
  }, [token]);

  const handleLoginSuccess = (newToken: string, user: AuthUser) => {
    localStorage.setItem('nemesys_token', newToken);
    localStorage.setItem('nemesys_user', JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
    setCurrentMenu('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('nemesys_token');
    localStorage.removeItem('nemesys_user');
    setToken(null);
    setCurrentUser(null);
  };

  // Trigger simulated Zabbix error (POST request to backend webhook)
  const triggerAlert = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/trigger`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        const device = devices.find(d => d.status === 'Up' && d.id !== 1);
        if (device) {
          const alertText = `🚨 GANGGUAN BARU DETEKSI ZABBIX\nPerangkat: ${device.name}\nIP: ${device.ip_address}\nLokasi: ${device.location}\nStatus: DOWN\n\nSilakan pilih opsi tindakan:`;
          setTgMessages((prev) => [
            ...prev,
            { id: Date.now(), text: alertText, taskId: data.taskId, showButtons: true }
          ]);
        }
      } else {
        alert(data.error || 'Gagal men-trigger gangguan.');
      }
    } catch (err) {
      alert('Gagal menghubungi backend API.');
    }
  };

  // Bot action: Accept Task
  const handleAcceptTask = async (taskId: number) => {
    const tech = users.find((u) => u.role === 'Teknisi' && u.status === 'Available') 
      || users.find((u) => u.role === 'Teknisi'); // fallback
    
    if (!tech) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: tech.id })
      });
      if (res.ok) {
        setTgMessages((prev) => [
          ...prev,
          { id: Date.now(), text: `✓ Tugas berhasil diterima oleh ${tech.name} (Busy).` }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bot action: Complete Task
  const handleCompleteTask = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: task.assigned_user_id })
      });
      
      if (res.ok) {
        setTgMessages((prev) => [
          ...prev,
          { id: Date.now(), text: `✓ Tugas [${task.device_name}] selesai dikerjakan.` }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual assign task via Admin dropdown selector
  const handleAssignTask = async (taskId: number, userId: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const user = users.find(u => u.id === userId);
        const task = tasks.find(t => t.id === taskId);
        setTgMessages((prev) => [
          ...prev,
          { 
            id: Date.now(), 
            text: `📢 Tugas [${task?.device_name}] ditugaskan manual ke ${user?.name}.`,
            taskId: taskId,
            showButtons: true
          }
        ]);
      }
    } catch (err) {
      alert('Gagal menugaskan teknisi.');
    }
  };

  const renderActiveView = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <Dashboard devices={devices} tasks={tasks} onTriggerAlert={triggerAlert} onNavigate={setCurrentMenu} token={token || undefined} />;
      case 'tasks':
        return <DailyTaskComponent tasks={tasks} users={users} missions={missions} onAssignTask={handleAssignTask} dailyTodos={dailyTodos} token={token || ''} onRefresh={fetchData} devices={devices} userRole={currentUser?.role || 'Teknisi'} />;
      case 'mission-view':
      case 'mission':
        return <MissionPage customMissions={customMissions} users={users} token={token || ''} onRefresh={fetchData} isAdmin={currentUser?.role === 'Administrator' || currentUser?.role === 'Manager'} currentUser={currentUser as User | null} />;
      case 'team':
        return <Team users={users} token={token || ''} isAdmin={currentUser?.role === 'Administrator'} onRefresh={fetchData} />;
      case 'service-desk':
      case 'civitas-tickets':
      case 'open-tickets':
      case 'open-tickets-dashboard':
        return <ServiceDeskManager token={token || ''} currentUser={currentUser!} users={users} onRefresh={fetchData} />;
      case 'netmap-core':
        return <NetMap devices={devices} isCoreOnly={true} categories={categories} />;
      case 'netmap-global':
        return <NetMap devices={devices} isCoreOnly={false} categories={categories} />;
      case 'netlist':
        return <NetList devices={devices} token={token || ''} onRefresh={fetchData} isAdmin={currentUser?.role === 'Administrator'} categories={categories} />;
      case 'documentation':
        return <Documentation />;
      case 'statistics':
        return <Statistics devices={devices} tasks={tasks} categories={categories} />;
      case 'manage':
        return <CrudManager devices={devices} users={users} token={token || ''} onRefresh={fetchData} />;
      case 'edit-location':
        return <EditLocation devices={devices} token={token || ''} onRefresh={fetchData} categories={categories} />;
      // ---- GACS Routes ----
      case 'gacs-devices':
        if (selectedGacsDevice) {
          return (
            <GacsDeviceDetail
              device={selectedGacsDevice}
              token={token || ''}
              onBack={() => setSelectedGacsDevice(null)}
            />
          );
        }
        return (
          <GacsDeviceList
            token={token || ''}
            onSelectDevice={(dev) => setSelectedGacsDevice(dev)}
          />
        );
      case 'gacs-pon-map':
        return <GacsPonMap token={token || ''} />;
      case 'gacs-config':
        return <GacsConfig token={token || ''} />;
      case 'system-logs':
        return <SystemLogs token={token || ''} />;
      case 'eng-ops':
        return <EngOpsManager currentUserRole={currentUser?.role} currentUserName={currentUser?.name} />;
      case 'inventory':
        return <InventoryManager token={token || ''} currentUserRole={currentUser?.role} currentUserName={currentUser?.name} />;
      case 'executive-report':
        return <ExecutiveReport />;
      case 'qr-manager':
        return <QRCodeManager devices={devices} />;
      case 'noc-monitoring':
        return <NocDashboard token={token || ''} currentUserRole={currentUser?.role} currentUserName={currentUser?.name} />;
      case 'mikrotik-noc':
        return <MikrotikDashboard token={token || ''} />;
      case 'sla-report':
        return <SlaReportManager token={token || ''} currentUserRole={currentUser?.role} currentUserName={currentUser?.name} />;
      case 'profile':
        return (
          <UserProfile
            token={token || ''}
            currentUser={currentUser!}
            onUserUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
              localStorage.setItem('nemesys_user', JSON.stringify(updatedUser));
            }}
          />
        );
      default:
        return <Dashboard devices={devices} tasks={tasks} onTriggerAlert={triggerAlert} onNavigate={setCurrentMenu} token={token || undefined} />;
    }
  };

  if (!token || !currentUser) {
    if (showPublicHelpdesk) {
      return <PublicHelpdesk onBackToLogin={() => setShowPublicHelpdesk(false)} />;
    }
    return <Login onLoginSuccess={handleLoginSuccess} onOpenPublicHelpdesk={() => setShowPublicHelpdesk(true)} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      {/* Desktop Sidebar (Collapsible Mode) */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <ShieldAlert size={20} />
          </div>
          <div className="brand-text-container">
            <span className="brand-logo">NEMESYS</span>
            <span className="brand-subtext">IT Helpdesk &amp; NOC</span>
          </div>
          <span className="brand-version">v1.3</span>

          <button
            onClick={toggleSidebar}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-auto transition-colors"
            title={sidebarCollapsed ? 'Kembangkan Sidebar' : 'Ciutkan Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-menu">
          {/* 1. Core / Utama */}
          <span className="menu-section-title">Utama</span>
          <a className={`menu-item ${currentMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentMenu('dashboard')} title="Dashboard">
            <LayoutDashboard size={17} /> <span className="menu-item-text">Dashboard</span>
          </a>
          <a className={`menu-item ${currentMenu === 'tasks' ? 'active' : ''}`} onClick={() => setCurrentMenu('tasks')} title="Daily Task">
            <ClipboardList size={17} /> <span className="menu-item-text">Daily Task</span>
          </a>
          <a className={`menu-item ${currentMenu === 'mission-view' ? 'active' : ''}`} onClick={() => setCurrentMenu('mission-view')} title="Mission">
            <Target size={17} /> <span className="menu-item-text">Mission</span>
          </a>
          <a className={`menu-item ${currentMenu === 'team' ? 'active' : ''}`} onClick={() => setCurrentMenu('team')} title="Team">
            <Users size={17} /> <span className="menu-item-text">Team</span>
          </a>

          {/* 2. Monitoring & NOC */}
          <span className="menu-section-title">Monitoring &amp; NOC</span>
          <a className={`menu-item ${currentMenu === 'noc-monitoring' ? 'active' : ''}`} onClick={() => setCurrentMenu('noc-monitoring')} title="NOC Monitoring">
            <Activity size={17} /> <span className="menu-item-text">NOC Monitoring</span>
            <span className="menu-item-badge badge-cyan">ZABBIX</span>
          </a>
          <a className={`menu-item ${currentMenu === 'mikrotik-noc' ? 'active' : ''}`} onClick={() => setCurrentMenu('mikrotik-noc')} title="MikroTik RouterOS">
            <RouterIcon size={17} /> <span className="menu-item-text">MikroTik RouterOS</span>
            <span className="menu-item-badge badge-sky">ROUTEROS</span>
          </a>
          <a className={`menu-item ${currentMenu === 'sla-report' ? 'active' : ''}`} onClick={() => setCurrentMenu('sla-report')} title="Laporan SLA & Uptime">
            <Award size={17} /> <span className="menu-item-text">Laporan SLA</span>
            <span className="menu-item-badge badge-amber">OFFICIAL</span>
          </a>
          <a className={`menu-item ${currentMenu === 'netmap-core' ? 'active' : ''}`} onClick={() => setCurrentMenu('netmap-core')} title="NetMap Core">
            <Map size={17} /> <span className="menu-item-text">NetMap Core</span>
          </a>
          <a className={`menu-item ${currentMenu === 'netmap-global' ? 'active' : ''}`} onClick={() => setCurrentMenu('netmap-global')} title="NetMap Global">
            <Globe size={17} /> <span className="menu-item-text">NetMap Global</span>
          </a>
          <a className={`menu-item ${currentMenu === 'netlist' ? 'active' : ''}`} onClick={() => setCurrentMenu('netlist')} title="NetList Perangkat">
            <List size={17} /> <span className="menu-item-text">NetList Perangkat</span>
          </a>

          {/* 3. Layanan & Aset */}
          <span className="menu-section-title">Layanan &amp; Aset</span>
          <a className={`menu-item ${currentMenu === 'service-desk' ? 'active' : ''}`} onClick={() => setCurrentMenu('service-desk')} title="Service Desk">
            <Ticket size={17} /> <span className="menu-item-text">Service Desk</span>
            <span className="menu-item-badge badge-indigo">CIVITAS</span>
          </a>
          <a className={`menu-item ${currentMenu === 'inventory' ? 'active' : ''}`} onClick={() => setCurrentMenu('inventory')} title="Inventaris IT">
            <Boxes size={17} /> <span className="menu-item-text">Inventaris IT</span>
          </a>
          <a className={`menu-item ${currentMenu === 'eng-ops' ? 'active' : ''}`} onClick={() => setCurrentMenu('eng-ops')} title="NEO Suite">
            <FileSpreadsheet size={17} /> <span className="menu-item-text">NEO Suite</span>
          </a>
          <a className={`menu-item ${currentMenu === 'executive-report' ? 'active' : ''}`} onClick={() => setCurrentMenu('executive-report')} title="Laporan Eksekutif">
            <FileText size={17} /> <span className="menu-item-text">Laporan Eksekutif</span>
          </a>
          <a className={`menu-item ${currentMenu === 'qr-manager' ? 'active' : ''}`} onClick={() => setCurrentMenu('qr-manager')} title="QR Scanner">
            <QrCode size={17} /> <span className="menu-item-text">QR Scanner</span>
          </a>

          {/* 4. Admin Panel */}
          {currentUser.role === 'Administrator' && (
            <>
              <span className="menu-section-title">Admin Panel</span>
              <a className={`menu-item ${currentMenu === 'manage' ? 'active' : ''}`} onClick={() => setCurrentMenu('manage')} title="Manage System">
                <ShieldAlert size={17} /> <span className="menu-item-text">Manage System</span>
              </a>
              <a className={`menu-item ${currentMenu === 'edit-location' ? 'active' : ''}`} onClick={() => setCurrentMenu('edit-location')} title="Edit Location">
                <MapPin size={17} /> <span className="menu-item-text">Edit Location</span>
              </a>
              <a className={`menu-item ${currentMenu === 'system-logs' ? 'active' : ''}`} onClick={() => setCurrentMenu('system-logs')} title="System Logs">
                <Terminal size={17} /> <span className="menu-item-text">System Logs</span>
              </a>
            </>
          )}

          {/* 5. Sistem & Dokumen */}
          <span className="menu-section-title">Sistem &amp; Dokumen</span>
          <a className={`menu-item ${currentMenu === 'profile' ? 'active' : ''}`} onClick={() => setCurrentMenu('profile')} title="Pengaturan Profil">
            <UserIcon size={17} /> <span className="menu-item-text">Pengaturan Profil</span>
          </a>
          <a className={`menu-item ${currentMenu === 'gacs-config' ? 'active' : ''}`} onClick={() => setCurrentMenu('gacs-config')} title="Konfigurasi Sistem">
            <Settings size={17} /> <span className="menu-item-text">Konfigurasi Sistem</span>
          </a>
          <a className={`menu-item ${currentMenu === 'documentation' ? 'active' : ''}`} onClick={() => setCurrentMenu('documentation')} title="Documentation">
            <BookOpen size={17} /> <span className="menu-item-text">Documentation</span>
          </a>
          <a className={`menu-item ${currentMenu === 'statistics' ? 'active' : ''}`} onClick={() => setCurrentMenu('statistics')} title="Statistic">
            <BarChart3 size={17} /> <span className="menu-item-text">Statistic</span>
          </a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="main-header">
          <h2 className="header-title" style={{ textTransform: 'capitalize' }}>
            {currentMenu.replace('-', ' ')}
          </h2>
          <div className="header-actions">
            {/* PWA Install Button Prompt */}
            <PwaInstallPrompt />

            {/* System In-App Notification Center */}
            <NotificationCenter token={token} onNavigate={setCurrentMenu} socket={socket} />

            {/* Connection state (Desktop only) */}
            <div className="user-badge hidden md:flex" style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '3px 9px' }}>
              <span className="badge-dot active" />
              <span>WS Connected</span>
            </div>
            
            {/* Telegram Bot Toggle */}
            <button 
              className="btn-primary" 
              onClick={() => setTelegramOpen(!telegramOpen)}
              style={{
                padding: '4px 9px',
                fontSize: '11.5px',
                background: telegramOpen ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'var(--bg-secondary)',
                border: telegramOpen ? 'none' : '1px solid var(--border-color)',
                color: telegramOpen ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Bot Telegram Alert"
            >
              <MessageSquare size={13} />
              <span className="hidden sm:inline">Bot Telegram: {telegramOpen ? 'Open' : 'Closed'}</span>
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-primary"
              style={{
                padding: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                width: '30px',
                height: '30px'
              }}
              title={theme === 'dark' ? 'Ganti ke Tampilan Light' : 'Ganti ke Tampilan Dark'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} style={{ color: '#6366f1' }} />}
            </button>

            {/* Profile */}
            <div 
              className="user-badge" 
              onClick={() => setCurrentMenu('profile')} 
              style={{ fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '12px' }}
              title="Klik untuk Pengaturan Profil"
            >
              <UserIcon size={12} style={{ color: '#38bdf8' }} />
              {currentUser.name} ({currentUser.role})
            </div>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </header>

        <div className="content-body">
          {renderActiveView()}
        </div>

        {/* Telegram Chat Simulation */}
        <TelegramBot
          tasks={tasks}
          messages={tgMessages}
          isOpen={telegramOpen}
          setIsOpen={setTelegramOpen}
          onAcceptTask={handleAcceptTask}
          onCompleteTask={handleCompleteTask}
        />
      </main>

      {/* Mobile Bottom Navigation Bar (Mobile / Smartphone Screens) */}
      <MobileBottomBar
        currentMenu={currentMenu}
        onNavigate={setCurrentMenu}
        currentUser={currentUser}
      />
    </div>
  );
}
