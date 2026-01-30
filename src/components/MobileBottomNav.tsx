import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, User, Plus, BarChart3, MessageSquare, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { useShortcuts } from '@/hooks/useShortcuts';
import { ShortcutSelectionModal } from './ShortcutSelectionModal';

const navItemsLeft = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { href: '/clientes', icon: User, label: 'Clientes' },
];

const navItemsRight = [
  { href: '/produtos', icon: Package, label: 'Produtos' },
  { href: '/reports', icon: BarChart3, label: 'Relatórios' },
  { href: 'AI_ACTION', icon: MessageSquare, label: 'AI Chat' },
];

export const MobileBottomNav = ({ onOpenCalculator }: { onOpenCalculator?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { open: openAIChat } = useAIAssistant();
  const { activeShortcuts, handleShortcutAction, definitions } = useShortcuts(onOpenCalculator);
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);

  const handleCreate = (path: string) => {
    setIsSheetOpen(false);
    navigate(path, { state: { openForm: true } });
  };

  const handleMobileAction = (id: string) => {
    setIsSheetOpen(false);
    handleShortcutAction(id);
  };

  const renderNavItem = (item: { href: string; icon: React.ElementType; label: string }) => {
    const isActive = location.pathname === item.href;
    if (item.href === 'AI_ACTION') {
      return (
        <button
          key={item.label}
          onClick={openAIChat}
          className="flex flex-col items-center justify-center gap-1 text-xs font-medium h-full w-full text-muted-foreground"
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      );
    }
    return (
      <Link
        key={item.label}
        to={item.href}
        className={cn(
          'flex flex-col items-center justify-center gap-1 text-xs font-medium h-full w-full',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 ios-glass border-t border-white/10 z-40">
        <div className="flex justify-around items-center h-full relative">
          <div className="flex justify-around items-center w-full">
            {navItemsLeft.map(renderNavItem)}
            <div className="w-16" /> {/* Spacer for the central button */}
            {navItemsRight.map(renderNavItem)}
          </div>
        </div>
      </div>

      {/* Central Add Button */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              id="mobile-quick-actions"
              size="icon"
              className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_0_25px_var(--primary-custom)]/50 border-4 border-background hover:brightness-110 scale-110 active:scale-95 transition-all"
            >
              <Plus className="h-8 w-8" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-[2.5rem] p-0 overflow-hidden ios-glass border-t-0 border-x-0 shadow-2xl transition-all duration-500"
          >
            {/* iOS Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full" />

            <div className="p-6 pt-12">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-bold tracking-tight text-foreground">O que vamos criar hoje?</SheetTitle>
              </SheetHeader>

              <div className="grid gap-6">
                {/* Botão Principal em Destaque - Liquid Style */}
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
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">Ferramentas de Apoio</span>
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-12 gap-2 text-xs font-semibold text-muted-foreground/40 hover:text-primary transition-all rounded-xl"
                  onClick={() => {
                    setIsSheetOpen(false);
                    setIsPrefModalOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                  Personalizar ferramentas
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <ShortcutSelectionModal
        isOpen={isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
      />

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

      {/* Add padding to the bottom of the main content to avoid overlap */}
      <div className="md:hidden h-16" />
    </>
  );
};