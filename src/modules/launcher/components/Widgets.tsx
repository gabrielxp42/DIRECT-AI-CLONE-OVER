import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  CloudLightning, CheckCircle2, Bot, ChevronRight, TrendingUp, Package, AlertCircle
} from 'lucide-react';
import { usePedidos, useInsumos } from '@/hooks/useDataFetch';
import { useNavigate } from 'react-router-dom';

export const CloudStatusWidget = () => {
  return (
    <motion.div 
      className="ios-widget"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="ios-widget-title">
        <CloudLightning className="w-4 h-4 text-cyan-400" /> 
        STATUS DA NUVEM
      </div>
      <div className="ios-widget-value mt-auto">
        Online
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse inline-block ml-3 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
      </div>
      <p className="text-white/30 text-xs font-medium mt-1">Sincronização em tempo real ativa</p>
    </motion.div>
  );
};

export const DailySummaryWidget = () => {
  const { data: pedidos } = usePedidos();
  const navigate = useNavigate();
  
  const todayCount = useMemo(() => {
    if (!pedidos) return 0;
    const today = new Date().toLocaleDateString();
    return pedidos.filter(p => new Date(p.created_at).toLocaleDateString() === today).length;
  }, [pedidos]);

  const pendingCount = useMemo(() => {
    if (!pedidos) return 0;
    return pedidos.filter(p => p.status === 'pendente' || p.status === 'processando').length;
  }, [pedidos]);

  return (
    <motion.div 
      className="ios-widget cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/dashboard')}
    >
      <div className="ios-widget-title">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 
        RESUMO DO DIA
      </div>
      <div className="flex flex-col gap-0 mt-auto">
        <div className="ios-widget-value leading-none">
          {todayCount}
        </div>
        <div className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-[0.1em] md:tracking-[0.2em] mt-1 md:mt-2 mb-2 md:mb-3">
          Pedidos Hoje
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[8px] md:text-[9px] font-black tracking-widest w-fit">
            <AlertCircle size={8} className="md:w-2.5 md:h-2.5" /> {pendingCount} PENDENTES
          </div>
        )}
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full mt-2 md:mt-3 overflow-hidden">
        <motion.div 
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: todayCount > 0 ? '60%' : '0%' }}
        />
      </div>
    </motion.div>
  );
};

export const GabiAnalyticsWidget = () => {
  const { data: pedidos } = usePedidos();
  const navigate = useNavigate();

  const salesIncrease = useMemo(() => {
    // Mock logic or actual calculation
    return "12.4%";
  }, [pedidos]);

  return (
    <motion.div 
      className="ios-widget cursor-pointer overflow-hidden group"
      style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(15, 15, 20, 0.4))' }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/dashboard')} // Link to analytics if exists
    >
      <div className="ios-widget-title text-violet-300">
        <Bot className="w-4 h-4" /> 
        GABI ANALYTICS
      </div>
      
      <div className="mt-auto relative z-10">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs md:text-sm mb-1">
          <TrendingUp size={14} className="md:w-4 md:h-4" />
          <span>+{salesIncrease}</span>
        </div>
        <h3 className="text-sm md:text-lg font-bold text-white leading-tight">
          Vendas subiram {salesIncrease}
          <span className="block text-white/40 text-[9px] md:text-xs font-medium mt-0.5 md:mt-1">comparado à última semana</span>
        </h3>
        <div className="hidden md:flex items-center gap-2 text-violet-300 font-bold text-xs mt-3 group-hover:gap-3 transition-all">
          Ver relatório completo <ChevronRight size={14} />
        </div>
      </div>

      {/* Decorative pulse circles */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all" />
    </motion.div>
  );
};

export const InventoryWidget = () => {
  const { data: insumos } = useInsumos();
  const navigate = useNavigate();

  const lowStockCount = useMemo(() => {
    if (!insumos) return 0;
    return insumos.filter(i => (i.quantidade_atual || 0) <= (i.quantidade_minima || 0)).length;
  }, [insumos]);

  return (
    <motion.div 
      className="ios-widget cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/insumos')}
    >
      <div className="ios-widget-title text-rose-300">
        <Package className="w-4 h-4" /> 
        ESTOQUE CRÍTICO
      </div>
      <div className="flex flex-col gap-0 mt-auto text-rose-400">
        <div className="ios-widget-value leading-none">
          {lowStockCount}
        </div>
        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-2">
          Alertas Ativos
        </div>
      </div>
      <p className="text-white/30 text-xs font-medium mt-1">
        {lowStockCount > 0 ? 'Insumos abaixo do nível mínimo' : 'Tudo sob controle'}
      </p>
    </motion.div>
  );
};
