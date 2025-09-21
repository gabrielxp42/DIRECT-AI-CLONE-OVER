import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, User, Plus, BarChart3, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';

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

export const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { open: openAIChat } = useAIAssistant();

  const handleCreate = (path: string) => {
    setIsSheetOpen(false);
    navigate(path, { state: { openForm: true } });
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t z-40">
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
              size="icon"
              className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg border-4 border-background hover:bg-primary/90"
            >
              <Plus className="h-8 w-8" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-lg">
            <SheetHeader>
              <SheetTitle>O que você gostaria de criar?</SheetTitle>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <Button variant="outline" size="lg" onClick={() => handleCreate('/pedidos')}>Novo Pedido</Button>
              <Button variant="outline" size="lg" onClick={() => handleCreate('/clientes')}>Novo Cliente</Button>
              <Button variant="outline" size="lg" onClick={() => handleCreate('/produtos')}>Novo Produto</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Add padding to the bottom of the main content to avoid overlap */}
      <div className="md:hidden h-16" />
    </>
  );
};