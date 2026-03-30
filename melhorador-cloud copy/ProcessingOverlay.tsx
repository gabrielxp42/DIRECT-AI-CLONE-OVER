import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

type ProcessingOverlayProps = {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
};

export function ProcessingOverlay({
  isOpen,
  title = 'Processando',
  subtitle = 'IA Neural ajustando detalhes',
}: ProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] grid place-items-center bg-black/60 backdrop-blur-sm"
        >
          <div className="relative w-[320px] h-[220px] rounded-2xl bg-gradient-to-b from-cyan-900/30 to-black border border-cyan-400/30 overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-20 -left-20 w-[240px] h-[240px] bg-cyan-400/30 rounded-full blur-[60px]" />
              <div className="absolute -bottom-20 -right-20 w-[240px] h-[240px] bg-fuchsia-400/30 rounded-full blur-[60px]" />
            </div>
            <div className="relative h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-cyan-400" size={32} />
              <div className="text-white font-bold">{title}</div>
              <div className="text-xs text-gray-300">{subtitle}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
