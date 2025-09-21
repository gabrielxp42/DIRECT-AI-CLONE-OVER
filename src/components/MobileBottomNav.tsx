"use client";

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Package, Users, ShoppingCart, PlusCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

export const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleCreate = (path: string) => {
    navigate(path);
    setIsSheetOpen(false); // Fecha a sheet após a navegação
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg md:hidden z-50">
      <nav className="flex justify-around items-center h-16">
        <Link to="/" className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary">
          <Home className="h-5 w-5" />
          Início
        </Link>
        <Link to="/pedidos" className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary">
          <ShoppingCart className="h-5 w-5" />
          Pedidos
        </Link>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary h-auto w-auto p-0">
              <PlusCircle className="h-6 w-6 text-primary" />
              <span className="mt-1">Criar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-lg">
            <SheetHeader>
              <SheetTitle>O que você gostaria de criar?</SheetTitle>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <Button variant="outline" size="lg" onClick={() => handleCreate('/pedidos/novo')}>Novo Pedido</Button>
              <Button variant="outline" size="lg" onClick={() => handleCreate('/clientes/novo')}>Novo Cliente</Button>
              <Button variant="outline" size="lg" onClick={() => handleCreate('/produtos/novo')}>Novo Produto</Button>
            </div>
            <SheetFooter className="mt-4">
              <SheetClose asChild>
                <Button type="button" variant="secondary" className="w-full">
                  Cancelar
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Link to="/clientes" className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary">
          <Users className="h-5 w-5" />
          Clientes
        </Link>
        <Link to="/produtos" className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary">
          <Package className="h-5 w-5" />
          Produtos
        </Link>
      </nav>
    </div>
  );
};