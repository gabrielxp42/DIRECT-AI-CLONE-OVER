import * as React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare, Layers, Sparkles, Image as ImageIcon, Bot, Truck, Grid2x2, X, LayoutGrid, CloudCog, Wand2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
import OverPixelLauncher from '@/pages/OverPixelLauncher';

const staticNavItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', permission: 'view_dashboard' },
  { href: '/pedidos', icon: ShoppingCart, label: 'Pedidos', permission: 'view_pedidos' },
  { href: '/clientes', icon: Users, label: 'Clientes', permission: 'view_clientes' },
  { href: '/produtos', icon: Package, label: 'Produtos', permission: 'view_produtos' },
  { href: '/insumos', icon: Layers, label: 'Insumos', permission: 'view_insumos' },
  { href: '/reports', icon: BarChart3, label: 'Relatórios', permission: 'view_reports' },
  { href: '/logistica', icon: Truck, label: 'Logística', permission: 'view_logistica' },
  { href: '/gabi', icon: Bot, label: 'Gabi', permission: 'view_gabi' },
  { href: '/vetorizar', icon: ImageIcon, label: 'Vetorizar', permission: 'view_vetorizar' },
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

  // Listen for open-vetorizador event (e.g. from GiftVetorizaModal)
  React.useEffect(() => {
    const handler = () => setIsVetorizadorOpen(true);
    window.addEventListener('open-vetorizador', handler);
    return () => window.removeEventListener('open-vetorizador', handler);
  }, []);

  // Close launcher on navigation
  React.useEffect(() => {
    setShowLauncher(false);
  }, [location.pathname]);

  // Click outside to close launcher
  const launcherRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!showLauncher) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setShowLauncher(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLauncher]);

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

  // Desativa o zoom para todas as páginas dentro do Layout por padrão
  useViewportZoom(false);

  const sidebarWidth = isExpanded ? 'w-[280px]' : 'w-[64px]';
  const gridTemplate = isExpanded ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-[64px_1fr]';

  const handleLauncherAppClick = (appId: string) => {
    if (appId === 'direct-ai') {
      navigate('/dashboard');
      setShowLauncher(false);
    } else if (appId === 'montador') {
      navigate('/montador');
      setShowLauncher(false);
    } else {
      toast({
        title: '🚧 Em Construção',
        description: 'Este aplicativo está sendo desenvolvido. Em breve!',
        duration: 3000,
      });
    }
  };

  return (
    <ModalQueueProvider>
    <div className={cn("grid min-h-screen w-full transition-all duration-300", gridTemplate)}>
      {/* Sidebar - Desktop (Primeira Coluna do Grid) */}
      <div
        className={cn(
          "hidden border-r bg-sidebar transition-all duration-300 ease-in-out md:flex flex-col h-full shadow-lg hover:shadow-xl",
          sidebarWidth
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="flex h-full flex-col gap-2">
          {/* Header do Sidebar — Click to toggle launcher */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-4 overflow-hidden">
            <button
              onClick={() => setShowLauncher(!showLauncher)}
              className="flex items-center gap-3 font-semibold text-sidebar-foreground hover:opacity-80 transition-all"
            >
              {/* OverPixel mini logo as sidebar trigger */}
              <svg width="32" height="20" viewBox="0 0 200 120" className="flex-shrink-0">
                <circle cx="72" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="8" opacity={showLauncher ? 1 : 0.6} />
                <circle cx="128" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="8" opacity={showLauncher ? 1 : 0.6} />
              </svg>
              <span className={cn(
                "text-lg font-bold whitespace-nowrap transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                {companyProfile?.company_name || 'DIRECT AI'}
              </span>
            </button>
          </div>

          {/* Navegação e Ferramentas */}
          <div className="flex-1 overflow-y-auto p-2 lg:p-3">
            <nav className="grid items-start gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                const isInsumos = item.href === '/insumos';

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={(e) => {
                      if (item.href === '/vetorizar' && !(profile as any)?.is_vetoriza_ai_gifted) {
                        e.preventDefault();
                      }
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]",
                      item.href === '/vetorizar' && !(profile as any)?.is_vetoriza_ai_gifted && "opacity-50 grayscale-[0.5] cursor-not-allowed"
                    )}
                  >
                    <div className="relative">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {isInsumos && hasLowStock && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white dark:border-slate-900"></span>
                        </span>
                      )}
                    </div>

                    <span className={cn(
                      "whitespace-nowrap transition-opacity duration-300 delay-100 flex items-center gap-2",
                      isExpanded ? "opacity-100" : "opacity-0"
                    )}>
                      {item.label}
                      {item.href === '/vetorizar' && isExpanded && !(profile as any)?.is_vetoriza_ai_gifted && (
                        <span className="text-[7px] bg-primary/20 text-primary-foreground px-1 rounded font-bold">BREVE</span>
                      )}
                      {isInsumos && hasLowStock && isExpanded && (
                        <span className="ml-auto flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Seção de Ferramentas Dinâmica - Desktop */}
            <SidebarShortcuts
              isExpanded={isExpanded}
              onOpenCalculator={() => setIsCalculatorOpen(true)}
              onOpenVetorizador={() => setIsVetorizadorOpen(true)}
            />
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
      <div className="flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-40 w-full border-b bg-background/80 backdrop-blur-md transition-all duration-300">
          {/* Safe Area Spacer for iOS/Mobile */}
          <div className="h-safe-top pt-safe" />

          <div className="flex h-14 items-center gap-4 px-4 lg:h-[60px] lg:px-6">
            <button
              onClick={() => setShowLauncher(!showLauncher)}
              className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
            >
              <svg width="28" height="17" viewBox="0 0 200 120" className="flex-shrink-0">
                <circle cx="72" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="9" opacity={0.8} />
                <circle cx="128" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="9" opacity={0.8} />
              </svg>
              <span className="tracking-tighter font-black italic">
                {companyProfile?.company_name || 'DIRECT AI'}
              </span>
            </button>


            <div className="w-full flex-1" />

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors group"
                title="Trocar de aplicativo"
              >
                <svg width="18" height="11" viewBox="0 0 200 120" className="text-muted-foreground group-hover:text-cyan-400 transition-colors">
                  <circle cx="72" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="9" />
                  <circle cx="128" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="9" />
                </svg>
              </Link>
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </header>

        {/* Global Spacers to prevent content from going under the fixed header */}
        <div className="h-14 lg:h-[60px]" />
        <div className="h-safe-top pt-safe" />

        <SubscriptionAlert />

        <main className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-6 lg:p-6 w-full max-w-[100vw] overflow-x-hidden">
          <Outlet />
        </main>
        {location.pathname !== '/settings' && (
          <MobileBottomNav
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            onOpenVetorizador={() => setIsVetorizadorOpen(true)}
          />
        )}
      </div>

      <AILowStockAlert />
      <AIAssistant />
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
      {profile?.is_multi_profile_enabled && !activeSubProfile && (
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

      {/* OverPixel Launcher Frame — Top bar + Left sidebar expanding around content */}
      <AnimatePresence>
        {showLauncher && (
          <>
            {/* Backdrop — dims the content behind */}
            <motion.div
              className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowLauncher(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />

            {/* Top Bar */}
            <motion.div
              className="fixed top-0 left-0 right-0 z-[9992] h-16 flex items-center justify-between px-6"
              style={{
                background: 'rgba(8, 8, 18, 0.92)',
                backdropFilter: 'blur(30px)',
                borderBottom: '1px solid rgba(6, 182, 212, 0.12)',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
              }}
              initial={{ y: -64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -64, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Left — Logo + Brand */}
              <div className="flex items-center gap-3">
                <svg width="36" height="22" viewBox="0 0 200 120" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}>
                  <circle cx="72" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="7" />
                  <circle cx="128" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="7" />
                </svg>
                <span className="text-sm font-light tracking-[0.4em] text-cyan-400/80 uppercase hidden sm:inline">OverPixel</span>
              </div>

              {/* Center / Right — Credits + Profile + Close */}
              <div className="flex items-center gap-4">
                {/* Credits / Moeda OverPixel */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/15 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors cursor-pointer group" title="Créditos OverPixel">
                  {/* Custom coin icon — mini OverPixel logo as coin */}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 border border-cyan-400/30 group-hover:border-cyan-400/50 transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                    <svg width="12" height="8" viewBox="0 0 200 120">
                      <circle cx="72" cy="60" r="38" fill="none" stroke="#67e8f9" strokeWidth="12" />
                      <circle cx="128" cy="60" r="38" fill="none" stroke="#67e8f9" strokeWidth="12" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-cyan-300/80 tabular-nums">
                    {(profile as any)?.credits ?? 0}
                  </span>
                  <span className="text-[9px] font-bold tracking-wider text-cyan-400/40 uppercase hidden sm:inline">OPX</span>
                </div>

                {/* Profile */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer" title={profile?.full_name || 'Perfil'}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/80">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-medium text-white/50 hidden sm:inline max-w-[100px] truncate">
                    {profile?.full_name || 'Usuário'}
                  </span>
                </div>

                {/* Close */}
                <button
                  onClick={() => setShowLauncher(false)}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            <OverPixelLauncher 
              isOpen={showLauncher} 
              onClose={() => setShowLauncher(false)}
              onAppClick={handleLauncherAppClick}
              ref={launcherRef}
            />

            {/* Left Sidebar — App Icons */}
            <motion.div
              className="fixed top-16 left-0 bottom-0 z-[9991] w-[80px] flex flex-col items-center py-6 gap-2"
              style={{
                background: 'rgba(8, 8, 18, 0.92)',
                backdropFilter: 'blur(30px)',
                borderRight: '1px solid rgba(6, 182, 212, 0.08)',
                boxShadow: '4px 0 30px rgba(0, 0, 0, 0.3)',
              }}
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            >
              {/* Direct AI (Gabi) */}
              <motion.button
                onClick={() => handleLauncherAppClick('direct-ai')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all group relative"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                title="Direct AI — Gabi"
              >
                {/* Active dot */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]" />
                <div className="w-12 h-12 rounded-full flex items-center justify-center border border-fuchsia-500/30 bg-fuchsia-500/10 group-hover:border-fuchsia-500/50 group-hover:shadow-[0_0_20px_rgba(217,70,239,0.2)] transition-all">
                  <GabiAvatar mood="idle" size={32} />
                </div>
                <span className="text-[9px] font-bold text-white/50 group-hover:text-white/80 transition-colors tracking-wide">Gabi</span>
              </motion.button>

              {/* Separator */}
              <div className="w-8 h-px bg-white/5 my-1" />

              {/* DTF Factory */}
              <motion.button
                onClick={() => handleLauncherAppClick('dtf-factory')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                title="DTF Factory — Em breve"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center border border-amber-500/20 bg-amber-500/5 group-hover:border-amber-500/35 transition-all opacity-50 group-hover:opacity-75">
                  <Layers className="w-5 h-5 text-amber-400/60" />
                </div>
                <span className="text-[9px] font-bold text-white/30 group-hover:text-white/50 transition-colors tracking-wide">DTF</span>
              </motion.button>

              {/* O Montador */}
              <motion.button
                onClick={() => handleLauncherAppClick('montador')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                title="O Montador — Builder de Layouts"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center border border-violet-500/30 bg-violet-500/10 group-hover:border-violet-500/50 transition-all">
                  <LayoutGrid className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-[9px] font-bold text-white/50 group-hover:text-white/80 transition-colors tracking-wide">Montador</span>
              </motion.button>

              {/* Melhorador Cloud */}
              <motion.button
                onClick={() => handleLauncherAppClick('melhorador')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                title="Melhorador Cloud — Em breve"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center border border-sky-500/20 bg-sky-500/5 group-hover:border-sky-500/35 transition-all opacity-50 group-hover:opacity-75">
                  <Wand2 className="w-5 h-5 text-sky-400/60" />
                </div>
                <span className="text-[9px] font-bold text-white/30 group-hover:text-white/50 transition-colors tracking-wide">Cloud</span>
              </motion.button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Home / Launcher */}
              <motion.button
                onClick={() => { navigate('/'); setShowLauncher(false); }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-cyan-500/10 transition-all group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                title="OverPixel Launcher"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center border border-cyan-500/15 bg-cyan-500/5 group-hover:border-cyan-500/30 transition-all">
                  <Home className="w-5 h-5 text-cyan-400/50 group-hover:text-cyan-400/80 transition-colors" />
                </div>
                <span className="text-[9px] font-bold text-cyan-400/30 group-hover:text-cyan-400/60 transition-colors tracking-wide">Home</span>
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </ModalQueueProvider>
  );
};

export default Layout;