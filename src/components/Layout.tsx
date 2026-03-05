import * as React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare, Layers, Sparkles, Image as ImageIcon, Bot, Truck } from 'lucide-react';
import { AIAssistant } from './AIAssistant';
import { ThemeToggle } from './ThemeToggle';
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
import { ActivityTracker } from './ActivityTracker';
const staticNavItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { href: '/clientes', icon: Users, label: 'Clientes' },
  { href: '/produtos', icon: Package, label: 'Produtos' },
  { href: '/vetorizar', icon: Sparkles, label: 'Vetorizar Logo' },
  { href: '/insumos', icon: Layers, label: 'Insumos' },
  { href: '/reports', icon: BarChart3, label: 'Relatórios' },
  { href: '/logistica', icon: Truck, label: 'Logística' },
  { href: '/gabi', icon: Bot, label: 'Gabi' },
];

const Layout = () => {
  const { isOpen, open: openAIAssistant } = useAIAssistant();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { data: insumos } = useInsumos();
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  const [isVetorizadorOpen, setIsVetorizadorOpen] = React.useState(false);

  // Ativar sincronização em tempo real (Supabase Realtime)
  useRealtimeSync();

  // Verificar se há insumos em estoque baixo (uso de <= para precisão)
  const { companyProfile } = useCompanyProfile();
  const { profile } = useAuth();

  const navItems = React.useMemo(() => {
    const items = [...staticNavItems];
    if (profile?.is_affiliate) {
      items.push({ href: '/affiliate', icon: TrendingUp, label: 'Afiliados' });
    }
    return items;
  }, [profile]);

  const hasLowStock = React.useMemo(() => {
    return insumos?.some(i => (i.quantidade_atual || 0) <= (i.quantidade_minima || 0));
  }, [insumos]);

  // Estado para controlar a expansão do menu lateral
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Desativa o zoom para todas as páginas dentro do Layout por padrão
  useViewportZoom(false);

  const sidebarWidth = isExpanded ? 'w-[280px]' : 'w-[64px]';
  const gridTemplate = isExpanded ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-[64px_1fr]';

  return (
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
          {/* Header do Sidebar */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-4 overflow-hidden">
            <Link to="/dashboard" className="flex items-center gap-3 font-semibold text-sidebar-foreground">
              {companyProfile?.company_logo_url ? (
                <img src={companyProfile.company_logo_url} alt="Company Logo" className="h-8 w-8 object-contain flex-shrink-0" />
              ) : (
                <img src="/logo.png" alt="Direct DTF Logo" className="h-8 w-8 flex-shrink-0" />
              )}
              <span className={cn(
                "text-lg font-bold whitespace-nowrap transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                {companyProfile?.company_name || 'DIRECT AI'}
              </span>
            </Link>
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
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
              {companyProfile?.company_logo_url ? (
                <img src={companyProfile.company_logo_url} alt="Company Logo" className="h-8 w-8 object-contain" />
              ) : (
                <img src="/logo.png" alt="Direct AI Logo" className="h-8 w-8" />
              )}
              <span className="tracking-tighter font-black italic">
                {companyProfile?.company_name || 'DIRECT AI'}
              </span>
            </Link>


            <div className="w-full flex-1" />

            <div className="flex items-center gap-2">
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
          <MobileBottomNav onOpenCalculator={() => setIsCalculatorOpen(true)} />
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
    </div>
  );
};

export default Layout;