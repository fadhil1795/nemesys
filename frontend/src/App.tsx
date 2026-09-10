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
  Award
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
import { Router as RouterIcon } from 'lucide-react';
import { initGlobalErrorLogging } from './utils/clientLogger';
import type { GenieACSDevice } from './types';

export const BACKEND_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://nemesys.vercel.app');
const socket = io(BACKEND_URL);

interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: 'Administrator' | 'Manager' | 'Teknisi';
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nemesys_token'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(
    JSON.parse(localStorage.getItem('nemesys_user') || 'null')
  );

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nemesys_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    initGlobalErrorLogging();
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
        return <MissionPage customMissions={customMissions} users={users} token={token || ''} onRefresh={fetchData} isAdmin={currentUser?.role === 'Administrator'} />;
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
        return <MikrotikDashboard />;
      case 'sla-report':
        return <SlaReportManager token={token || ''} currentUserRole={currentUser?.role} currentUserName={currentUser?.name} />;
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
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-logo">NEMESYS</span>
          <span className="brand-version">v1.3</span>
        </div>
        <nav className="sidebar-menu">
          <span className="menu-section-title">Core Task</span>
          <a className={`menu-item ${currentMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentMenu('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <a className={`menu-item ${currentMenu === 'inventory' ? 'active' : ''}`} onClick={() => setCurrentMenu('inventory')}>
            <Boxes size={18} /> Inventaris IT
          </a>
          <a className={`menu-item ${currentMenu === 'tasks' ? 'active' : ''}`} onClick={() => setCurrentMenu('tasks')}>
            <ClipboardList size={18} /> Daily Task
          </a>
          <a className={`menu-item ${currentMenu === 'eng-ops' ? 'active' : ''}`} onClick={() => setCurrentMenu('eng-ops')}>
            <FileSpreadsheet size={18} /> NEO Suite (Excel)
          </a>
          <a className={`menu-item ${currentMenu === 'executive-report' ? 'active' : ''}`} onClick={() => setCurrentMenu('executive-report')}>
            <FileText size={18} /> Laporan Eksekutif
          </a>
          <a className={`menu-item ${currentMenu === 'qr-manager' ? 'active' : ''}`} onClick={() => setCurrentMenu('qr-manager')}>
            <QrCode size={18} /> QR Asset Scanner
          </a>
          <a className={`menu-item ${currentMenu === 'mission-view' ? 'active' : ''}`} onClick={() => setCurrentMenu('mission-view')}>
            <Target size={18} /> Mission
          </a>
          <a className={`menu-item ${currentMenu === 'team' ? 'active' : ''}`} onClick={() => setCurrentMenu('team')}>
            <Users size={18} /> Team
          </a>

          <span className="menu-section-title">Monitoring</span>
          <a
            className={`menu-item noc-menu-highlight ${currentMenu === 'noc-monitoring' ? 'active' : ''}`}
            onClick={() => setCurrentMenu('noc-monitoring')}
            style={{
              background: currentMenu === 'noc-monitoring' 
                ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(16,185,129,0.25))' 
                : 'rgba(6,182,212,0.06)',
              border: currentMenu === 'noc-monitoring' 
                ? '1px solid rgba(6,182,212,0.5)' 
                : '1px solid rgba(6,182,212,0.15)',
              margin: '4px 8px',
              borderRadius: '8px'
            }}
          >
            <Activity size={18} className="text-cyan-400" />
            <span style={{ fontWeight: 700, color: currentMenu === 'noc-monitoring' ? '#38bdf8' : '#e2e8f0' }}>NOC Monitoring</span>
            <span style={{ fontSize: '10px', background: 'rgba(6,182,212,0.3)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 600 }}>ZABBIX</span>
          </a>
          <a
            className={`menu-item ${currentMenu === 'mikrotik-noc' ? 'active' : ''}`}
            onClick={() => setCurrentMenu('mikrotik-noc')}
            style={{
              background: currentMenu === 'mikrotik-noc'
                ? 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(16,185,129,0.25))'
                : 'rgba(56,189,248,0.06)',
              border: currentMenu === 'mikrotik-noc'
                ? '1px solid rgba(56,189,248,0.5)'
                : '1px solid rgba(56,189,248,0.15)',
              margin: '4px 8px',
              borderRadius: '8px'
            }}
          >
            <RouterIcon size={18} className="text-cyan-400" />
            <span style={{ fontWeight: 700, color: currentMenu === 'mikrotik-noc' ? '#38bdf8' : '#e2e8f0' }}>MikroTik RouterOS</span>
            <span style={{ fontSize: '10px', background: 'rgba(56,189,248,0.3)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 600 }}>ROUTEROS</span>
          </a>
          <a
            className={`menu-item ${currentMenu === 'sla-report' ? 'active' : ''}`}
            onClick={() => setCurrentMenu('sla-report')}
            style={{
              background: currentMenu === 'sla-report'
                ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(6,182,212,0.25))'
                : 'rgba(245,158,11,0.04)',
              border: currentMenu === 'sla-report'
                ? '1px solid rgba(245,158,11,0.5)'
                : '1px solid rgba(245,158,11,0.15)',
              margin: '4px 8px',
              borderRadius: '8px'
            }}
          >
            <Award size={18} className="text-amber-400" />
            <span style={{ fontWeight: 600, color: currentMenu === 'sla-report' ? '#fbbf24' : '#e2e8f0' }}>Laporan SLA &amp; Uptime</span>
            <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.3)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 600 }}>OFFICIAL</span>
          </a>
          <a className={`menu-item ${currentMenu === 'netmap-core' ? 'active' : ''}`} onClick={() => setCurrentMenu('netmap-core')}>
            <Map size={18} /> NetMap Core
          </a>
          <a className={`menu-item ${currentMenu === 'netmap-global' ? 'active' : ''}`} onClick={() => setCurrentMenu('netmap-global')}>
            <Map size={18} /> NetMap Global
          </a>
          <a className={`menu-item ${currentMenu === 'netlist' ? 'active' : ''}`} onClick={() => setCurrentMenu('netlist')}>
            <List size={18} /> NetList
          </a>

          <span className="menu-section-title">Supporting</span>
          <a
            className={`menu-item ${currentMenu === 'service-desk' ? 'active' : ''}`}
            onClick={() => setCurrentMenu('service-desk')}
            style={{
              background: currentMenu === 'service-desk'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.25))'
                : 'rgba(99,102,241,0.06)',
              border: currentMenu === 'service-desk'
                ? '1px solid rgba(99,102,241,0.5)'
                : '1px solid rgba(99,102,241,0.15)',
              margin: '4px 8px',
              borderRadius: '8px'
            }}
          >
            <Ticket size={18} className="text-indigo-400" />
            <span style={{ fontWeight: 600, color: currentMenu === 'service-desk' ? '#a5b4fc' : '#e2e8f0' }}>Service Desk &amp; SLA</span>
            <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 600 }}>SLA MATRIX</span>
          </a>
          <a className={`menu-item ${currentMenu === 'documentation' ? 'active' : ''}`} onClick={() => setCurrentMenu('documentation')}>
            <BookOpen size={18} /> Documentation
          </a>
          <a className={`menu-item ${currentMenu === 'statistics' ? 'active' : ''}`} onClick={() => setCurrentMenu('statistics')}>
            <BarChart3 size={18} /> Statistic
          </a>

          {currentUser.role === 'Administrator' && (
            <>
              <span className="menu-section-title">Admin Panel</span>
              <a className={`menu-item ${currentMenu === 'manage' ? 'active' : ''}`} onClick={() => setCurrentMenu('manage')}>
                <ShieldAlert size={18} /> Manage System
              </a>
              <a className={`menu-item ${currentMenu === 'edit-location' ? 'active' : ''}`} onClick={() => setCurrentMenu('edit-location')}>
                <Map size={18} /> Edit Location
              </a>
              <a className={`menu-item ${currentMenu === 'system-logs' ? 'active' : ''}`} onClick={() => setCurrentMenu('system-logs')}>
                <Terminal size={18} /> System Logs
              </a>
            </>
          )}

          <span className="menu-section-title">Konfigurasi</span>
          <a className={`menu-item ${currentMenu === 'gacs-config' ? 'active' : ''}`} onClick={() => setCurrentMenu('gacs-config')}>
            <Settings size={18} /> Konfigurasi Sistem
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
            {/* Connection state */}
            <div className="user-badge" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <span className="badge-dot active" />
              WebSocket Connected
            </div>
            
            {/* Telegram Bot Toggle */}
            <button 
              className="btn-primary" 
              onClick={() => setTelegramOpen(!telegramOpen)}
              style={{
                padding: '6px 12px',
                fontSize: '12.5px',
                background: telegramOpen ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'var(--bg-secondary)',
                border: telegramOpen ? 'none' : '1px solid var(--border-color)',
                color: telegramOpen ? '#fff' : 'var(--text-secondary)'
              }}
            >
              <MessageSquare size={14} />
              Bot Telegram: {telegramOpen ? 'Open' : 'Closed'}
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-primary"
              style={{
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                width: '34px',
                height: '34px'
              }}
              title={theme === 'dark' ? 'Ganti ke Tampilan Light' : 'Ganti ke Tampilan Dark'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} style={{ color: '#6366f1' }} />}
            </button>

            {/* Profile */}
            <div className="user-badge" style={{ fontWeight: 600 }}>
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
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <LogOut size={16} />
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
    </div>
  );
}
