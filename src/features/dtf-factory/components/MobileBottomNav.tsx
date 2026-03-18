import React from 'react';
import { Image as GalleryIcon, MessageSquare, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenGallery: () => void;
  onOpenChat: () => void;
  tokenBalance: number;
  activeTab?: 'gallery' | 'chat' | null;
}

export default function MobileBottomNav({ onOpenGallery, onOpenChat, tokenBalance, activeTab }: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-black/80 backdrop-blur-xl border-t border-white/10 md:hidden pb-safe">
      <div className="flex items-center justify-around p-3">
        
        {/* Gallery Button */}
        <button
          onClick={onOpenGallery}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'gallery' ? 'text-cyan-400' : 'text-white/70 hover:text-cyan-400'
          }`}
        >
          <div className={`p-2 rounded-xl border transition-colors ${
            activeTab === 'gallery' 
              ? 'bg-cyan-500/20 border-cyan-500/50' 
              : 'bg-white/5 border-white/10'
          }`}>
            <GalleryIcon size={20} />
          </div>
          <span className="text-[10px] font-medium">Galeria</span>
        </button>

        {/* Token Balance (Central) */}
        <div 
          className="flex flex-col items-center gap-1 cursor-pointer"
          onClick={() => window.open('https://overpixel.online/tokens', '_blank')}
        >
          <div className="px-3 py-2 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center gap-2 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
            <span className="text-sm font-bold text-white">
              {tokenBalance}
            </span>
          </div>
          <span className="text-[9px] font-medium text-white/40">Tokens</span>
        </div>

        {/* Chat Button */}
        <button
          onClick={onOpenChat}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'chat' ? 'text-violet-400' : 'text-white/70 hover:text-violet-400'
          }`}
        >
          <div className={`p-2 rounded-xl border transition-colors ${
            activeTab === 'chat'
              ? 'bg-violet-500/20 border-violet-500/50'
              : 'bg-white/5 border-white/10'
          }`}>
            <MessageSquare size={20} />
          </div>
          <span className="text-[10px] font-medium">Chat IA</span>
        </button>

      </div>
    </div>
  );
}
