import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, CheckCircle2 } from 'lucide-react';

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed as PWA)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(iosDevice);

    // Listen to native Chrome/Android/Edge PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    } else {
      alert('Untuk meng-install NEMESYS:\n1. Buka menu browser (titik tiga ⋮ atau opsi browser).\n2. Pilih "Install aplikasi" atau "Tambahkan ke Layar Utama".');
    }
  };

  if (isInstalled) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>App Installed</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 rounded-xl transition-all"
        title="Install Aplikasi NEMESYS di HP / Desktop"
        style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.35)', color: '#38bdf8' }}
      >
        <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="hidden sm:inline">Install App</span>
        <Download className="w-3 h-3 text-cyan-400 shrink-0" />
      </button>

      {/* Modal Petunjuk iOS Safari */}
      {showIosModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base">Install App di iOS (iPhone/iPad)</h3>
              </div>
              <button onClick={() => setShowIosModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside">
              <li>
                Tekan tombol <span className="inline-flex items-center gap-1 font-semibold text-cyan-400 px-1.5 py-0.5 bg-slate-800 rounded"><Share className="w-3 h-3" /> Share / Bagikan</span> di bagian bawah Safari.
              </li>
              <li>
                Geser ke bawah lalu pilih menu <span className="font-semibold text-white">"Tambahkan ke Layar Utama" (Add to Home Screen)</span>.
              </li>
              <li>
                Tekan <span className="font-semibold text-cyan-400">"Tambah"</span> di pojok kanan atas.
              </li>
            </ol>

            <button
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
