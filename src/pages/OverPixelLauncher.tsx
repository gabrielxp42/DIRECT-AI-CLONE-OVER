import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, CreditCard, Layers, LayoutGrid, Wand2, MonitorPlay, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import './OverPixelLauncher.css';

interface OverPixelLauncherProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAppClick?: (appId: string) => void;
}

const OverPixelLauncher = React.forwardRef<HTMLDivElement, OverPixelLauncherProps>(
  ({ isOpen, onClose, onAppClick }, ref) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const isVisible = isOpen !== false;

    if (!isVisible) return null;

    const handleAppClickInternal = (appId: string) => {
      if (onAppClick) {
        onAppClick(appId);
        return;
      }
      if (appId === 'direct-ai') navigate('/dashboard');
      else if (appId === 'montador') navigate('/montador');
      else {
        toast({
          title: '🚧 Módulo Pro',
          description: `Este aplicativo requer assinatura ativa.`,
          duration: 3000,
        });
      }
    };

    return (
      <div className="overpixel-launcher" ref={ref}>
        {/* Top Header */}
        <div className="overpixel-library-header">
          <div>
            <div className="text-cyan-400 text-[10px] font-black tracking-[0.5em] uppercase mb-2">Direct AI OS | Ecosystem</div>
            <h1 className="overpixel-library-title">Apps & Workspace</h1>
          </div>
          <button 
            onClick={onClose}
            className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-4 rounded-full transition-all"
          >
            <span className="text-white/40 group-hover:text-white text-[11px] font-black uppercase tracking-widest">Fechar Menu</span>
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">Esc</div>
          </button>
        </div>

        {/* Bento Grid — No Scroll, Dynamic Spans */}
        <div className="overpixel-library-grid">
          {/* Direct AI — FEATURED TALL */}
          <AppPoster 
            id="direct-ai"
            name="Direct AI"
            desc="Sua central de inteligência para gestão, vendas e automação empresarial total. O núcleo do ecossistema."
            image="file:///C:/Users/gabri/.gemini/antigravity/brain/821e6d5c-3614-4b43-92a3-f4b090366e1b/gabi_ai_hero_banner_1773810023025.png"
            badge="Assinado"
            variant="tall"
            features={["Dashboard Real-time", "Gabi AI 4.0", "Gestão de Fluxo"]}
            onClick={handleAppClickInternal}
          />

          {/* DTF Factory — SMALL */}
          <AppPoster 
            id="dtf-factory"
            name="DTF Factory"
            desc="Nesting automático para produção de DTF."
            image="file:///C:/Users/gabri/.gemini/antigravity/brain/821e6d5c-3614-4b43-92a3-f4b090366e1b/dtf_factory_hero_banner_1773810038900.png"
            badge="Pro"
            variant="small"
            features={["Nesting IA", "Controle de Cores"]}
            onClick={handleAppClickInternal}
          />

          {/* O Montador — SMALL */}
          <AppPoster 
            id="montador"
            name="O Montador"
            desc="Editor visual para layouts e gabaritos."
            image="https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1064&auto=format&fit=crop"
            badge="Assinado"
            variant="small"
            features={["Preview 3D", "Multi-layer"]}
            onClick={handleAppClickInternal}
          />

          {/* Upscale AI — TALL (Balanced side) */}
          <AppPoster 
            id="melhorador"
            name="Upscale AI"
            desc="Restauração e upscale de imagens usando inteligência artificial de alta performance."
            image="https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1470&auto=format&fit=crop"
            badge="Pro"
            variant="tall"
            features={["Remoção de Ruído", "Recuperação Textura", "Batch Export"]}
            onClick={handleAppClickInternal}
          />
        </div>

        {/* Static Brand Footer */}
        <footer className="absolute bottom-10 opacity-10 pointer-events-none">
          <div className="text-[10px] font-black uppercase tracking-[0.8em] text-white">OverPixel Bento Hub</div>
        </footer>
      </div>
    );
  }
);

interface AppPosterProps {
  id: string;
  name: string;
  desc: string;
  image: string;
  badge: string;
  variant?: 'tall' | 'wide' | 'small';
  features: string[];
  onClick: (id: string) => void;
}

const AppPoster: React.FC<AppPosterProps> = ({ id, name, desc, image, badge, variant = 'small', features, onClick }) => (
  <motion.div
    className={`overpixel-app-poster overpixel-app-poster--${variant}`}
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    onClick={() => onClick(id)}
  >
    <div className="overpixel-poster-badge">{badge}</div>
    <img src={image} alt={name} className="overpixel-poster-image" />
    <div className="overpixel-poster-content">
      <div className="overpixel-poster-name">{name}</div>
      <p className="overpixel-poster-desc">{desc}</p>
      
      <div className="overpixel-poster-features">
        {features.map((f, i) => (
          <div key={i} className="overpixel-feature-item">
            <Check className="w-3 h-3 text-cyan-400" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <div className="overpixel-poster-actions">
        <button className="btn-launch" onClick={(e) => { e.stopPropagation(); onClick(id); }}>
          <Play className="w-3 h-3 fill-current" />
          Abrir
        </button>
        <button className="btn-subscribe" onClick={(e) => e.stopPropagation()}>
          <CreditCard className="w-4 h-4" />
        </button>
      </div>
    </div>
  </motion.div>
);

export default OverPixelLauncher;
