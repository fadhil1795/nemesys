import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  BellRing, 
  CheckCheck, 
  Trash2, 
  AlertTriangle, 
  Wifi, 
  Ticket, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Send,
  X,
  ExternalLink
} from 'lucide-react';
import { BACKEND_URL } from '../App';

export interface SystemNotification {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  category: 'network' | 'ticket' | 'system' | 'alarm';
  severity: 'info' | 'warning' | 'critical' | 'success';
  link_url?: string | null;
  is_read: number;
  created_at: string;
}

interface NotificationCenterProps {
  token: string | null;
  onNavigate?: (menu: string) => void;
  socket?: any;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ token, onNavigate, socket }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'network' | 'ticket'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(false);
  const [, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check browser push permission
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/notifications?limit=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen to real-time notification socket event
    if (socket) {
      const handleNewNotif = (notif: SystemNotification) => {
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Sound effect (optional subtle beep)
        if (soundEnabled) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(notif.severity === 'critical' ? 880 : 587.33, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch {}
        }

        // Native Browser Push Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              icon: '/favicon.ico',
              tag: `notif-${notif.id}`
            });
          } catch {}
        }
      };

      socket.on('new_notification', handleNewNotif);
      return () => {
        socket.off('new_notification', handleNewNotif);
      };
    }
  }, [token, socket, soundEnabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Request native browser push permission
  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      alert('Browser Anda tidak mendukung Web Push Notification.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setBrowserPushEnabled(true);
      new Notification('NEMESYS Notifikasi Aktif', {
        body: 'Anda akan menerima notifikasi desktop real-time jika terjadi gangguan NOC.'
      });
    } else {
      setBrowserPushEnabled(false);
      alert('Izin notifikasi desktop ditolak.');
    }
  };

  // Mark single as read
  const markAsRead = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete notification
  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const target = notifications.find(n => n.id === id);
      if (target && !target.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger test notification
  const triggerTestNotification = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ category: 'network', severity: 'warning' })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Filter list by tab
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'network') return n.category === 'network' || n.category === 'alarm';
    if (activeTab === 'ticket') return n.category === 'ticket';
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded">CRITICAL</span>;
      case 'warning':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">WARNING</span>;
      case 'success':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">SUCCESS</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">INFO</span>;
    }
  };

  const getCategoryIcon = (category: string, severity: string) => {
    if (severity === 'critical') return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
    switch (category) {
      case 'network':
      case 'alarm':
        return <Wifi className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'ticket':
        return <Ticket className="w-4 h-4 text-cyan-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffSec = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return `${diffSec} detik lalu`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
      return `${Math.floor(diffSec / 86400)} hari lalu`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        title="Pusat Notifikasi System"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-slate-100 text-sm">Pusat Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  {unreadCount} Baru
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg border transition-all ${
                  soundEnabled 
                    ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' 
                    : 'text-slate-500 border-slate-700 bg-slate-800/50'
                }`}
                title={soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi senyap'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Native Push Toggle */}
              <button
                onClick={requestBrowserPermission}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                  browserPushEnabled
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-slate-400 border-slate-700 bg-slate-800/50 hover:bg-slate-700'
                }`}
                title={browserPushEnabled ? 'Web Push Desktop Aktif' : 'Aktifkan Web Push Notification Desktop'}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px] font-medium">Desktop</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-800/50 bg-slate-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {(['all', 'unread', 'network', 'ticket'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-all font-medium text-[11px] ${
                    activeTab === tab
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab === 'all' ? 'Semua' : tab === 'unread' ? 'Belum Dibaca' : tab === 'network' ? 'NOC' : 'Tiket'}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3 h-3" />
                Dibaca
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-slate-600" />
                <p className="text-xs">Tidak ada notifikasi saat ini.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) markAsRead(notif.id);
                    if (notif.link_url && onNavigate) {
                      onNavigate(notif.link_url);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 transition-all flex items-start gap-3 cursor-pointer hover:bg-slate-800/60 ${
                    !notif.is_read ? 'bg-cyan-950/20 border-l-2 border-cyan-400' : 'bg-transparent opacity-85'
                  }`}
                >
                  {getCategoryIcon(notif.category, notif.severity)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {notif.title}
                      </span>
                      {getSeverityBadge(notif.severity)}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{formatTimeAgo(notif.created_at)}</span>
                      
                      <div className="flex items-center gap-2">
                        {notif.link_url && (
                          <span className="flex items-center gap-0.5 text-cyan-400 hover:underline">
                            Buka <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                        <button
                          onClick={(e) => deleteNotification(notif.id, e)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                          title="Hapus notifikasi"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Action */}
          <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px]">
            <button
              onClick={triggerTestNotification}
              className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Tes Alarm Realtime
            </button>
            <span className="text-slate-400 font-mono text-[10px]">NEMESYS Notification Engine</span>
          </div>

        </div>
      )}
    </div>
  );
};
