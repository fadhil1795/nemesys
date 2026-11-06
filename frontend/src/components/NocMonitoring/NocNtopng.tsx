import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Globe,
  Home,
  Settings,
  HelpCircle,
  Server,
  Radio,
  Check
} from 'lucide-react';
import { BACKEND_URL } from '../../App';

interface Props {
  token?: string;
}

export const NocNtopng: React.FC<Props> = ({ token }) => {
  const [publicUrl, setPublicUrl] = useState<string>('http://103.92.209.107:3050');
  const [localUrl, setLocalUrl] = useState<string>('http://192.168.1.2:3050');
  const [activeMode, setActiveMode] = useState<'public' | 'local' | 'custom'>('public');
  const [customUrl, setCustomUrl] = useState<string>('http://103.92.209.107:3050');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [loading, setLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load config from backend & local storage
  useEffect(() => {
    const savedMode = localStorage.getItem('ntopng_mode') as 'public' | 'local' | 'custom' | null;
    const savedCustomUrl = localStorage.getItem('ntopng_custom_url');

    if (savedMode) setActiveMode(savedMode);
    if (savedCustomUrl) setCustomUrl(savedCustomUrl);

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ntopng/config`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success) {
          if (data.publicUrl) setPublicUrl(data.publicUrl);
          if (data.localUrl) setLocalUrl(data.localUrl);
        }
      } catch (err) {
        console.error('Failed to fetch ntopng config:', err);
      }
    };
    fetchConfig();
  }, [token]);

  const getCurrentUrl = () => {
    if (activeMode === 'local') return localUrl;
    if (activeMode === 'custom') return customUrl;
    return publicUrl;
  };

  const handleModeChange = (mode: 'public' | 'local' | 'custom') => {
    setActiveMode(mode);
    localStorage.setItem('ntopng_mode', mode);
    setLoading(true);
    setIframeKey(Date.now());
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ntopng_custom_url', customUrl);
    setActiveMode('custom');
    localStorage.setItem('ntopng_mode', 'custom');
    setShowSettings(false);
    setLoading(true);
    setIframeKey(Date.now());
  };

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey(Date.now());
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const currentUrl = getCurrentUrl();

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        width: '100%',
        height: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
        minHeight: '600px',
        background: '#0b1120',
        padding: isFullscreen ? '0' : '0.5rem',
        borderRadius: isFullscreen ? '0' : '12px'
      }}
    >
      {/* Top Control Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: isFullscreen ? '0' : '10px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)'
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Traffic Flow &amp; DPI Analyzer
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}
              >
                NTOPNG LIVE
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                PORT 3050
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Target:</span>
              <code style={{ color: '#38bdf8', background: 'rgba(15, 23, 42, 0.6)', padding: '1px 6px', borderRadius: '4px' }}>
                {currentUrl}
              </code>
            </div>
          </div>
        </div>

        {/* Right: Mode Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Network Switcher (Public vs Local) */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(71, 85, 105, 0.4)'
            }}
          >
            <button
              onClick={() => handleModeChange('public')}
              title={`Akses via IP Publik (${publicUrl})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeMode === 'public' ? '#0284c7' : 'transparent',
                color: activeMode === 'public' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              <Globe size={14} />
              <span>Publik (103.92.209.107)</span>
            </button>
            <button
              onClick={() => handleModeChange('local')}
              title={`Akses via IP Lokal TrueNAS (${localUrl})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeMode === 'local' ? '#059669' : 'transparent',
                color: activeMode === 'local' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              <Home size={14} />
              <span>Lokal (192.168.1.2)</span>
            </button>
          </div>

          {/* Quick Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Ubah URL Custom ntopng"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showSettings ? '#334155' : 'rgba(30, 41, 59, 0.8)',
              color: '#cbd5e1',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer'
            }}
          >
            <Settings size={16} />
          </button>

          {/* Guide / Info */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            title="Panduan Koneksi & NetFlow"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showGuide ? '#334155' : 'rgba(30, 41, 59, 0.8)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer'
            }}
          >
            <HelpCircle size={16} />
          </button>

          {/* Refresh Frame */}
          <button
            onClick={handleRefresh}
            title="Muat Ulang Iframe"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#f8fafc',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>Reload</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Mode Layar Penuh (NOC Display)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: isFullscreen ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
              color: '#f8fafc',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          {/* Open in New Tab */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka ntopng di Tab Baru"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
            }}
          >
            <ExternalLink size={14} />
            <span>Buka Tab Baru</span>
          </a>
        </div>
      </div>

      {/* Settings Dropdown Popover */}
      {showSettings && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
            Pengaturan Alamat URL ntopng
          </div>
          <form onSubmit={handleSaveCustomUrl} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://IP_SERVER:3050"
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                color: '#f8fafc',
                fontSize: '0.8rem'
              }}
            />
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Check size={14} />
              <span>Simpan &amp; Terapkan</span>
            </button>
          </form>
        </div>
      )}

      {/* Guide Dropdown Popover */}
      {showGuide && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.875rem' }}>
            💡 Informasi &amp; Troubleshooting ntopng:
          </div>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>
              <strong>Login Default:</strong> Username: <code style={{ color: '#38bdf8' }}>admin</code> / Password: <code style={{ color: '#38bdf8' }}>admin</code>.
            </li>
            <li>
              <strong>MikroTik Traffic Flow Target:</strong>
              <div style={{ margin: '0.35rem 0' }}>
                <code style={{ background: '#0f172a', padding: '0.35rem 0.65rem', borderRadius: '4px', color: '#a5f3fc', display: 'block' }}>
                  /ip traffic-flow target add dst-address=103.92.209.107 port=2055 version=9
                </code>
              </div>
            </li>
            <li>
              <strong>Jika Layar Iframe Putih / Blank:</strong> Sebagian browser memblokir tampilan HTTP jika nmsystem dibuka via HTTPS (Mixed Content), atau jika ntopng belum dijalankan dengan parameter <code style={{ color: '#f43f5e' }}>--disable-x-frame-options</code>. Jika ini terjadi, gunakan tombol <strong>"Buka Tab Baru"</strong> di atas.
            </li>
          </ul>
        </div>
      )}

      {/* Iframe Viewport Container */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          borderRadius: isFullscreen ? '0' : '10px',
          overflow: 'hidden',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          background: '#0f172a'
        }}
      >
        {/* Loading Indicator */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              background: '#0f172a',
              zIndex: 10
            }}
          >
            <RefreshCw size={28} className="spin-slow text-sky-400" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Memuat Web Console ntopng ({currentUrl})...
            </div>
          </div>
        )}

        {/* Embedded ntopng Web UI */}
        <iframe
          key={iframeKey}
          src={currentUrl}
          title="ntopng Web Console"
          onLoad={() => setLoading(false)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
          allow="fullscreen"
        />
      </div>

      {/* Fallback Notice Footer */}
      {!isFullscreen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#64748b',
            padding: '0 0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Server size={13} />
            <span>TrueNAS Host: 103.92.209.107 (Publik) | 192.168.1.2 (Lokal)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Radio size={13} style={{ color: '#38bdf8' }} />
            <span>NetFlow Port UDP: <strong>2055</strong> | Web UI Port: <strong>3050</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NocNtopng;

