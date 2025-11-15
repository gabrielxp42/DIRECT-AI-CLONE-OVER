import * as React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare, Menu } from 'lucide-react';
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
          "hidden border-r bg-sidebar transition-all duration-300 ease-in-out md:flex flex-col h-full shadow-lg hover:shadow-xl", // Adicionado shadow
          sidebarWidth
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="flex h-full flex-col gap-2">
          {/* Header do Sidebar */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-4 overflow-hidden">
            <Link to="/" className="flex items-center gap-3 font-semibold text-sidebar-foreground">
              <img src="/logo.png" alt="Direct DTF Logo" className="h-8 w-8 flex-shrink-0" />
              <span className={cn(
                "text-lg font-bold whitespace-nowrap transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                DIRECT AI
              </span>
            </Link>
          </div>
          
          {/* Navegação */}
          <div className="flex-1 overflow-y-auto p-2 lg:p-3">
            <nav className="grid items-start gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]" // Adicionado hover:scale
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className={cn(
                      "whitespace-nowrap transition-opacity duration-200",
                      isExpanded ? "opacity-100" : "opacity-0"
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Footer do Sidebar */}
          <div className="p-4 border-t border-sidebar-border overflow-hidden">
            <p className={cn(
              "text-xs text-sidebar-foreground/50 text-center transition-opacity duration-200",
              isExpanded ? "opacity-100" : "opacity-0"
            )}>
              Versão: {APP_VERSION}
            </p>
          </div>
        </div>
      </div>
      
      {/* Main Content (Segunda Coluna do Grid) */}
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
          className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-xl z-50 transition-all duration-300 hover:scale-110"
          onClick={openAIAssistant}
        >
          <MessageSquare className="h-8 w-8" />
        </Button>
      )}
    </div>
  );
};

export default Layout;