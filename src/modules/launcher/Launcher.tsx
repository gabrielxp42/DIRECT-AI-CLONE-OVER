import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Sparkles, Home, Star, GripVertical, CheckCircle2, CloudLightning, Bot, Package, Settings
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
}

// Custom App Logos
const MontadorIcon = ({ className }: { className?: string }) => (
  <img src="/montador/logo-montador-fast.png" alt="O Montador" className={cn("w-full h-full object-contain p-2", className)} />
);

const DTFFactoryLogo = ({ className }: { className?: string }) => (
  <img src="/dtf-fabric-logo.png" alt="DTF Factory" className={cn("w-full h-full object-contain p-2", className)} />
);

const DirectAILogo = ({ className }: { className?: string }) => (
  <div className={cn("w-14 h-14 flex items-center justify-center", className)}>
    <svg viewBox="0 0 200 120" className="w-full h-full fill-none stroke-white/90">
      <circle cx="72" cy="60" r="44" strokeWidth="12" />
      <circle cx="128" cy="60" r="44" strokeWidth="12" />
    </svg>
  </div>
);

const MelhoradorLogo = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center w-full h-full", className)} style={{ transform: "scale(1.2)" }}>
    <Sparkles className="w-full h-full text-rose-200" strokeWidth={1} style={{ filter: "drop-shadow(0 0 10px rgba(251,113,133,0.8))" }} />
  </div>
);

const apps = [
  { id: 'direct-ai', name: 'Direct AI', icon: DirectAILogo, color: 'linear-gradient(135deg, #06b6d4, #3b82f6)', badge: 'Assinado', badgeClass: 'assinado', route: '/dashboard' },
  { id: 'dtf-factory', name: 'DTF Factory', icon: DTFFactoryLogo, color: 'linear-gradient(135deg, #f59e0b, #ea580c)', badge: 'Pro', badgeClass: 'pro', route: '/dtf-factory' },
  { id: 'montador', name: 'O Montador', icon: MontadorIcon, color: 'linear-gradient(135deg, #8b5cf6, #d946ef)', badge: 'Assinado', badgeClass: 'assinado', route: '/montador' },
  { id: 'melhorador', name: 'Melhorador Cloud', icon: MelhoradorLogo, color: 'linear-gradient(135deg, #e11d48, #9f1239)', badge: 'Em Breve', badgeClass: 'em-breve', route: null }
];

const availableWidgets = [
  { id: 'cloud', label: 'Cloud Status', icon: CloudLightning, component: CloudStatusWidget },
  { id: 'summary', label: 'Daily Summary', icon: CheckCircle2, component: DailySummaryWidget },
  { id: 'gabi', label: 'Gabi Analytics', icon: Bot, component: GabiAnalyticsWidget },
  { id: 'inventory', label: 'Inventory Alert', icon: Package, component: InventoryWidget },
];

const OverPixelLauncher = React.forwardRef<HTMLDivElement, OverPixelLauncherProps>(
  ({ isOpen, onClose, onAppClick, isInline, showSettings, glassTone, onToneChange, glassOpacity, onOpacityChange }, ref) => {
    const navigate = useNavigate();
    const { profile, activeSubProfile } = useSession();
    
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

    // Sync Tone (Removed - Now handled by Layout.tsx via props)

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
      if (onAppClick) { 
        onAppClick(appId, route || undefined); 
        return; 
      }
      if (route) { 
        navigate(route); 
        if (onClose) onClose(); 
      }
    };

    const userName = activeSubProfile?.name || profile?.first_name || 'Usuário';

    return (
      <motion.div 
        className={cn("ios-launcher-container", isInline && "inline-mode", `tone-${glassTone}`)} 
        ref={ref}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="ios-bg-mesh" />

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
          <div className="ios-content-wrapper max-w-[1240px] mx-auto w-full flex flex-col px-12 py-12">
            
            <div className="ios-top-info flex items-center justify-between mb-12">
               <div>
                 <h1 className="ios-greeting text-5xl font-black text-white leading-tight">
                    Boa tarde, {userName}.
                 </h1>
                 <p className="text-white/40 text-sm font-medium tracking-wide mt-2">
                    Conectado ao OverPixel Central Control
                 </p>
               </div>

               {/* Unified Settings Trigger inside the Card */}
               <motion.button
                  onClick={() => setLocalShowSettings(!localShowSettings)}
                  className={cn(
                    "p-4 rounded-3xl transition-all border shrink-0",
                    localShowSettings 
                      ? "bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]" 
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Ajustes e Personalização"
               >
                  <Settings className={cn(
                    "w-7 h-7 transition-colors",
                    localShowSettings ? "text-cyan-400 animate-spin-slow" : "text-white/30"
                  )} />
               </motion.button>
            </div>

            {/* App Grid */}
            <Reorder.Group 
              axis="x" 
              values={sortedApps} 
              onReorder={setSortedApps}
              className="ios-app-grid"
              onContextMenu={(e) => { e.preventDefault(); setIsEditingApps(true); }}
            >
              {sortedApps.map((app) => (
                <Reorder.Item 
                  key={app.id} value={app}
                  className={cn("ios-app-container relative", isEditingApps && "ios-wiggle-animation")}
                  onClick={() => !isEditingApps && handleAppClickInternal(app.id, app.route)}
                >
                  <div className="ios-squircle relative" style={{ background: app.color }}>
                    <app.icon className="ios-squircle-logo text-white" />
                    {isEditingApps && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
                        <GripVertical className="text-white" />
                      </div>
                    )}
                    {app.badge && <div className={cn("ios-badge", app.badgeClass)}>{app.badge}</div>}
                  </div>
                  <div className="ios-app-name">{app.name}</div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Widgets Grid */}
            <div className="ios-widgets-area">
              <AnimatePresence>
                {availableWidgets.map((widget) => {
                  const isVisible = visibleWidgets.includes(widget.id);
                  if (!isVisible && !isManagingWidgets) return null;
                  
                  return (
                    <motion.div 
                      key={widget.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: isVisible ? 1 : 0.3, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative"
                    >
                      <widget.component />
                      {isManagingWidgets && (
                        <button 
                          onClick={() => toggleWidget(widget.id)}
                          className={cn(
                            "absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-xl z-30 transition-all",
                            isVisible ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                          )}
                        >
                          {isVisible ? <Settings size={14} /> : <Settings size={14} className="rotate-45" />}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
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
