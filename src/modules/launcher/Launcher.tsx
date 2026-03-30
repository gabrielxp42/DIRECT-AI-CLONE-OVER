import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Sparkles, Home, Star, GripVertical, CheckCircle2, CloudLightning, Bot, Package, Settings, User, Image as ImageIcon, Search, CircleDollarSign, BadgeCheck
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { cn } from '@/lib/utils';
import { LauncherSidebar } from './components/Sidebar';
import { 
  CloudStatusWidget, 
  DailySummaryWidget, 
  GabiAnalyticsWidget, 
  InventoryWidget 
} from './components/Widgets';
import './Launcher.css';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createFireflies = (count: number, seed: number) => {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => {
    const baseLeft = rand() * 100;
    const baseTop = rand() * 100;
    const size = clamp(2 + rand() * 3.5, 2, 5.5);
    const wander = clamp(30 + rand() * 60, 30, 90);
    const duration = clamp(18 + rand() * 22, 18, 40);
    const flicker = clamp(2.5 + rand() * 4.5, 2.5, 7);
    const delay = rand() * 4;
    const brightness = clamp(0.35 + rand() * 0.55, 0.35, 0.9);
    const x1 = (rand() - 0.5) * wander;
    const y1 = (rand() - 0.5) * wander;
    const x2 = (rand() - 0.5) * wander;
    const y2 = (rand() - 0.5) * wander;
    const x3 = (rand() - 0.5) * wander;
    const y3 = (rand() - 0.5) * wander;
    return {
      key: `firefly-${seed}-${index}`,
      left: baseLeft,
      top: baseTop,
      size,
      duration,
      flicker,
      delay,
      brightness,
      x1,
      y1,
      x2,
      y2,
      x3,
      y3,
    };
  });
};

const createSparks = (count: number, seed: number) => {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => {
    const left = rand() * 100;
    const top = 78 + rand() * 30;
    const size = clamp(1.8 + rand() * 2.8, 1.8, 4.6);
    const duration = clamp(4 + rand() * 8, 4, 12);
    const delay = -rand() * duration;
    const x1 = (rand() - 0.5) * 18;
    const x2 = (rand() - 0.5) * 28;
    const x3 = (rand() - 0.5) * 38;
    const rise = clamp(120 + rand() * 220, 120, 340);
    const energy = clamp(0.35 + rand() * 0.75, 0.35, 1.1);
    return {
      key: `spark-${seed}-${index}`,
      left,
      top,
      size,
      duration,
      delay,
      x1,
      x2,
      x3,
      rise,
      energy,
    };
  });
};

interface OverPixelLauncherProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAppClick?: (appId: string, route?: string) => void;
  isInline?: boolean;
  showSettings?: boolean;
  glassTone?: string;
  onToneChange?: (tone: string) => void;
  glassOpacity?: number;
  onOpacityChange?: (opacity: number) => void;
  isSidebarExpanded?: boolean;
  mode?: 'full' | 'mobileOverlay';
  activeAppOverride?: 'gabi' | 'dtf-factory' | 'montador' | 'melhorador';
}

// Custom App Logos
const MontadorIcon = ({ className }: { className?: string }) => (
  <img 
    src="/montador/logo-montador-fast.png" 
    alt="O Montador" 
    className={cn("w-full h-full object-contain p-0.5", className)} 
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
  />
);

const DTFFactoryLogo = ({ className }: { className?: string }) => (
  <img 
    src="/dtf-fabric-logo.png" 
    alt="DTF Factory" 
    className={cn("w-full h-full object-contain p-0.5", className)} 
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
  />
);

const DirectAILogo = ({ className }: { className?: string }) => (
  <div className={cn("w-14 h-14 md:w-16 md:h-16 flex items-center justify-center", className)}>
    <svg viewBox="0 0 200 120" className="w-[120%] h-[120%] fill-none stroke-white/95">
      <circle cx="72" cy="60" r="48" strokeWidth="14" />
      <circle cx="128" cy="60" r="48" strokeWidth="14" />
    </svg>
  </div>
);

const MelhoradorLogo = ({ className }: { className?: string }) => (
  <img 
    src={encodeURI('/logo melhorador cloud.png')}
    alt="Melhorador Cloud" 
    className={cn("w-full h-full object-contain p-0.5", className)} 
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
  />
);

const apps = [
  { id: 'direct-ai', name: 'Direct AI', icon: DirectAILogo, color: 'linear-gradient(135deg, #06b6d4, #3b82f6)', badge: 'Assinado', badgeClass: 'assinado', route: '/dashboard' },
  { id: 'dtf-factory', name: 'DTF Factory', icon: DTFFactoryLogo, color: 'linear-gradient(135deg, #f59e0b, #ea580c)', badge: 'Pro', badgeClass: 'pro', route: '/dtf-factory' },
  { id: 'montador', name: 'O Montador', icon: MontadorIcon, color: 'linear-gradient(135deg, #8b5cf6, #d946ef)', badge: 'Assinado', badgeClass: 'assinado', route: '/montador' },
  { id: 'melhorador', name: 'Melhorador Cloud', icon: MelhoradorLogo, color: 'linear-gradient(135deg, #e11d48, #9f1239)', badge: 'Pro', badgeClass: 'pro', route: '/melhorador' }
];

const availableWidgets = [
  { id: 'cloud', label: 'Cloud Status', icon: CloudLightning, component: CloudStatusWidget },
  { id: 'summary', label: 'Daily Summary', icon: CheckCircle2, component: DailySummaryWidget },
  { id: 'gabi', label: 'Gabi Analytics', icon: Bot, component: GabiAnalyticsWidget },
  { id: 'inventory', label: 'Inventory Alert', icon: Package, component: InventoryWidget },
];

const OverPixelLauncher = React.forwardRef<HTMLDivElement, OverPixelLauncherProps>(
  ({ isOpen, onClose, onAppClick, isInline, showSettings, glassTone, onToneChange, glassOpacity, onOpacityChange, isSidebarExpanded, mode = 'full', activeAppOverride }, ref) => {
    const navigate = useNavigate();
    const { profile, activeSubProfile, session } = useSession();
    const location = useLocation();
    
    // States
    const [isEditingApps, setIsEditingApps] = useState(false);
    const [isManagingWidgets, setIsManagingWidgets] = useState(false);
    const [sortedApps, setSortedApps] = useState(apps);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [visibleWidgets, setVisibleWidgets] = useState<string[]>(() => {
      const saved = localStorage.getItem('op-launcher-widgets');
      return saved ? JSON.parse(saved) : ['cloud', 'summary', 'gabi', 'inventory'];
    });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [localShowSettings, setLocalShowSettings] = useState(false);
    const [bgMode, setBgMode] = useState<'ambient' | 'camera'>(() => {
      const saved = localStorage.getItem('op-launcher-bg-mode');
      return saved === 'camera' ? 'camera' : 'ambient';
    });
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [bgBrightness, setBgBrightness] = useState<number>(() => {
      const saved = localStorage.getItem('op-launcher-bg-brightness');
      const v = saved ? Number(saved) : 0.9;
      return isNaN(v) ? 0.9 : Math.min(1.4, Math.max(0.5, v));
    });

    // Current app context based on route
    const currentAppId = useMemo(() => {
      if (activeAppOverride === 'montador') return 'app-montador';
      if (activeAppOverride === 'dtf-factory') return 'app-dtf-factory';
      if (activeAppOverride === 'melhorador') return 'app-melhorador';
      if (activeAppOverride === 'gabi') return 'app-gabi';
      if (location.pathname.includes('montador')) return 'app-montador';
      if (location.pathname.includes('dtf-factory')) return 'app-dtf-factory';
      return 'app-gabi';
    }, [activeAppOverride, location.pathname]);

    const particleSeed = useMemo(() => hashString(currentAppId), [currentAppId]);

    const dtfFireflies = useMemo(() => {
      if (currentAppId !== 'app-dtf-factory') return [];
      return createFireflies(18, particleSeed);
    }, [currentAppId, particleSeed]);

    const montadorSparks = useMemo(() => {
      if (currentAppId !== 'app-montador') return [];
      return createSparks(26, particleSeed);
    }, [currentAppId, particleSeed]);

    useEffect(() => {
      const root = document.documentElement;
      root.setAttribute('data-launcher-app', currentAppId.replace('app-', ''));
      return () => {
        if (root.getAttribute('data-launcher-app') === currentAppId.replace('app-', '')) {
          root.removeAttribute('data-launcher-app');
        }
      };
    }, [currentAppId]);

    // Sync Widgets
    useEffect(() => {
      localStorage.setItem('op-launcher-widgets', JSON.stringify(visibleWidgets));
    }, [visibleWidgets]);

    // Initialize from local storage
    useEffect(() => {
      const savedOrder = localStorage.getItem('op-launcher-apps-order');
      if (savedOrder) {
        try {
          const orderIds = JSON.parse(savedOrder) as string[];
          const ordered = orderIds.map(id => apps.find(a => a.id === id)).filter(Boolean) as typeof apps;
          const missing = apps.filter(a => !orderIds.includes(a.id));
          setSortedApps([...ordered, ...missing]);
        } catch {}
      }
      const savedFavs = localStorage.getItem('op-launcher-favorites');
      if (savedFavs) {
        try { setFavorites(JSON.parse(savedFavs)); } catch {}
      }
    }, []);

    const toggleWidget = (id: string) => {
      setVisibleWidgets(prev => 
        prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
      );
    };

    const handleAppClickInternal = (appId: string, route: string | null) => {
      console.log(`[Launcher] App clicked: ${appId} -> Route: ${route || 'none'}`);
      // Fechar o launcher imediatamente ao clicar, antes de navegar
      if (onClose) onClose();
      // Forçar fechamento via evento global (fallback robusto)
      try {
        window.dispatchEvent(new CustomEvent('toggle-launcher', { detail: { force: 'close' } }));
      } catch {}
      if (onAppClick) {
        onAppClick(appId, route || undefined);
        return;
      }
      if (route) {
        navigate(route);
        // Fail-safe: reforçar fechamento após a navegação inicial
        setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('toggle-launcher', { detail: { force: 'close' } }));
          } catch {}
          if (onClose) onClose();
          
          // Apenas ocultar o Launcher Overlay, NUNCA a página raiz do Launcher principal
          if (location.pathname !== '/') {
             const overlays = document.querySelectorAll('.ios-launcher-container');
             overlays.forEach(el => {
                if (el.closest('.z-\\[9995\\]') || el.classList.contains('mobile-overlay')) {
                    (el as HTMLElement).style.display = 'none';
                }
             });
          }
        }, 120);
      }
    };

    const userName = activeSubProfile?.name || profile?.first_name || 'Usuário';
    const timeStr = useMemo(() => {
      try {
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(currentTime);
      } catch {
        const h = String(currentTime.getHours()).padStart(2, '0');
        const m = String(currentTime.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      }
    }, [currentTime]);

    useEffect(() => {
      const id = setInterval(() => setCurrentTime(new Date()), 1000 * 30);
      return () => clearInterval(id);
    }, []);

    useEffect(() => {
      localStorage.setItem('op-launcher-bg-mode', bgMode);
      if (bgMode !== 'camera') return;
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
        } catch (e) {
          setBgMode('ambient');
        }
      };
      startCamera();
      return () => {
        const v = videoRef.current;
        const s = (v?.srcObject as MediaStream | null);
        s?.getTracks().forEach(t => t.stop());
        if (v) v.srcObject = null;
      };
    }, [bgMode]);
    useEffect(() => {
      localStorage.setItem('op-launcher-bg-brightness', String(bgBrightness));
    }, [bgBrightness]);

    const openGalleryShortcut = () => {
      if (location.pathname !== '/dtf-factory') {
        navigate('/dtf-factory');
        window.setTimeout(() => {
          try { window.dispatchEvent(new CustomEvent('OVERPIXEL_OPEN_GALLERY')); } catch {}
        }, 150);
        return;
      }
      try { window.dispatchEvent(new CustomEvent('OVERPIXEL_OPEN_GALLERY')); } catch {}
    };

    if (mode === 'mobileOverlay') {
      return (
        <div className={cn("ios-launcher-container mobile-overlay", currentAppId)} ref={ref}>
          <div className={cn("ios-app-bg", currentAppId)} aria-hidden="true">
            {currentAppId === 'app-dtf-factory' && (
              <div className="dtf-firefly-layer">
                {dtfFireflies.map((p) => {
                  const style: CSSVars = {
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animationDuration: `${p.duration}s, ${p.flicker}s`,
                    animationDelay: `${p.delay}s, ${p.delay * 0.35}s`,
                    '--x1': `${p.x1}px`,
                    '--y1': `${p.y1}px`,
                    '--x2': `${p.x2}px`,
                    '--y2': `${p.y2}px`,
                    '--x3': `${p.x3}px`,
                    '--y3': `${p.y3}px`,
                    '--o': p.brightness,
                  };
                  return <span key={p.key} className="dtf-firefly" style={style} />;
                })}
              </div>
            )}

            {currentAppId === 'app-montador' && (
              <div className="montador-spark-layer">
                {montadorSparks.map((p) => {
                  const style: CSSVars = {
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animationDuration: `${p.duration}s`,
                    animationDelay: `${p.delay}s`,
                    '--x1': `${p.x1}px`,
                    '--x2': `${p.x2}px`,
                    '--x3': `${p.x3}px`,
                    '--rise': `${p.rise}px`,
                    '--e': p.energy,
                  };
                  return <span key={p.key} className="montador-spark" style={style} />;
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <motion.div 
        className={cn("ios-launcher-container", isInline && "inline-mode", `tone-${glassTone}`, currentAppId)} 
        ref={ref}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ 
          '--glass-opacity': glassOpacity,
          '--glass-border-opacity': (glassOpacity ?? 0.12) + 0.15,
          '--bg-brightness': bgBrightness
        } as React.CSSProperties}
      >
        <div className="quest-video-bg" aria-hidden="true">
          {bgMode === 'camera' ? (
            <video ref={videoRef} muted playsInline />
          ) : (
            <img src="/overbuilder-1774815289052.png" alt="Background" />
          )}
        </div>

        <div className="ios-bg-mesh" />
        <div className={cn("ios-app-bg", currentAppId)} aria-hidden="true">
          {currentAppId === 'app-dtf-factory' && (
            <div className="dtf-firefly-layer">
              {dtfFireflies.map((p) => {
                const style: CSSVars = {
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  animationDuration: `${p.duration}s, ${p.flicker}s`,
                  animationDelay: `${p.delay}s, ${p.delay * 0.35}s`,
                  '--x1': `${p.x1}px`,
                  '--y1': `${p.y1}px`,
                  '--x2': `${p.x2}px`,
                  '--y2': `${p.y2}px`,
                  '--x3': `${p.x3}px`,
                  '--y3': `${p.y3}px`,
                  '--o': p.brightness,
                };
                return <span key={p.key} className="dtf-firefly" style={style} />;
              })}
            </div>
          )}

          {currentAppId === 'app-montador' && (
            <div className="montador-spark-layer">
              {montadorSparks.map((p) => {
                const style: CSSVars = {
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                  '--x1': `${p.x1}px`,
                  '--x2': `${p.x2}px`,
                  '--x3': `${p.x3}px`,
                  '--rise': `${p.rise}px`,
                  '--e': p.energy,
                };
                return <span key={p.key} className="montador-spark" style={style} />;
              })}
            </div>
          )}
        </div>

        <div className="quest-topbar">
          <span className="quest-topbar-time">{timeStr}</span>
        </div>

        <div className={cn("quest-leftbar", (showSettings || localShowSettings) && "shift")}>
          <button
            className="quest-left-btn"
            title="Buscar"
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
              document.dispatchEvent(evt);
            }}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            className="quest-left-btn"
            title="Recarregar Tokens"
            onClick={() => {
              const at = session?.access_token || '';
              const rt = (session as any)?.refresh_token || '';
              const qs = new URLSearchParams({ access_token: at, refresh_token: rt }).toString();
              const url = `https://overpixel.online/tokens?${qs}`;
              window.open(url, '_blank');
            }}
          >
            <CircleDollarSign className="w-5 h-5" />
          </button>
          <button
            className="quest-left-btn"
            title="Perfis"
            onClick={() => {
              try { window.dispatchEvent(new CustomEvent('OPEN_PROFILE_SELECTOR')); } catch {}
            }}
          >
            <BadgeCheck className="w-5 h-5" />
          </button>
        </div>

        <div className={cn("quest-rightbar", (showSettings || localShowSettings) && "quest-rightbar-hidden")}>
          <input
            type="range"
            min={0.5}
            max={1.4}
            step={0.01}
            value={bgBrightness}
            onChange={(e) => setBgBrightness(Number(e.target.value))}
            className="quest-slider"
            aria-label="Brilho do fundo"
          />
        </div>

        {/* New Sidebar Integration — Toggleable internally or externally */}
        <AnimatePresence>
          {(showSettings || localShowSettings) && (
            <LauncherSidebar 
              activeTone={glassTone || 'clear'}
              onPersonalize={onToneChange}
              glassOpacity={glassOpacity || 0.15}
              onOpacityChange={onOpacityChange}
              isManagingWidgets={isManagingWidgets}
              onManageWidgets={() => setIsManagingWidgets(!isManagingWidgets)}
              onClose={() => setLocalShowSettings(false)}
            />
          )}
        </AnimatePresence>

        <div className="ios-main-content">
          <div className="ios-content-wrapper max-w-[1240px] mx-auto w-full flex flex-col md:px-12 md:py-12 px-6 py-6 transition-all">
            <div className="quest-panel">
              <Reorder.Group 
                axis="x" 
                values={sortedApps} 
                onReorder={setSortedApps}
                className="quest-grid"
                onContextMenu={(e) => { e.preventDefault(); setIsEditingApps(true); }}
              >
                {sortedApps.map((app) => (
                  <Reorder.Item 
                    key={app.id} value={app}
                    onClick={() => !isEditingApps && handleAppClickInternal(app.id, app.route)}
                    className={cn(isEditingApps && "ios-wiggle-animation")}
                  >
                    <div className="quest-icon">
                      <app.icon className="ios-squircle-logo text-white" />
                      {isEditingApps && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
                          <GripVertical className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="quest-label">{app.name}</div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </div>
        </div>

        <div className="quest-dock">
          <button
            className="quest-dock-btn"
            title="Minha Conta"
            onClick={() => navigate('/profile')}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage 
                src={
                  activeSubProfile?.avatar_url || 
                  profile?.avatar_url || 
                  ((session?.user as any)?.user_metadata?.avatar_url) || 
                  ((session?.user as any)?.user_metadata?.picture) || 
                  undefined
                } 
                alt={userName || 'Perfil'} 
              />
              <AvatarFallback className="bg-white/10 text-white/80 text-xs font-bold">
                {(userName || 'U').slice(0,2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <button
            className="quest-dock-btn"
            title="Configurações do Launcher"
            onClick={() => setLocalShowSettings(!localShowSettings)}
          >
            <Settings className="w-6 h-6 text-white" />
          </button>
          <button
            className="quest-dock-btn"
            title="Galeria"
            onClick={openGalleryShortcut}
          >
            <ImageIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        {isEditingApps && (
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[20000]">
              <button onClick={() => setIsEditingApps(false)} className="px-8 py-4 rounded-3xl bg-white text-black font-black shadow-2xl hover:scale-105 active:scale-95 transition-all">Finalizar Organização</button>
            </motion.div>
        )}
      </motion.div>
    );
  }
);

OverPixelLauncher.displayName = 'OverPixelLauncher';
export default OverPixelLauncher;
