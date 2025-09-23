import * as React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, ShoppingCart, Users, BarChart3, Package, MessageSquare } from 'lucide-react';
import { AIAssistant } from './AIAssistant';
import { ThemeToggle } from './ThemeToggle';
import { UserNav } from './UserNav';
import { MobileBottomNav } from './MobileBottomNav';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from './ui/button';
// import { useViewportZoom } from '@/hooks/useViewportZoom'; // Importar o novo hook

const Layout = () => {
  const { isOpen, open: openAIAssistant } = useAIAssistant();
  const isMobile = useIsMobile();

  // Removido: Desativar o zoom para todas as páginas dentro do Layout por padrão
  // useViewportZoom(false); 

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <img src="/logo.png" alt="Direct DTF Logo" className="h-8 w-8" />
              <div className="flex flex-col">
                <span className="">DIRECT DTF - AI</span>
                <span className="text-xs text-muted-foreground">Por Gabriel Lima</span>
              </div>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                to="/pedidos"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <ShoppingCart className="h-4 w-4" />
                Pedidos
              </Link>
              <Link
                to="/clientes"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Users className="h-4 w-4" />
                Clientes
              </Link>
              <Link
                to="/produtos"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Package className="h-4 w-4" />
                Produtos
              </Link>
              <Link
                to="/reports"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
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