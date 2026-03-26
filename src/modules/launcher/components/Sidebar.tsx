import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, CreditCard, Key, Palette, LogOut, ChevronRight, Settings, 
  Layout, Eye, EyeOff, X, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/SessionProvider';

interface SidebarProps {
  onPersonalize?: (tone: string) => void;
  activeTone?: string;
  onManageWidgets?: () => void;
  isManagingWidgets?: boolean;
  onClose?: () => void;
  glassOpacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

const menuItems = [
  { id: 'perfil', label: 'Configuração de Perfil', icon: User, route: '/settings/profile' },
  { id: 'pagamento', label: 'Pagamento & Assinatura', icon: CreditCard, route: '/settings/billing' },
  { id: 'tokens', label: 'Tokens & API Keys', icon: Key, route: '/settings/tokens' },
];

export const LauncherSidebar = ({ 
  onPersonalize, 
  activeTone, 
  onManageWidgets, 
  isManagingWidgets, 
  onClose,
  glassOpacity,
  onOpacityChange
}: SidebarProps) => {
  const { profile, activeSubProfile, switchSubProfile, supabase } = useSession();
  
  const displayName = activeSubProfile?.name || profile?.first_name || 'Usuário';
  const roleName = activeSubProfile?.role || 'Administrador';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSwitchProfile = () => {
    switchSubProfile(null);
    if (onClose) onClose();
  };

  return (
    <motion.div 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="md:w-[280px] w-full h-full flex flex-col gap-6 md:gap-8 p-6 md:p-8 border-r border-white/5 relative z-20"
    >
      {/* Top Header / Close */}
      <div className="flex items-center justify-between mb-2">
         <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Ajustes</p>
         <button 
           onClick={onClose}
           className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
         >
           <X size={18} />
         </button>
      </div>

      {/* Profile Summary */}
      <div className="flex flex-col gap-4 relative group">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-white/20 flex items-center justify-center text-2xl font-black text-white shadow-xl shrink-0 overflow-hidden">
               {activeSubProfile?.avatar_url || profile?.avatar_url ? (
                   <img src={activeSubProfile?.avatar_url || profile?.avatar_url || ''} alt={displayName} className="w-full h-full object-cover" />
               ) : initial}
            </div>
            <div className="flex-1 truncate">
               <h2 className="text-xl font-black text-white tracking-tight truncate">{displayName}</h2>
               <p className="text-white/40 text-xs font-bold uppercase tracking-widest truncate">{roleName}</p>
            </div>
        </div>
        <button 
           onClick={handleSwitchProfile}
           className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/70 hover:text-white transition-all w-full"
        >
           <Users size={14} />
           Trocar Perfil
        </button>
      </div>

      {/* Main Settings */}
      <div className="flex flex-col gap-1">
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest mb-3 ml-2">SISTEMA & CONTA</p>
        {menuItems.map((item) => (
          <button 
            key={item.id}
            className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-white/60 hover:text-white group"
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className="group-hover:text-cyan-400 transition-colors" />
              <span className="text-sm font-bold">{item.label}</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
          </button>
        ))}
      </div>

      {/* Managing Widgets Toggle */}
      <div className="flex flex-col gap-1">
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest mb-3 ml-2">DASHBOARD</p>
        <button 
          onClick={onManageWidgets}
          className={cn(
            "flex items-center gap-3 p-3 rounded-2xl transition-all font-bold text-sm",
            isManagingWidgets ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "hover:bg-white/5 text-white/60 hover:text-white"
          )}
        >
          {isManagingWidgets ? <Eye size={18} /> : <EyeOff size={18} />}
          <span>{isManagingWidgets ? 'Concluir Edição' : 'Personalizar Widgets'}</span>
        </button>
      </div>

      {/* Personalization / Color Picker */}
      <div className="flex flex-col gap-1">
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest mb-3 ml-2">TOM DO LIQUID GLASS</p>
        <div className="grid grid-cols-4 gap-2 px-2">
           {['clear', 'dark', 'cyan', 'rose'].map((tone) => (
              <button 
                key={tone}
                onClick={() => onPersonalize?.(tone)}
                className={cn(
                  "w-full aspect-square rounded-xl border transition-all hover:scale-110",
                  tone === 'clear' && "bg-white/10 border-white/20",
                  tone === 'dark' && "bg-zinc-950/40 border-white/5",
                  tone === 'cyan' && "bg-cyan-500/20 border-cyan-500/40",
                  tone === 'rose' && "bg-rose-500/20 border-rose-500/40",
                  activeTone === tone ? "ring-2 ring-white ring-offset-2 ring-offset-black/20 scale-110" : "opacity-60"
                )}
              />
           ))}
        </div>
      </div>

      {/* Glass Opacity Slider (Modern 2026) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-3 px-2">
           <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">TRANSPARÊNCIA DO VIDRO</p>
           <span className="text-cyan-400/50 text-[10px] font-bold">{Math.round((glassOpacity || 0.15) * 100)}%</span>
        </div>
        <div className="px-2 relative group">
           <input 
             type="range"
             min="0.05"
             max="0.8"
             step="0.01"
             value={glassOpacity || 0.15}
             onChange={(e) => onOpacityChange?.(parseFloat(e.target.value))}
             className="ios-glass-slider w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all"
           />
           <div className="flex justify-between mt-2 px-1 text-[8px] font-bold text-white/10 uppercase tracking-tighter">
              <span>Mistério</span>
              <span>Equilíbrio</span>
              <span>Cristal</span>
           </div>
        </div>
      </div>

      {/* Logout */}
      <div className="mt-auto">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 p-3 rounded-2xl w-full text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/5 transition-all text-sm font-bold"
        >
          <LogOut size={18} />
          <span>Sair da Conta</span>
        </button>
      </div>
    </motion.div>
  );
};
