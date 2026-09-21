import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Ticket, 
  Globe, 
  Menu, 
  X, 
  ClipboardList, 
  Target, 
  Users, 
  Router, 
  Award, 
  List, 
  Boxes, 
  FileSpreadsheet, 
  FileText, 
  QrCode, 
  ShieldAlert, 
  Terminal, 
  User as UserIcon, 
  Settings
} from 'lucide-react';
import type { AuthUser } from '../App';

interface MobileBottomBarProps {
  currentMenu: string;
  onNavigate: (menu: string) => void;
  currentUser: AuthUser | null;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  currentMenu,
  onNavigate,
  currentUser
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'noc-monitoring', label: 'NOC Live', icon: Activity },
    { id: 'service-desk', label: 'Tiket', icon: Ticket },
    { id: 'netmap-core', label: 'Peta Map', icon: Globe },
  ];

  const handleNavClick = (menuId: string) => {
    onNavigate(menuId);
    setDrawerOpen(false);
  };

  const getItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: isActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.8)',
    border: isActive ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
    color: isActive ? '#38bdf8' : '#f8fafc',
    fontSize: '12px',
    fontWeight: isActive ? 700 : 500,
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: 'none',
    boxSizing: 'border-box'
  });

  return (
    <>
      {/* Mobile Bottom Bar Container */}
      <nav 
        className="mobile-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.6)',
          zIndex: 99999,
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px'
        }}
      >
        {mainTabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = currentMenu === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNavClick(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                color: isActive ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <IconComponent size={20} color={isActive ? '#38bdf8' : '#94a3b8'} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500, marginTop: '2px', color: isActive ? '#38bdf8' : '#94a3b8', lineHeight: 1.2 }}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Menu Drawer Trigger Tab */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            color: drawerOpen ? '#38bdf8' : '#94a3b8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          {drawerOpen ? <X size={20} color="#38bdf8" /> : <Menu size={20} color="#94a3b8" />}
          <span style={{ fontSize: '10px', fontWeight: drawerOpen ? 700 : 500, marginTop: '2px', color: drawerOpen ? '#38bdf8' : '#94a3b8', lineHeight: 1.2 }}>
            Menu ☰
          </span>
        </button>
      </nav>

      {/* Full Menu Drawer Sheet (Mobile Slide-up Modal) */}
      {drawerOpen && (
        <div 
          className="mobile-bottom-drawer"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            backgroundColor: 'rgba(11, 15, 25, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            paddingBottom: '60px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '75vh',
              backgroundColor: '#0f172a',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '20px',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', borderRadius: '12px', color: '#fff', display: 'flex' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>NEMESYS Command Center</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Navigasi Selengkapnya</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu List Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Group 1: Utama */}
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
                  Utama
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleNavClick('dashboard')} style={getItemStyle(currentMenu === 'dashboard')}>
                    <LayoutDashboard size={16} color="#38bdf8" />
                    <span>Dashboard</span>
                  </button>

                  <button onClick={() => handleNavClick('tasks')} style={getItemStyle(currentMenu === 'tasks')}>
                    <ClipboardList size={16} color="#38bdf8" />
                    <span>Daily Task</span>
                  </button>

                  <button onClick={() => handleNavClick('mission-view')} style={getItemStyle(currentMenu === 'mission-view')}>
                    <Target size={16} color="#fbbf24" />
                    <span>Mission</span>
                  </button>

                  <button onClick={() => handleNavClick('team')} style={getItemStyle(currentMenu === 'team')}>
                    <Users size={16} color="#c084fc" />
                    <span>Team</span>
                  </button>
                </div>
              </div>

              {/* Group 2: Monitoring & NOC */}
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
                  Monitoring & NOC
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleNavClick('noc-monitoring')} style={getItemStyle(currentMenu === 'noc-monitoring')}>
                    <Activity size={16} color="#38bdf8" />
                    <span>NOC Monitoring</span>
                  </button>

                  <button onClick={() => handleNavClick('mikrotik-noc')} style={getItemStyle(currentMenu === 'mikrotik-noc')}>
                    <Router size={16} color="#38bdf8" />
                    <span>MikroTik ROS</span>
                  </button>

                  <button onClick={() => handleNavClick('sla-report')} style={getItemStyle(currentMenu === 'sla-report')}>
                    <Award size={16} color="#fbbf24" />
                    <span>Laporan SLA</span>
                  </button>

                  <button onClick={() => handleNavClick('netmap-core')} style={getItemStyle(currentMenu === 'netmap-core')}>
                    <Globe size={16} color="#34d399" />
                    <span>NetMap Peta</span>
                  </button>

                  <button onClick={() => handleNavClick('netlist')} style={getItemStyle(currentMenu === 'netlist')}>
                    <List size={16} color="#60a5fa" />
                    <span>NetList Perangkat</span>
                  </button>
                </div>
              </div>

              {/* Group 3: Layanan & Aset */}
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
                  Layanan & Aset
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleNavClick('service-desk')} style={getItemStyle(currentMenu === 'service-desk')}>
                    <Ticket size={16} color="#818cf8" />
                    <span>Service Desk</span>
                  </button>

                  <button onClick={() => handleNavClick('inventory')} style={getItemStyle(currentMenu === 'inventory')}>
                    <Boxes size={16} color="#fbbf24" />
                    <span>Inventaris IT</span>
                  </button>

                  <button onClick={() => handleNavClick('eng-ops')} style={getItemStyle(currentMenu === 'eng-ops')}>
                    <FileSpreadsheet size={16} color="#34d399" />
                    <span>NEO Suite</span>
                  </button>

                  <button onClick={() => handleNavClick('qr-manager')} style={getItemStyle(currentMenu === 'qr-manager')}>
                    <QrCode size={16} color="#38bdf8" />
                    <span>QR Scanner</span>
                  </button>
                </div>
              </div>

              {/* Group 4: Admin & Sistem */}
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
                  Pengaturan & Sistem
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleNavClick('profile')} style={getItemStyle(currentMenu === 'profile')}>
                    <UserIcon size={16} color="#38bdf8" />
                    <span>Pengaturan Profil</span>
                  </button>

                  <button onClick={() => handleNavClick('gacs-config')} style={getItemStyle(currentMenu === 'gacs-config')}>
                    <Settings size={16} color="#94a3b8" />
                    <span>Konfigurasi Sistem</span>
                  </button>

                  {currentUser?.role === 'Administrator' && (
                    <>
                      <button onClick={() => handleNavClick('manage')} style={getItemStyle(currentMenu === 'manage')}>
                        <ShieldAlert size={16} color="#f87171" />
                        <span>Manage System</span>
                      </button>

                      <button onClick={() => handleNavClick('system-logs')} style={getItemStyle(currentMenu === 'system-logs')}>
                        <Terminal size={16} color="#38bdf8" />
                        <span>System Logs</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
