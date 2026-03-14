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
import { useNavigate } from "react-router-dom";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  ShieldCheck, 
  Palette, 
  Wrench, 
  Headset, 
  ChevronRight,
  ArrowLeftRight,
  LogOut,
  Settings,
  User as UserIcon
} from "lucide-react";

const roleIcons = {
  chefe: ShieldCheck,
  designer: Palette,
  operador: Wrench,
  atendente: Headset
};

const roleColors = {
  chefe: "text-amber-500 bg-amber-500/10",
  designer: "text-purple-500 bg-purple-500/10",
  operador: "text-blue-500 bg-blue-500/10",
  atendente: "text-emerald-500 bg-emerald-500/10"
};

export function UserNav() {
  const { session, supabase, activeSubProfile, switchSubProfile, profile, hasPermission } = useSession();
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
      localStorage.removeItem('direct_ai_active_sub_profile');

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

  const RoleIcon = activeSubProfile ? roleIcons[activeSubProfile.role] : UserIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="user-nav-dropdown" variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden ring-offset-background transition-all hover:ring-2 hover:ring-primary/50">
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72 p-2 border-border/40 bg-background/80 backdrop-blur-xl shadow-2xl rounded-2xl" align="end" forceMount>
        {/* Profile Header Card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-transparent p-3 mb-2 border border-primary/10">
          <div className="flex items-center gap-3 relative z-10">
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              activeSubProfile ? roleColors[activeSubProfile.role] : "bg-primary/10 text-primary"
            )}>
              <RoleIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black tracking-tight text-foreground truncate uppercase italic">
                {activeSubProfile ? `Olá, ${activeSubProfile.name}!` : "Bem-vindo!"}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-widest opacity-70">
                {activeSubProfile ? activeSubProfile.role : "Sessão Ativa"}
              </span>
              <span className="text-[9px] text-muted-foreground/60 truncate italic mt-0.5">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-2xl -mr-8 -mt-8" />
        </div>

        <div className="space-y-1">
          {profile?.is_multi_profile_enabled && (
            <DropdownMenuItem
              onClick={() => switchSubProfile(null)}
              className="group flex items-center justify-between p-2.5 rounded-xl transition-all hover:bg-primary/10 cursor-pointer border border-transparent hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold tracking-tight">Trocar Perfil</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="opacity-50 mx-2" />

          <DropdownMenuItem
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors"
          >
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Meu Perfil</span>
          </DropdownMenuItem>

          {hasPermission('manage_settings') && (
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Configurações</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="opacity-50 mx-2" />

          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-bold">Sair do Direct AI</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}