import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionProvider";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SUPABASE_URL } from "@/integrations/supabase/client";

export function UserNav() {
  const { session, supabase } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      console.log("Iniciando logout...");
      
      // Limpar localStorage e sessionStorage primeiro (mais importante)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removido do localStorage: ${key}`);
      });
      
      // Limpar sessionStorage também
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`🗑️ Removido do sessionStorage: ${key}`);
      });
      
      // Tentar fazer logout via API direta se tiver access_token válido
      // Mas não esperar por isso - o importante é limpar o storage
      if (session?.access_token) {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {
          // Ignorar erros silenciosamente - 401 é esperado se token expirado
        });
      }
      
      // Tentar logout via cliente Supabase (não bloqueante)
      supabase.auth.signOut().catch(() => {
        // Ignorar erros - já limpamos o storage
      });
      
      console.log("✅ Storage limpo. Redirecionando para login...");
    } catch (error) {
      console.error("Exceção no logout:", error);
    } finally {
      // Sempre navegar para login e forçar reload para garantir limpeza completa
      // Usar setTimeout para garantir que a limpeza do storage seja processada
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
  };

  const user = session?.user;
  const userEmail = user?.email || "usuário";
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Olá!</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}