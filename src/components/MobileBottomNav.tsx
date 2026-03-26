import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, User, Plus, BarChart3, MessageSquare, Settings2, Layers, Truck, Bot, Sparkles, TrendingUp, AlertCircle, RefreshCw, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { useShortcuts } from '@/hooks/useShortcuts';
import { ShortcutSelectionModal } from './ShortcutSelectionModal';
import { useInsumos } from '@/hooks/useDataFetch';
import { useAuth } from '@/hooks/useAuth';

type MenuType = 'create' | 'loja' | 'dtf' | 'ferramentas';

export const MobileBottomNav = ({
  onOpenCalculator,
  onOpenVetorizador
}: {
  onOpenCalculator?: () => void;
  onOpenVetorizador?: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuType>('create');
  
  const { open: openAIChat } = useAIAssistant();
  const { activeShortcuts, handleShortcutAction, definitions } = useShortcuts(onOpenCalculator);
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const { profile } = useAuth();
  const { data: insumos } = useInsumos();

  const hasLowStock = useMemo(() => {
    return insumos?.some(i => (i.quantidade_atual || 0) <= (i.quantidade_minima || 0));
  }, [insumos]);

  const systemModules = useMemo(() => {
    const modules = [
      { id: 'insumos', label: 'Insumos', icon: Layers, href: '/insumos', alert: hasLowStock },
      { id: 'logistica', label: 'Logística', icon: Truck, href: '/logistica' },
      { id: 'gabi', label: 'Gabi AI', icon: Bot, href: '/gabi' },
      { id: 'vetoriza', label: 'Vetoriza AI', icon: Sparkles, href: '/vetorizar', important: true },
      { id: 'reports', label: 'Relatórios', icon: BarChart3, href: '/reports' },
    ];

    if (profile?.is_affiliate) {
      modules.push({ id: 'affiliate', label: 'Afiliados', icon: TrendingUp, href: '/affiliate' });
    }

    modules.push({ id: 'settings', label: 'Ajustes', icon: Settings2, href: '/settings' });

    return modules;
  }, [profile, hasLowStock]);

  const openMenu = (menu: MenuType) => {
    setActiveMenu(menu);
    setIsSheetOpen(true);
  };

  const handleMobileAction = (id: string) => {
    setIsSheetOpen(false);
    handleShortcutAction(id);
  };

  const renderSheetContent = () => {
    switch (activeMenu) {
      case 'create':
        return (
          <div className="p-6 pt-12">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold tracking-tight text-foreground">O que vamos criar hoje?</SheetTitle>
            </SheetHeader>
            <div className="grid gap-6">
              <Button
                size="lg"
                className="w-full h-20 bg-primary hover:brightness-110 text-primary-foreground font-black text-xl rounded-3xl shadow-[0_15px_35px_var(--primary-custom)]/30 border-none gap-4 group transition-all active:scale-95"
                onClick={() => handleMobileAction('new_pedido')}
              >
                <div className="bg-black/10 p-3 rounded-2xl group-hover:bg-black/20 transition-colors">
                  <ShoppingCart className="h-7 w-7" />
                </div>
                CRIAR NOVO PEDIDO
              </Button>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">Acesso Rápido</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {activeShortcuts
                    .filter(id => id !== 'new_pedido')
                    .map((id) => {
                      const config = definitions[id];
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <Button
                          key={id}
                          variant="ghost"
                          className="flex flex-col h-20 gap-2 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-90 transition-all group"
                          onClick={() => handleMobileAction(id)}
                        >
                          <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-primary/10 transition-colors">
                            <Icon className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <span className="text-[10px] font-bold text-foreground/70 group-hover:text-foreground line-clamp-1">{config.label}</span>
                        </Button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        );
      case 'loja':
        return (
          <div className="p-6 pt-12">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <ShoppingCart className="h-6 w-6 text-primary" />
                Loja Virtual
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/pedidos-loja'); }}>
                <Box className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">Pedidos</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/clientes'); }}>
                <User className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">Clientes</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/produtos'); }}>
                <Package className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">Estoque</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/erros-defeitos'); }}>
                <AlertCircle className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Erros<br/>Defeitos</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-20 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all col-span-2" onClick={() => { setIsSheetOpen(false); navigate('/trocas-devolucoes'); }}>
                <RefreshCw className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">Trocas e Devoluções</span>
              </Button>
            </div>
          </div>
        );
      case 'dtf':
        return (
          <div className="p-6 pt-12">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <Layers className="h-6 w-6 text-primary" />
                DTF
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/pedidos-dtf'); }}>
                <ShoppingCart className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Pedidos<br/>DTF</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all relative" onClick={() => { setIsSheetOpen(false); navigate('/insumos'); }}>
                <div className="relative">
                  <Layers className="h-6 w-6 text-primary" />
                  {hasLowStock && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-zinc-950"></span></span>}
                </div>
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Insumos</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); if(onOpenCalculator) onOpenCalculator(); }}>
                <BarChart3 className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Calculadora<br/>DTF</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all border-primary/30 bg-primary/5" onClick={() => { setIsSheetOpen(false); if(onOpenVetorizador) onOpenVetorizador(); }}>
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Vetoriza<br/>AI</span>
              </Button>
            </div>
          </div>
        );
      case 'ferramentas':
        return (
          <div className="p-6 pt-12">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <Settings2 className="h-6 w-6 text-primary" />
                Ferramentas
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/reports'); }}>
                <BarChart3 className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Relatórios</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); navigate('/settings'); }}>
                <Settings2 className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Configurações</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => { setIsSheetOpen(false); openAIChat(); }}>
                <Bot className="h-6 w-6 text-primary" />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Gabi</span>
              </Button>
              <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all" onClick={() => {
                setIsSheetOpen(false);
                const root = document.documentElement;
                const currentCustom = getComputedStyle(root).getPropertyValue('--primary-custom').trim();
                const isRgbMode = root.classList.contains('rgb-mode');
                let newColor = '#00E5FF';
                let newHSL = '186 100% 50%';
                if (isRgbMode) { root.classList.remove('rgb-mode'); }
                else if (currentCustom === '#00E5FF') { newColor = '#8B5CF6'; newHSL = '262 83% 58%'; }
                else if (currentCustom === '#8B5CF6') { newColor = '#F97316'; newHSL = '24 95% 53%'; }
                else if (currentCustom === '#F97316') { newColor = '#10B981'; newHSL = '160 84% 39%'; }
                else if (currentCustom === '#10B981') { newColor = '#E11D48'; newHSL = '343 81% 50%'; }
                else if (currentCustom === '#E11D48') { root.classList.add('rgb-mode'); newColor = '#00E5FF'; newHSL = '186 100% 50%'; }
                root.style.setProperty('--primary-custom', newColor);
                root.style.setProperty('--primary', newHSL);
                localStorage.setItem('cached_primary_color', newColor);
              }}>
                <div className="h-6 w-6 rounded-full border-2 border-primary" style={{ background: 'conic-gradient(from 0deg, #00E5FF, #8B5CF6, #F97316, #10B981, #E11D48, #00E5FF)' }} />
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Cor do<br/>Neon</span>
              </Button>
              {profile?.is_affiliate && (
                <Button variant="ghost" className="flex flex-col h-24 gap-3 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl active:scale-95 transition-all col-span-2" onClick={() => { setIsSheetOpen(false); navigate('/affiliate'); }}>
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider text-center">Afiliados</span>
                </Button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 min-h-16 h-auto pb-safe ios-glass border-t border-white/10 z-40">
        <div className="flex justify-around items-center h-16 relative px-2">
          
          <button onClick={() => navigate('/dashboard')} className={cn('flex flex-col items-center justify-center gap-1.5 font-medium h-full w-[20%] active:scale-95 transition-transform', location.pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground')}>
            <Home className="h-[22px] w-[22px]" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Início</span>
          </button>

          <button onClick={() => openMenu('dtf')} className={cn('flex flex-col items-center justify-center gap-1.5 font-medium h-full w-[20%] active:scale-95 transition-transform', activeMenu === 'dtf' && isSheetOpen ? 'text-primary' : 'text-muted-foreground')}>
            <Layers className="h-[22px] w-[22px]" />
            <span className="text-[10px] uppercase font-bold tracking-wider">DTF</span>
          </button>

          <div className="w-[20%] flex justify-center items-center" /> {/* Spacer for the central button */}

          <button onClick={() => openMenu('loja')} className={cn('flex flex-col items-center justify-center gap-1.5 font-medium h-full w-[20%] active:scale-95 transition-transform', activeMenu === 'loja' && isSheetOpen ? 'text-primary' : 'text-muted-foreground')}>
            <ShoppingCart className="h-[22px] w-[22px]" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Loja</span>
          </button>

          <button onClick={() => openMenu('ferramentas')} className={cn('flex flex-col items-center justify-center gap-1.5 font-medium h-full w-[20%] active:scale-95 transition-transform', activeMenu === 'ferramentas' && isSheetOpen ? 'text-primary' : 'text-muted-foreground')}>
            <Settings2 className="h-[22px] w-[22px]" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Extra</span>
          </button>

        </div>
      </div>

      {/* Central Add Button */}
      <div className="md:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              id="mobile-quick-actions"
              size="icon"
              onClick={() => setActiveMenu('create')}
              className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_0_25px_var(--primary-custom)]/50 border-4 border-background hover:brightness-110 scale-110 active:scale-95 transition-all"
            >
              <Plus className="h-8 w-8" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 pb-safe overflow-hidden ios-glass border-t-0 border-x-0 shadow-2xl transition-all duration-500">
            {/* iOS Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full" />
            
            {renderSheetContent()}

          </SheetContent>
        </Sheet>
      </div>

      <ShortcutSelectionModal isOpen={isPrefModalOpen} onClose={() => setIsPrefModalOpen(false)} />

      <style dangerouslySetInnerHTML={{
        __html: `
        .ios-glass {
          backdrop-filter: blur(40px) saturate(200%) !important;
          -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
          background: rgba(255, 255, 255, 0.45) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }
        .dark .ios-glass {
          background: rgba(10, 10, 10, 0.55) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
      `}} />

      <div className="md:hidden h-[calc(4.5rem+env(safe-area-inset-bottom))]" />
    </>
  );
};