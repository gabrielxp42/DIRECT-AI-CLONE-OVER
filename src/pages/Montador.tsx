import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

const Montador: React.FC = () => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-[#0f111a] overflow-hidden">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f111a]">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
          <p className="text-cyan-400/80 font-medium tracking-widest text-sm uppercase animate-pulse">
            Carregando O Montador...
          </p>
        </div>
      )}

      {/* Embedded Iframe */}
      <iframe
        src="https://www.omontador.com.br/"
        className="w-full h-full border-none"
        title="O Montador"
        onLoad={() => setLoading(false)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default Montador;
