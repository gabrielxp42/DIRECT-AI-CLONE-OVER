import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layers, Home, LayoutGrid, Wand2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GabiAvatar } from './GabiAvatar';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import './OverPixelDock.css';

/* Mini OverPixel logo SVG for the trigger button */
const MiniOverPixelLogo: React.FC = () => (
  <svg width="24" height="15" viewBox="0 0 200 120">
    <circle cx="72" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="8" opacity={0.9} />
    <circle cx="128" cy="60" r="34" fill="none" stroke="#67e8f9" strokeWidth="8" opacity={0.9} />
  </svg>
);

interface AppDef {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'wip';
  path: string | null;
  iconType: 'gabi' | 'dtf' | 'montador' | 'melhorador';
}

const APPS: AppDef[] = [
  {
    id: 'direct-ai',
    name: 'Direct AI',
    description: 'Gabi — IA Assistente',
    status: 'active',
    path: '/dashboard',
    iconType: 'gabi',
  },
  {
    id: 'dtf-factory',
    name: 'DTF Factory',
    description: 'Montador de Estampas',
    status: 'active',
    path: '/dtf-factory',
    iconType: 'dtf',
  },
  {
    id: 'montador',
    name: 'O Montador',
    description: 'Builder de Layouts',
    status: 'active',
    path: '/montador',
    iconType: 'montador',
  },
  {
    id: 'melhorador',
    name: 'Melhorador Cloud',
    description: 'Melhoria de Imagens',
    status: 'wip',
    path: null,
    iconType: 'melhorador',
  },
];

export const OverPixelDock: React.FC = () => {
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      // small delay to avoid immediate close
      const timer = setTimeout(() => document.addEventListener('click', handleClick), 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [isOpen]);

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleAppClick = (app: AppDef) => {
    if (app.status === 'wip') {
      toast({
        title: '🚧 Em Construção',
        description: `${app.name} está sendo desenvolvido. Em breve!`,
        duration: 3000,
      });
      return;
    }
    if (app.path) {
      if (app.path.startsWith('http')) {
        window.open(app.path, '_blank');
      } else {
        navigate(app.path);
      }
      setIsOpen(false);
    }
  };

  // Determine which app is currently active
  const isGabiActive = location.pathname !== '/' && location.pathname !== '/landing-page';

  if (!isMobile) return null;

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        className="overpixel-dock-trigger"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title="OverPixel — Trocar aplicativo"
      >
        <MiniOverPixelLogo />
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            className="overpixel-dock-panel"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="overpixel-dock-header">
              <MiniOverPixelLogo />
              <span className="overpixel-dock-header-text">Aplicativos</span>
            </div>

            {/* App List */}
            {APPS.map((app) => (
              <div
                key={app.id}
                className="overpixel-dock-app"
                onClick={() => handleAppClick(app)}
              >
                {/* Active indicator */}
                {app.id === 'direct-ai' && isGabiActive && (
                  <div className="overpixel-dock-active-dot" />
                )}

                {/* Icon */}
                <div className={`overpixel-dock-app-icon overpixel-dock-app-icon--${app.iconType}`}>
                  {app.iconType === 'gabi' ? (
                    <GabiAvatar mood="idle" size={28} />
                  ) : app.iconType === 'dtf' ? (
                    <Layers className="w-5 h-5 text-amber-400" />
                  ) : app.iconType === 'montador' ? (
                    <LayoutGrid className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Wand2 className="w-5 h-5 text-sky-400" />
                  )}
                </div>

                {/* Info */}
                <div>
                  <div className="overpixel-dock-app-name">{app.name}</div>
                  <div className={`overpixel-dock-app-status overpixel-dock-app-status--${app.status === 'active' ? 'active' : 'wip'}`}>
                    {app.status === 'active' ? app.description : '🚧 Em Construção'}
                  </div>
                </div>
              </div>
            ))}

            {/* Home / Launcher button */}
            <div
              className="overpixel-dock-home"
              onClick={() => { navigate('/'); setIsOpen(false); }}
            >
              <Home className="w-4 h-4 text-cyan-500/60" />
              <span className="overpixel-dock-home-text">Launcher</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OverPixelDock;
