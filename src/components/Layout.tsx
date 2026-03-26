import * as React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare, Layers, Sparkles, Image as ImageIcon, Bot, Truck, Grid2x2, X, LayoutGrid, CloudCog, Wand2, Settings, ChevronRight, Palette, AlertCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence, animate, motion, useDragControls, useMotionValue } from 'framer-motion';
import { AIAssistant } from './AIAssistant';
import { ThemeToggle } from './ThemeToggle';
import { GabiAvatar } from './GabiAvatar';
import { useToast } from '@/hooks/use-toast';
import { UserNav } from './UserNav';
import { MobileBottomNav } from './MobileBottomNav';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInsumos } from '@/hooks/useDataFetch';
import { AILowStockAlert } from './AILowStockAlert';
import { Button } from './ui/button';
import { useViewportZoom } from '@/hooks/useViewportZoom';
import { APP_VERSION } from '@/utils/version';
import { cn } from '@/lib/utils';
import { CommandMenu } from './CommandMenu';
import { GiftPlanModal } from './GiftPlanModal';
import { GiftVetorizaModal } from './GiftVetorizaModal';
import { DTFCalculatorModal } from './DTFCalculatorModal';
import { SidebarShortcuts } from './SidebarShortcuts';
import { VetorizadorModal } from './VetorizadorModal';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { SubscriptionAlert } from './SubscriptionAlert';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp } from 'lucide-react';
import { TaskDock } from './TaskDock';
import { ModalQueueProvider } from '@/contexts/ModalQueueContext';
import { ActivityTracker } from './ActivityTracker';
import { ProfileSelector } from './ProfileSelector';
import { useSession } from '@/contexts/SessionProvider';
import OverPixelLauncher from '@/modules/launcher/Launcher';
import { AIFirstOnboarding } from '@/components/AIFirstOnboarding';
// Lazy Load Persistent Apps for Instance Memory
const DTFFactory = React.lazy(() => import('../pages/DTFFactory'));
const MontadorPage = React.lazy(() => import('../pages/Montador'));

const PERSISTENT_APP_ROUTES = ['/dtf-factory', '/montador'];

const staticNavItems = [
  { href: '/clientes', icon: Users, label: 'Clientes', permission: 'view_clientes' },
  { href: '/reports', icon: BarChart3, label: 'Relatórios', permission: 'view_reports' },
  { href: '/settings', icon: Settings, label: 'Configurações', permission: 'manage_settings' },
  { href: '/gabi', icon: Bot, label: 'Gabi', permission: 'view_gabi' },
];

const Layout = () => {
  const { profile, activeSubProfile } = useSession();
  const { isOpen, open: openAIAssistant } = useAIAssistant();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: insumos } = useInsumos();
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  const [isVetorizadorOpen, setIsVetorizadorOpen] = React.useState(false);
  const [showLauncher, setShowLauncher] = React.useState(false);
  const [showLauncherSettings, setShowLauncherSettings] = React.useState(false);
  const [mobileLauncherIndex, setMobileLauncherIndex] = React.useState(0);
  const [expandDTF, setExpandDTF] = React.useState(false);
  const [expandLOJA, setExpandLOJA] = React.useState(false);
  const [expandFERR, setExpandFERR] = React.useState(false);

  const mobileCarouselX = useMotionValue(0);
  const mobileCarouselDragControls = useDragControls();
  const isMobileCarouselDraggingRef = React.useRef(false);
  const mobileCarouselPointerStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Instance Memory State (Visited Persistent Apps)
  const [visitedPersistentApps, setVisitedPersistentApps] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (PERSISTENT_APP_ROUTES.includes(location.pathname)) {
      setVisitedPersistentApps(prev => new Set([...prev, location.pathname]));
    }
  }, [location.pathname]);

  // Global Liquid Glass State (Surgical 2026)
  const [glassTone, setGlassTone] = React.useState(() => localStorage.getItem('op-glass-tone') || 'clear');
  const [glassOpacity, setGlassOpacity] = React.useState(() => Number(localStorage.getItem('op-glass-opacity')) || 0.12);
  const [glassBlur, setGlassBlur] = React.useState(() => Number(localStorage.getItem('op-glass-blur')) || 70);

  // Sync Master Variables
  React.useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('op-glass-tone', glassTone);
    localStorage.setItem('op-glass-opacity', glassOpacity.toString());
    localStorage.setItem('op-glass-blur', glassBlur.toString());

    // Map Tone to RGB - Neutralized for "Glass" feel
    const toneMap: Record<string, string> = {
      'clear': '255, 255, 255',
      'dark': '0, 0, 0',
      'cyan': '6, 182, 212',
      'rose': '225, 29, 72'
    };

    const rgb = toneMap[glassTone] || '255, 255, 255';
    root.style.setProperty('--glass-rgb', rgb);
    root.style.setProperty('--glass-opacity', glassOpacity.toString());
    
    // Dynamic Blur: Scaled from 40px to 90px based on 5% to 80% opacity
    const dynamicBlur = 40 + (glassOpacity * 60);
    root.style.setProperty('--glass-blur', `${dynamicBlur}px`);
    
    // Header/Important content should remain bright
    root.style.setProperty('--glass-content-opacity', '1');
    root.style.setProperty('--glass-border-opacity', (glassOpacity + 0.15).toString());
  }, [glassTone, glassOpacity]);
  const [launcherTheme, setLauncherTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('op-launcher-sidebar-theme') as 'light' | 'dark') || 'dark';
  });

  // Listen for open-vetorizador event (e.g. from GiftVetorizaModal)
  React.useEffect(() => {
    const handler = () => setIsVetorizadorOpen(true);
    window.addEventListener('open-vetorizador', handler);
    return () => window.removeEventListener('open-vetorizador', handler);
  }, []);

  const lastToggleRef = React.useRef(0);
  const lastPathOpenedRef = React.useRef(location.pathname);

  const closeLauncher = React.useCallback(() => {
    console.log('[Layout] closeLauncher() called');
    setShowLauncher(false);
    setShowLauncherSettings(false);
  }, []);

  const mobileLauncherApps = React.useMemo(() => ([
    { id: 'direct-ai', theme: 'gabi' as const, iconType: 'svg' as const, route: '/dashboard' },
    { id: 'dtf-factory', theme: 'dtf-factory' as const, iconType: 'img' as const, iconSrc: '/dtf-fabric-logo.png', route: '/dtf-factory' },
    { id: 'montador', theme: 'montador' as const, iconType: 'img' as const, iconSrc: '/montador/logo-montador-fast.png', route: '/montador' },
    { id: 'melhorador', theme: 'melhorador' as const, iconType: 'img' as const, iconSrc: encodeURI('/logo melhorador cloud.png'), route: null },
  ]), []);

  const mod = React.useCallback((value: number, base: number) => ((value % base) + base) % base, []);

  const mobileActiveApp = React.useMemo(() => {
    const len = mobileLauncherApps.length;
    const idx = mod(mobileLauncherIndex, len);
    return mobileLauncherApps[idx];
  }, [mobileLauncherApps, mobileLauncherIndex, mod]);

  React.useEffect(() => {
    if (!showLauncher || !isMobile) return;
    const root = document.documentElement;
    root.setAttribute('data-launcher-app', mobileActiveApp.theme);
    return () => {
      if (root.getAttribute('data-launcher-app') === mobileActiveApp.theme) {
        root.removeAttribute('data-launcher-app');
      }
    };
  }, [isMobile, mobileActiveApp.theme, showLauncher]);

  React.useEffect(() => {
    if (!showLauncher) return;
    const toIndex = (path: string) => {
      if (path.includes('/dtf-factory')) return 1;
      if (path.includes('/montador')) return 2;
      return 0;
    };
    setMobileLauncherIndex(toIndex(location.pathname));
  }, [location.pathname, showLauncher]);

  const toggleLauncher = React.useCallback(() => {
    const now = Date.now();
    if (now - lastToggleRef.current < 300) return;
    lastToggleRef.current = now;
    
    setShowLauncher(prev => {
      const next = !prev;
      console.log(`[Layout] toggleLauncher() -> ${next}`);
      if (next) {
        lastPathOpenedRef.current = location.pathname;
      }
      return next;
    });
  }, [location.pathname]);

  // Keyboard Shortcuts (Esc to close)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLauncher) {
        closeLauncher();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLauncher, closeLauncher]);

  // Close launcher only when the path changed from when it was opened
  React.useEffect(() => {
    if (showLauncher && location.pathname !== lastPathOpenedRef.current) {
      console.log(`[Layout] Auto-closing launcher due to navigation -> From: ${lastPathOpenedRef.current} To: ${location.pathname}`);
      closeLauncher();
    }
  }, [location.pathname, closeLauncher, showLauncher]);

  React.useEffect(() => {
    const el = document.querySelector('.ios-launcher-container') as HTMLElement | null;
    if (el) {
      if (showLauncher) {
        el.style.pointerEvents = 'auto';
        el.style.opacity = '';
      } else {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
      }
    }
  }, [showLauncher]);

  

  // Listen for toggle-launcher event from integrated apps (Montador/DTF)
  React.useEffect(() => {
    let lastEventTime = 0;
    const handler = (e: any) => {
      const now = Date.now();
      if (now - lastEventTime < 300) return; // Guard against multiple events in same frame
      lastEventTime = now;

      const forceState = e.detail?.force;
      console.log(`[Layout] Received toggle-launcher event. Force: ${forceState || 'none'}`);
      
      if (forceState === 'close') closeLauncher();
      else if (forceState === 'open') {
        lastPathOpenedRef.current = location.pathname;
        setShowLauncher(true);
      }
      else toggleLauncher();
    };
    window.addEventListener('toggle-launcher', handler);
    return () => window.removeEventListener('toggle-launcher', handler);
  }, [closeLauncher, toggleLauncher]);

  // Sync theme
  React.useEffect(() => {
    const handler = (e: any) => {
      setLauncherTheme(e.detail?.theme || 'dark');
    };
    window.addEventListener('launcher-theme-changed', handler);
    return () => window.removeEventListener('launcher-theme-changed', handler);
  }, []);

  // Sync external navigation (Web fallback for bridges)
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setShowLauncher(false);
        navigate(e.detail);
      }
    };
    window.addEventListener('OVERPIXEL_NAVIGATE', handler);
    return () => window.removeEventListener('OVERPIXEL_NAVIGATE', handler);
  }, [setShowLauncher, navigate]);

  // Ativar sincronização em tempo real (Supabase Realtime)
  useRealtimeSync();

  // Verificar se há insumos em estoque baixo (uso de <= para precisão)
  const { companyProfile } = useCompanyProfile();
  const { hasPermission } = useSession();

  const navItems = React.useMemo(() => {
    const items = staticNavItems.filter(item => hasPermission(item.permission));
    if (profile?.is_affiliate) {
      items.push({ href: '/affiliate', icon: TrendingUp, label: 'Afiliados', permission: 'view_dashboard' });
    }
    return items;
  }, [profile, hasPermission]);

  const hasLowStock = React.useMemo(() => {
    return insumos?.some(i => (i.quantidade_atual || 0) <= (i.quantidade_minima || 0));
  }, [insumos]);

  // Estado para controlar a expansão do menu lateral
  const [isExpanded, setIsExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!isExpanded) {
      setExpandDTF(false);
      setExpandLOJA(false);
      setExpandFERR(false);
    }
  }, [isExpanded]);

  // Desativa o zoom para todas as páginas dentro do Layout por padrão
  useViewportZoom(false);

  // Estado visual: ícone com círculo amarelo ativo por grupo
  const isDTFGroupActive =
    location.pathname.startsWith('/pedidos-dtf') ||
    location.pathname === '/insumos' ||
    location.pathname === '/vetorizar';
  const isLojaGroupActive =
    location.pathname.startsWith('/pedidos-loja') ||
    location.pathname.startsWith('/produtos');
  const isFerrGroupActive =
    location.pathname.startsWith('/clientes') ||
    location.pathname.startsWith('/reports') ||
    location.pathname.startsWith('/gabi');
  const circleClass = (active: boolean) =>
    cn("inline-flex items-center justify-center w-9 h-9 rounded-full", active ? "bg-[var(--primary-custom)] text-black shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "");


  
  const isFullScreenApp = ['/dtf-factory', '/montador'].includes(location.pathname);
  // Hide base shell if we are in a full-screen app or if the launcher overlay is active
  const hideShell = isFullScreenApp || showLauncher;

  const sidebarWidth = hideShell ? 'w-0 border-0 overflow-hidden opacity-0' : (isExpanded ? 'w-[280px]' : 'w-[64px]');
  const gridTemplate = hideShell ? 'grid-cols-1' : (isExpanded ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-[64px_1fr]');

  const handleLauncherAppClick = (appId: string, route?: string) => {
    console.log(`[Layout] Launcher App Clicked: ${appId} -> Routing to: ${route || 'default'}`);
    
    // Use explicit route if provided by Launcher, otherwise fallback to mapping
    const targetRoute = route || (
      appId === 'direct-ai' ? '/dashboard' :
      appId === 'dtf-factory' ? '/dtf-factory' :
      appId === 'montador' ? '/montador' :
      null
    );

    if (targetRoute) {
      closeLauncher();
      navigate(targetRoute);
    } else {
      toast({
        title: "Em breve",
        description: "Este aplicativo estará disponível na próxima atualização.",
      });
    }
  };

  return (
    <ModalQueueProvider>
    <div className={cn("grid min-h-screen w-full transition-all duration-300", gridTemplate)}>
      {/* Sidebar - Desktop (Primeira Coluna do Grid) */}
      <div
        className={cn(
          "border-r bg-sidebar transition-all duration-300 ease-in-out flex-col h-full md:sticky md:top-0 md:h-screen",
          hideShell ? "hidden" : "hidden md:flex",
          sidebarWidth
        )}
        style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 15px var(--primary-custom)' }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="flex h-full flex-col gap-2">
          {/* Header do Sidebar — Click to toggle launcher */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-4 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); toggleLauncher(); }}
              className="flex items-center gap-3 font-semibold text-sidebar-foreground hover:opacity-80 transition-all"
            >
              {/* OverPixel mini logo as sidebar trigger */}
              <svg width="32" height="20" viewBox="0 0 200 120" className="flex-shrink-0" style={{ filter: 'drop-shadow(0 0 5px var(--primary-custom))' }}>
                <circle cx="50" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="8" opacity={showLauncher ? 1 : 0.8} />
                <circle cx="150" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="8" opacity={showLauncher ? 1 : 0.8} />
              </svg>
              <span className={cn(
                "text-lg font-bold whitespace-nowrap transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                {companyProfile?.company_name || 'OVERPIXEL'}
              </span>
            </button>
          </div>

          {/* Navegação e Ferramentas */}
          <div className={cn("h-full overflow-hidden flex flex-col", isExpanded ? "p-2 lg:p-3" : "p-0")}>
            <div className="flex-1 flex items-center justify-center">
              <nav className="w-full">
                <div className={cn(
                  "text-sm font-medium w-full grid",
                  isExpanded ? "items-start gap-3" : "place-items-center gap-6"
                )}>
              {/* Dashboard */}
              <Link
                to="/dashboard"
                className={cn(
                  "flex items-center gap-4 rounded-lg py-2 transition-all duration-300 ease-in-out relative group",
                  isExpanded ? "px-3" : "px-0 justify-center",
                  location.pathname === '/dashboard'
                    ? "bg-primary text-black hover:bg-primary/90"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                )}
                style={location.pathname === '/dashboard' ? { boxShadow: '0 0 10px rgba(var(--primary), 0.3)' } : {}}
              >
                <span className={circleClass(location.pathname.startsWith('/dashboard'))}>
                  <Home className="h-5 w-5 flex-shrink-0" />
                </span>
                {isExpanded && (
                  <span className="whitespace-nowrap transition-opacity duration-300 delay-100">
                    Dashboard
                  </span>
                )}
              </Link>
              {/* Grupo DTF */}
                <div className={cn(isExpanded ? "px-2" : "px-0")}>
                <button
                  onClick={() => setExpandDTF(v => !v)}
                  className={cn(
                    "w-full flex items-center rounded-lg py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-all",
                    isExpanded ? "px-3 justify-between" : "px-0 justify-center"
                  )}
                >
                  <div className={cn("flex items-center", isExpanded ? "gap-3" : "gap-0")}>
                    <span className={circleClass(isDTFGroupActive)}>
                      <Layers className="h-5 w-5 flex-shrink-0" />
                    </span>
                    {isExpanded && (
                      <span className="text-[10px] uppercase tracking-widest font-black">DTF</span>
                    )}
                  </div>
                  {isExpanded && (
                    <ChevronRight className={cn("h-4 w-4 transition-transform", expandDTF ? "rotate-90" : "rotate-0")} />
                  )}
                </button>
                {isExpanded && expandDTF && (
                  <div className="grid gap-1">
                    <Link
                      to="/pedidos-dtf"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/pedidos-dtf'
                          ? "bg-primary text-black hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                      style={location.pathname === '/pedidos-dtf' ? { boxShadow: '0 0 10px rgba(var(--primary), 0.3)' } : {}}
                    >
                      <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Pedidos DTF</span>
                    </Link>
                    <Link
                      to="/insumos"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/insumos'
                          ? "bg-primary text-black hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                      style={location.pathname === '/insumos' ? { boxShadow: '0 0 10px rgba(var(--primary), 0.3)' } : {}}
                    >
                      <Layers className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100 flex items-center gap-2", isExpanded ? "opacity-100" : "opacity-0")}>
                        Insumos
                        {hasLowStock && <span className="ml-auto flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                      </span>
                    </Link>
                    <button
                      onClick={() => setIsCalculatorOpen(true)}
                      className="flex items-center gap-4 rounded-lg px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-300 ease-in-out relative group"
                    >
                      <Wand2 className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Calculadora DTF</span>
                    </button>
                    <Link
                      to="/vetorizar"
                      onClick={(e) => {
                        if (!(profile as any)?.is_vetoriza_ai_gifted) e.preventDefault();
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/vetorizar'
                          ? "bg-primary text-black hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]",
                        !(profile as any)?.is_vetoriza_ai_gifted && "opacity-50 grayscale-[0.5] cursor-not-allowed"
                      )}
                      style={location.pathname === '/vetorizar' ? { boxShadow: '0 0 10px rgba(var(--primary), 0.3)' } : {}}
                    >
                      <ImageIcon className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>
                        Vetoriza AI
                      </span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Grupo Loja */}
                <div className={cn(isExpanded ? "px-2" : "px-0")}>
                <button
                  onClick={() => setExpandLOJA(v => !v)}
                  className={cn(
                    "w-full flex items-center rounded-lg py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-all",
                    isExpanded ? "px-3 justify-between" : "px-0 justify-center"
                  )}
                >
                  <div className={cn("flex items-center", isExpanded ? "gap-3" : "gap-0")}>
                    <span className={circleClass(isLojaGroupActive)}>
                      <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                    </span>
                    {isExpanded && (
                      <span className="text-[10px] uppercase tracking-widest font-black">Loja</span>
                    )}
                  </div>
                  {isExpanded && (
                    <ChevronRight className={cn("h-4 w-4 transition-transform", expandLOJA ? "rotate-90" : "rotate-0")} />
                  )}
                </button>
                {isExpanded && expandLOJA && (
                  <div className="grid gap-1">
                    <Link
                      to="/pedidos-loja"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/pedidos-loja'
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Pedidos</span>
                    </Link>
                    <Link
                      to="/clientes"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/clientes' && expandLOJA
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <Users className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Clientes</span>
                    </Link>
                    <Link
                      to="/produtos"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/produtos'
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <Package className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Estoque</span>
                    </Link>
                    <Link
                      to="/erros-defeitos"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/erros-defeitos'
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Erros e Defeitos</span>
                    </Link>
                    <Link
                      to="/trocas-devolucoes"
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                        location.pathname === '/trocas-devolucoes'
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <RefreshCw className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>Trocas e Devoluções</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Itens gerais */}
                <div className={cn(isExpanded ? "px-2" : "px-0")}>
                <button
                  onClick={() => setExpandFERR(v => !v)}
                  className={cn(
                    "w-full flex items-center rounded-lg py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-all",
                    isExpanded ? "px-3 justify-between" : "px-0 justify-center"
                  )}
                >
                  <div className={cn("flex items-center", isExpanded ? "gap-3" : "gap-0")}>
                    <span className={circleClass(isFerrGroupActive)}>
                      <Settings className="h-5 w-5 flex-shrink-0" />
                    </span>
                    {isExpanded && (
                      <span className="text-[10px] uppercase tracking-widest font-black">Ferramentas</span>
                    )}
                  </div>
                  {isExpanded && (
                    <ChevronRight className={cn("h-4 w-4 transition-transform", expandFERR ? "rotate-90" : "rotate-0")} />
                  )}
                </button>
                {isExpanded && expandFERR && (
                  <div className="grid gap-1">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                            isActive
                              ? "bg-primary text-black hover:bg-primary/90"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                          )}
                          style={isActive ? { boxShadow: '0 0 10px rgba(var(--primary), 0.3)' } : {}}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}

                    {/* Color Toggle Settings for Neon */}
                    <button
                      onClick={() => {
                        const root = document.documentElement;
                        const currentCustom = getComputedStyle(root).getPropertyValue('--primary-custom').trim();
                        const isRgbMode = root.classList.contains('rgb-mode');
                        
                        // Cycle through: Cyan -> Violet -> Orange -> Emerald -> Rose -> RGB Mode -> Cyan
                        let newColor = '#00E5FF'; // default Cyan
                        let newHSL = '186 100% 50%';
                        
                        if (isRgbMode) {
                          root.classList.remove('rgb-mode');
                          newColor = '#00E5FF';
                          newHSL = '186 100% 50%';
                        } else if (currentCustom === '#00E5FF') {
                          newColor = '#8B5CF6'; // Violet
                          newHSL = '262 83% 58%';
                        } else if (currentCustom === '#8B5CF6') {
                          newColor = '#F97316'; // Orange
                          newHSL = '24 95% 53%';
                        } else if (currentCustom === '#F97316') {
                          newColor = '#10B981'; // Emerald
                          newHSL = '160 84% 39%';
                        } else if (currentCustom === '#10B981') {
                          newColor = '#E11D48'; // Rose
                          newHSL = '343 81% 50%';
                        } else if (currentCustom === '#E11D48') {
                          // Activate RGB Mode
                          root.classList.add('rgb-mode');
                          newColor = '#00E5FF'; // Base color for RGB shift
                          newHSL = '186 100% 50%';
                        }

                        root.style.setProperty('--primary-custom', newColor);
                        root.style.setProperty('--primary', newHSL);
                        localStorage.setItem('cached_primary_color', newColor);
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                      )}
                    >
                      <Palette className="h-5 w-5 flex-shrink-0" />
                      <span className={cn("whitespace-nowrap transition-opacity duration-300 delay-100", isExpanded ? "opacity-100" : "opacity-0")}>
                        Cor do Neon
                      </span>
                    </button>
                  </div>
                )}
                </div>
                </div>
              </nav>
            </div>
          </div>

          {/* App Switcher — Back to OverPixel */}
          <div className="p-2 border-t border-sidebar-border">
            <Link
              to="/"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 text-sidebar-foreground/60 hover:text-cyan-400 hover:bg-cyan-500/10 group",
                isExpanded ? "" : "justify-center"
              )}
              title="Trocar de aplicativo"
            >
              {/* Mini OverPixel logo */}
              <svg width="20" height="12" viewBox="0 0 200 120" className="flex-shrink-0">
                <circle cx="72" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="8" opacity={0.8} />
                <circle cx="128" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="8" opacity={0.8} />
              </svg>
              <span className={cn(
                "text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-opacity duration-300",
                isExpanded ? "opacity-100" : "opacity-0 w-0"
              )}>
                OverPixel
              </span>
            </Link>
          </div>

          {/* Footer do Sidebar */}
          <div className="p-4 border-t border-sidebar-border overflow-hidden">
            <p className={cn(
              "text-xs text-sidebar-foreground/50 text-center transition-opacity duration-300 delay-100",
              isExpanded ? "opacity-100" : "opacity-0"
            )}>
              Versão: {APP_VERSION}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content (Segunda Coluna do Grid) */}
      <div className="flex flex-col min-h-screen">
        <header className={cn(
          "fixed top-0 left-0 right-0 z-40 w-full border-b bg-background/80 backdrop-blur-md transition-all duration-300",
          hideShell && "translate-y-[-100%] opacity-0 pointer-events-none"
        )} style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 15px var(--primary-custom)' }}>
          {/* Safe Area Spacer for iOS/Mobile */}
          <div className="h-safe-top pt-safe" />

          <div className="flex h-14 items-center gap-4 px-4 lg:h-[60px] lg:px-6">
            <button
              onClick={(e) => { e.stopPropagation(); toggleLauncher(); }}
              className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
            >
              <svg width="28" height="17" viewBox="0 0 200 120" className="flex-shrink-0" style={{ filter: 'drop-shadow(0 0 5px var(--primary-custom))' }}>
                <circle cx="50" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="9" opacity={0.8} />
                <circle cx="150" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="9" opacity={0.8} />
              </svg>
              <span className="tracking-tighter font-black italic">
                {companyProfile?.company_name || 'DIRECT AI'}
              </span>
            </button>


            <div className="w-full flex-1" />

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </header>

        {/* Global Spacers to prevent content from going under the fixed header */}
        {!hideShell && (
          <>
            <div className="h-14 lg:h-[60px]" />
            <div className="h-safe-top pt-safe" />
          </>
        )}

        <SubscriptionAlert />
        <AIFirstOnboarding />

        <main className={cn(
          "relative flex flex-col flex-1 h-full overflow-x-hidden overflow-y-auto transition-all duration-300",
          !hideShell ? "md:pt-[60px] pt-14" : "pt-0",
          (location.pathname === '/' || location.pathname === '/dashboard' || isFullScreenApp) ? "p-0 gap-0" : "gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-6 lg:p-6"
        )}>
          {/* Layer 1: Traditional Router Outlet (Standard Pages) */}
          <AnimatePresence mode="wait">
              {!PERSISTENT_APP_ROUTES.includes(location.pathname) && (
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.04, y: -10 }}
                  transition={{ 
                    duration: 0.6, 
                    ease: [0.16, 1, 0.3, 1],
                    opacity: { duration: 0.4 }
                  }}
                  className="flex flex-col flex-1 w-full h-full"
                >
                  <Outlet />
                </motion.div>
              )}
          </AnimatePresence>

          {/* Layer 2: Persistent App Instance (DTF Factory) */}
          {visitedPersistentApps.has('/dtf-factory') && (
            <div className={cn(
              "flex-col flex-1 w-full h-full",
              location.pathname !== '/dtf-factory' && "hidden pointer-events-none invisible h-0 overflow-hidden"
            )}>
              <React.Suspense fallback={null}>
                <DTFFactory />
              </React.Suspense>
            </div>
          )}

          {/* Layer 3: Persistent App Instance (Montador) */}
          {visitedPersistentApps.has('/montador') && (
            <div className={cn(
              "flex-col flex-1 w-full h-full",
              isMobile && location.pathname === '/montador' && "pt-14",
              location.pathname !== '/montador' && "hidden pointer-events-none invisible h-0 overflow-hidden"
            )}>
              <React.Suspense fallback={null}>
                <MontadorPage />
              </React.Suspense>
            </div>
          )}
        </main>
        {isMobile && location.pathname === '/montador' && (
          <div className="fixed top-0 left-0 right-0 z-[60] h-14 px-4 flex items-center justify-between pointer-events-auto bg-black/55 backdrop-filter backdrop-blur-xl border-b border-orange-500/25 shadow-[0_0_22px_rgba(255,106,0,0.18)]">
            <button
              onClick={(e) => { e.stopPropagation(); toggleLauncher(); }}
              className="flex items-center gap-2"
              title="Abrir menu de aplicativos"
            >
              <img
                src="/montador/logo-montador-fast.png"
                alt="Montador"
                className="w-7 h-7 rounded-lg object-contain"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
              <span className="text-sm font-black tracking-wide text-white/85">MONTADOR</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleLauncher(); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
              title="Abrir menu de aplicativos"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(255,106,0,0.6)] animate-pulse" />
              <span className="text-xs font-bold text-white/80 tabular-nums">
                {(profile as any)?.ai_credits ?? 0}
              </span>
              <span className="text-[10px] font-black tracking-widest text-white/35 uppercase">
                TOKENS
              </span>
            </button>
          </div>
        )}
        {!hideShell && location.pathname !== '/settings' && !(isMobile && location.pathname === '/montador') && (
          <MobileBottomNav
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            onOpenVetorizador={() => setIsVetorizadorOpen(true)}
          />
        )}
      </div>

      {!hideShell && (
        <>
          <AILowStockAlert />
          <AIAssistant />
        </>
      )}
      <CommandMenu />
      <GiftPlanModal />
      <GiftVetorizaModal />
      <DTFCalculatorModal
        isOpen={isCalculatorOpen}
              onClose={() => setIsCalculatorOpen(false)}
      />
      <VetorizadorModal
        isOpen={isVetorizadorOpen}
        onClose={() => setIsVetorizadorOpen(false)}
      />

      <TaskDock />
      <ActivityTracker />
      
      {/* Sistema de Perfis Estilo Netflix */}
      {/* Se não houver subperfil ativo, mostramos o seletor */}
      {!activeSubProfile && (
        <ProfileSelector />
      )}

      {!isOpen && !isMobile && (
        <button
          className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-[0_0_30px_rgba(255,165,0,0.4)] z-50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden group"
          onClick={openAIAssistant}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60 animate-gradient-slow" />

          {/* Subtle Glass Overlay */}
          <div className="absolute inset-0.5 rounded-full bg-black/10 backdrop-blur-[2px] border border-white/20" />

          <Sparkles className="h-8 w-8 text-white relative z-10 transition-transform group-hover:rotate-12" />

          {/* Notification Dot */}
          <div className="absolute top-3 right-3 h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-zinc-950 z-20 animate-pulse" />
        </button>
      )}

      {/* OverPixel Launcher Frame — Consolidated 2026 */}
      <AnimatePresence>
        {showLauncher && (
          <motion.div 
            className="fixed inset-0 z-[9990] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Background Blur Overlay (Click outside to close) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLauncher}
              className="fixed inset-0 z-[9991] bg-transparent backdrop-filter blur-md pointer-events-auto"
            />

            {isMobile && (
              <OverPixelLauncher
                mode="mobileOverlay"
                activeAppOverride={mobileActiveApp.theme}
              />
            )}

            {/* Top Bar Framework */}
            <motion.div
              className={cn(
                "fixed top-0 left-0 right-0 z-[9992] h-16 flex items-center justify-between px-6 launcher-top-bar pointer-events-auto",
                launcherTheme === 'light' ? 'launcher-bar-glass-light' : 'launcher-bar-glass-dark'
              )}
              initial={{ y: -64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -64, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Left — Logo + Brand */}
              <div className="flex items-center gap-3">
                <svg width="36" height="22" viewBox="0 0 200 120" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}>
                  <circle cx="50" cy="60" r="34" fill="none" stroke="#00F0FF" strokeWidth="7" />
                  <circle cx="150" cy="60" r="34" fill="none" stroke="#00F0FF" strokeWidth="7" />
                </svg>
                <span className="text-sm font-light tracking-[0.4em] text-cyan-400/80 uppercase hidden sm:inline">OverPixel</span>
              </div>

              {/* Center / Right — Credits + Profile + Close */}
              <div className="flex items-center gap-4">
                {/* Credits / Moeda OverPixel */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/15 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors cursor-pointer group" title="Créditos OverPixel">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 border border-cyan-400/30 group-hover:border-cyan-400/50 transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                    <svg width="12" height="8" viewBox="0 0 200 120">
                      <circle cx="50" cy="60" r="38" fill="none" stroke="#00F0FF" strokeWidth="12" />
                      <circle cx="150" cy="60" r="38" fill="none" stroke="#00F0FF" strokeWidth="12" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-cyan-300/80 tabular-nums">
                    {(profile as any)?.token_balance ?? (profile as any)?.ai_credits ?? 0}
                  </span>
                  <span className="text-[9px] font-bold tracking-wider text-cyan-400/40 uppercase hidden sm:inline">CRÉDITOS IA</span>
                </div>

                {/* Profile */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer" title={activeSubProfile?.name || profile?.first_name || 'Perfil'}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/80">
                    {(activeSubProfile?.name || profile?.first_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-white/50 hidden sm:inline max-w-[100px] truncate">
                    {activeSubProfile?.name || profile?.first_name || 'Usuário'}
                  </span>
                </div>

                {/* Close */}
                <button
                  onClick={closeLauncher}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            {!isMobile && (
              <div className="z-[9995] pointer-events-auto">
                <OverPixelLauncher 
                  isOpen={showLauncher} 
                  onClose={closeLauncher}
                  onAppClick={handleLauncherAppClick}
                  isInline={true}
                  showSettings={showLauncherSettings}
                  glassTone={glassTone}
                  onToneChange={setGlassTone}
                  glassOpacity={glassOpacity}
                  onOpacityChange={setGlassOpacity}
                  isSidebarExpanded={isExpanded}
                />
              </div>
            )}

            {/* Left Sidebar — Launcher Icons Framework */}
            {!isMobile && (
              <motion.div
                className={cn(
                  "fixed top-16 left-0 bottom-0 z-[9993] w-[80px] flex flex-col items-center py-6 gap-2 launcher-side-bar pointer-events-auto",
                  launcherTheme === 'light' ? 'launcher-bar-glass-light' : 'launcher-bar-glass-dark'
                )}
                initial={{ x: -80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -80, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              >
                <div className="flex flex-col items-center gap-4 mt-2">
                  <motion.button 
                    onClick={() => handleLauncherAppClick('direct-ai')}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all group relative"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    title="Direct AI — Gabi"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center border border-fuchsia-500/30 bg-fuchsia-500/10 group-hover:border-fuchsia-500/50 group-hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all">
                      <GabiAvatar mood="idle" size={32} />
                    </div>
                  </motion.button>

                  <motion.button 
                    onClick={() => handleLauncherAppClick('dtf-factory')}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all ios-side-widget-blink"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                    title="DTF Factory"
                  >
                    <img 
                      src="/dtf-fabric-logo.png" 
                      alt="DTF Factory" 
                      className="w-11 h-11 object-contain" 
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </motion.button>

                  <motion.button 
                    onClick={() => handleLauncherAppClick('montador')}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all ios-side-widget-blink"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                    title="O Montador"
                  >
                    <img 
                      src="/montador/logo-montador-fast.png" 
                      alt="O Montador" 
                      className="w-11 h-11 object-contain" 
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </motion.button>
                </div>

                <div className="flex-1" />
              </motion.div>
            )}

            {isMobile && (
              <motion.div
                className={cn(
                  "fixed left-0 right-0 bottom-0 z-[9993] h-24 px-6 launcher-bottom-bar pointer-events-auto flex items-center justify-center",
                  launcherTheme === 'light' ? 'launcher-bar-glass-light' : 'launcher-bar-glass-dark'
                )}
                initial={{ y: 96, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 96, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              >
                <motion.div
                  className="flex items-center justify-center gap-6 select-none touch-pan-y"
                  drag="x"
                  style={{ x: mobileCarouselX }}
                  dragControls={mobileCarouselDragControls}
                  dragListener={false}
                  dragConstraints={{ left: -120, right: 120 }}
                  dragElastic={0.35}
                  dragMomentum={false}
                  onPointerDownCapture={(e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    mobileCarouselPointerStartRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerMoveCapture={(e) => {
                    if (isMobileCarouselDraggingRef.current) return;
                    const start = mobileCarouselPointerStartRef.current;
                    if (!start) return;
                    const dx = e.clientX - start.x;
                    const dy = e.clientY - start.y;
                    if (Math.abs(dx) + Math.abs(dy) < 10) return;
                    mobileCarouselPointerStartRef.current = null;
                    mobileCarouselDragControls.start(e);
                  }}
                  onPointerUpCapture={() => {
                    mobileCarouselPointerStartRef.current = null;
                  }}
                  onDragStart={() => {
                    isMobileCarouselDraggingRef.current = true;
                  }}
                  onDragEnd={(_, info) => {
                    const swipe = info.offset.x + info.velocity.x * 0.2;
                    const threshold = 70;
                    const dir = swipe < -threshold ? 1 : swipe > threshold ? -1 : 0;
                    if (dir !== 0) {
                      const nextIndex = mobileLauncherIndex + dir;
                      setMobileLauncherIndex(nextIndex);
                      const nextApp = mobileLauncherApps[mod(nextIndex, mobileLauncherApps.length)];
                      if (nextApp.route) {
                        navigate(nextApp.route);
                      } else {
                        toast({
                          title: "Em breve",
                          description: "Este aplicativo estará disponível na próxima atualização.",
                        });
                      }
                    }
                    animate(mobileCarouselX, 0, { type: "spring", stiffness: 360, damping: 30 });
                    window.setTimeout(() => {
                      isMobileCarouselDraggingRef.current = false;
                    }, 80);
                  }}
                >
                  {[-1, 0, 1].map((delta) => {
                    const len = mobileLauncherApps.length;
                    const idx = ((mobileLauncherIndex + delta) % len + len) % len;
                    const app = mobileLauncherApps[idx];
                    const isActive = delta === 0;
                    return (
                      <motion.button
                        key={`${app.id}-${idx}-${delta}`}
                        onClick={() => {
                          if (isMobileCarouselDraggingRef.current) return;
                          if (isActive) {
                            if (app.route) {
                              navigate(app.route);
                              closeLauncher();
                              return;
                            }
                            toast({
                              title: "Em breve",
                              description: "Este aplicativo estará disponível na próxima atualização.",
                            });
                            return;
                          }
                          const nextIndex = mobileLauncherIndex + delta;
                          setMobileLauncherIndex(nextIndex);
                          const nextApp = mobileLauncherApps[mod(nextIndex, mobileLauncherApps.length)];
                          if (nextApp.route) {
                            navigate(nextApp.route);
                          } else {
                            toast({
                              title: "Em breve",
                              description: "Este aplicativo estará disponível na próxima atualização.",
                            });
                          }
                        }}
                        className={cn(
                          "w-20 h-20 rounded-3xl flex items-center justify-center transition-all",
                          isActive ? "bg-white/10 border border-white/10" : "bg-white/5 border border-white/5"
                        )}
                        animate={{ scale: isActive ? 1 : 0.86, opacity: isActive ? 1 : 0.7 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        title={app.id}
                      >
                        {app.iconType === 'svg' ? (
                          <svg width="48" height="28" viewBox="0 0 200 120" style={{ filter: 'drop-shadow(0 0 10px var(--primary-custom))' }}>
                            <circle cx="50" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="8" />
                            <circle cx="150" cy="60" r="34" fill="none" stroke="var(--primary-custom)" strokeWidth="8" />
                          </svg>
                        ) : (
                          <img
                            src={app.iconSrc}
                            alt={app.id}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            className="w-14 h-14 object-contain select-none"
                            style={{ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ModalQueueProvider>
  );
};

export default Layout;
