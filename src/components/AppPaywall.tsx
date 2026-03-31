import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  ChevronRight, 
  Lock, 
  ArrowLeft, 
  Sparkles,
  Bot,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Specific Showcase Components (To be created)
// import { DTFShowcase } from './Showcases/DTFShowcase';
// import { MontadorShowcase } from './Showcases/MontadorShowcase';
// import { MelhoradorShowcase } from './Showcases/MelhoradorShowcase';

interface AppPaywallProps {
  isVisible: boolean;
  onUpgrade: () => void;
  onClose: () => void;
  appId: string;
  appName: string;
  themeColor?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple';
  renderShowcase: () => React.ReactNode;
}

export const AppPaywall: React.FC<AppPaywallProps> = ({ 
  isVisible, 
  onUpgrade, 
  onClose, 
  appId, 
  appName, 
  themeColor = 'emerald',
  renderShowcase
}) => {
  const navigate = useNavigate();

  if (!isVisible) return null;

  const themes = {
    emerald: {
      bg: 'from-emerald-500/10 to-teal-500/10',
      glow: 'from-emerald-500/30 to-transparent',
      border: 'border-emerald-500/20',
      accent: 'text-emerald-400',
      button: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40',
      indicator: 'bg-emerald-500'
    },
    blue: {
      bg: 'from-blue-500/10 to-indigo-500/10',
      glow: 'from-blue-500/30 to-transparent',
      border: 'border-blue-500/20',
      accent: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40',
      indicator: 'bg-blue-500'
    },
    rose: {
      bg: 'from-rose-500/10 to-pink-500/10',
      glow: 'from-rose-500/30 to-transparent',
      border: 'border-rose-500/20',
      accent: 'text-rose-400',
      button: 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40',
      indicator: 'bg-rose-500'
    },
    amber: {
      bg: 'from-amber-500/10 to-orange-500/10',
      glow: 'from-amber-500/30 to-transparent',
      border: 'border-amber-500/20',
      accent: 'text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40',
      indicator: 'bg-amber-500'
    },
    purple: {
      bg: 'from-purple-500/10 to-violet-500/10',
      glow: 'from-purple-500/30 to-transparent',
      border: 'border-purple-500/20',
      accent: 'text-purple-400',
      button: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40',
      indicator: 'bg-purple-500'
    }
  };

  const currentTheme = themes[themeColor];

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8"
    >
      {/* Liquid Glass Overlay Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-[40px] transition-all duration-700",
          "before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-30 before:pointer-events-none",
          currentTheme.bg
        )}
      />

      {/* Decorative Glows */}
      <div className={cn("absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-gradient-to-br", currentTheme.glow)} />
      <div className={cn("absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-gradient-to-br", currentTheme.glow)} />

      {/* Main Container */}
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className={cn(
          "relative w-full max-w-5xl h-[90vh] md:h-[650px] bg-black/40 border rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row",
          currentTheme.border
        )}
      >
        {/* Left Column: Interactive Showcase */}
        <div className="flex-1 relative bg-gradient-to-b from-transparent to-black/20 p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center justify-center">
            {/* The iPhone/App Mockup Container */}
            <div className="relative w-[280px] h-[580px] bg-zinc-950 rounded-[48px] p-3 shadow-2xl border-[6px] border-zinc-900 overflow-hidden hidden md:block">
               {/* Speaker/Camera Notch */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-[60]" />
               
               <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-[#0a0a0f]">
                  {/* The actual showcase animation for this specific app */}
                  {renderShowcase()}
               </div>
            </div>

            {/* Mobile simplified showcase */}
            <div className="md:hidden w-full h-full flex flex-col justify-center">
               {renderShowcase()}
            </div>
        </div>

        {/* Right Column: Value Prop & Actions */}
        <div className="w-full md:w-[400px] bg-black/40 p-8 md:p-12 flex flex-col">
          <div className="flex justify-between items-start mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
               <Shield className={cn("w-6 h-6", currentTheme.accent)} />
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/30 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <h2 className="text-4xl font-black text-white leading-tight">
              Desperte o <br />
              <span className={currentTheme.accent}>Potencial Máximo</span>
            </h2>
            <p className="text-white/40 text-sm leading-relaxed font-medium">
              O {appName} faz parte do ecossistema Direct AI Premium. Ative todas as automações e processe arquivos ilimitados hoje.
            </p>

            <div className="space-y-4 pt-4">
              {[
                "Processamento Prioritário HD",
                "Exportação de Planilhas Ilimitada",
                "Apoio da Gabi 24/7",
                "Sem Filtros de Halftone"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full", currentTheme.indicator)} />
                  <span className="text-[12px] font-bold text-white/70 uppercase tracking-widest">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-10">
            <button 
              onClick={onUpgrade}
              className={cn(
                "w-full py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] group",
                "text-black font-black uppercase tracking-tighter text-lg",
                currentTheme.button
              )}
            >
              Começar Assinatura Premium
              <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button 
              onClick={onClose}
              className="w-full py-4 text-white/40 font-bold text-sm flex items-center justify-center gap-2 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Launcher
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};
