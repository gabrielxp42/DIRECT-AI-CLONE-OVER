import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, CreditCard, Key, Palette, LogOut, ChevronRight, Settings, 
  Layout, Eye, EyeOff, X, Users, Zap, Crown, ArrowRight
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
  { id: 'assinaturas', label: 'Minhas Assinaturas', icon: CreditCard, route: '/profile' },
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

  const tokenBalance = profile?.ai_credits || 0;
  const subscriptionTier = profile?.subscription_tier || 'FREE';
  const isPro = subscriptionTier.toUpperCase().includes('PRO') || subscriptionTier.toUpperCase().includes('COMBO');

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

      {/* Token Balance Card */}
      <div className="relative p-5 rounded-3xl overflow-hidden group border border-white/10 bg-[#121216]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent z-0" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Zap size={16} className={tokenBalance > 0 ? "fill-indigo-400/20" : ""} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">Gabi Tokens</span>
            </div>
            {isPro && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <Crown size={10} /> Pro
              </span>
            )}
          </div>
          
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white tracking-tighter">{tokenBalance}</span>
            <span className="text-xs text-white/40 font-bold uppercase">Restantes</span>
          </div>

          <button className="flex items-center justify-between w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all font-bold text-xs shadow-lg shadow-purple-500/20 group/btn hover:scale-[1.02]">
            <span>Adicionar Fichas</span>
            <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
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
