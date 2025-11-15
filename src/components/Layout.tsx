import * as React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare } from 'lucide-react';
import { AIAssistant } from './AIAssistant';
import { ThemeToggle } from './ThemeToggle';
import { UserNav } from './UserNav';
import { MobileBottomNav } from './MobileBottomNav';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from './ui/button';
import { useViewportZoom } from '@/hooks/useViewportZoom';
import { APP_VERSION } from '@/utils/version';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { href: '/clientes', icon: Users, label: 'Clientes' },
  { href: '/produtos', icon: Package, label: 'Produtos' },
  { href: '/reports', icon: BarChart3, label: 'Relatórios' },
];

const Layout = () => {
  const { isOpen, open: openAIAssistant } = useAIAssistant();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Desativa o zoom para todas as páginas dentro do Layout por padrão
  useViewportZoom(false); 

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Sidebar - Desktop */}
      <div className="hidden border-r bg-sidebar md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          {/* Header do Sidebar */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
              <img src="/logo.png" alt="Direct DTF Logo" className="h-8 w-8" />
              <div className="flex flex-col">
                <span className="text-base font-bold">DIRECT DTF - AI</span>
                <span className="text-xs text-sidebar-foreground/70">Por Gabriel Lima</span>
              </div>
            </Link>
          </div>
          
          {/* Navegação */}
          <div className="flex-1 overflow-y-auto p-2 lg:p-4">
            <nav className="grid items-start gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Footer do Sidebar */}
          <div className="p-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/50 text-center">
              Versão: {APP_VERSION}
            </p>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-2 font-semibold md:hidden">
            <img src="/logo.png" alt="Direct DTF Logo" className="h-8 w-8" />
            <span>DIRECT AI</span>
          </div>
          <div className="w-full flex-1" />
          <ThemeToggle />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
      <AIAssistant />
      {!isOpen && !isMobile && (
        <Button
          className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-lg z-50"
          onClick={openAIAssistant}
        >
          <MessageSquare className="h-8 w-8" />
        </Button>
      )}
    </div>
  );
};

export default Layout;