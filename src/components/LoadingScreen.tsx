import { useEffect, useState } from 'react';
import './LoadingScreen.css';


interface LoadingScreenProps {
  minDisplayTime?: number; // Tempo mínimo de exibição em ms
}

const LoadingScreen = ({ minDisplayTime = 800 }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // Preload da imagem via JS para garantir cache
    const img = new Image();
    img.src = "/logo.png";
    img.onload = () => setImgError(false);
    img.onerror = () => setImgError(true);

    // Garantir tempo mínimo de exibição para evitar flash
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Aguardar animação de fade out antes de desmontar
      setTimeout(() => setShouldRender(false), 300);
    }, minDisplayTime);

    return () => clearTimeout(timer);
  }, [minDisplayTime]);

  if (!shouldRender) return null;

  return (
    <div
      className={`loading-screen ${isVisible ? 'loading-screen--visible' : 'loading-screen--hidden'}`}
      role="status"
      aria-live="polite"
      aria-label="Carregando aplicação"
    >
      {/* Background com gradiente e partículas */}
      <div className="loading-screen__background">
        <div className="loading-screen__particle loading-screen__particle--1" aria-hidden="true" />
        <div className="loading-screen__particle loading-screen__particle--2" aria-hidden="true" />
        <div className="loading-screen__particle loading-screen__particle--3" aria-hidden="true" />
      </div>

      {/* Conteúdo principal */}
      <div className="loading-screen__content">
        {/* Container da logo com efeitos */}
        <div className="loading-screen__logo-container">
          {/* Anéis de pulso externos */}
          <div className="loading-screen__ring loading-screen__ring--outer" aria-hidden="true" />
          <div className="loading-screen__ring loading-screen__ring--middle" aria-hidden="true" />

          {/* Logo com glow neon */}
          <div className="loading-screen__logo-wrapper">
            <div className="loading-screen__glow loading-screen__glow--primary" aria-hidden="true" />
            <div className="loading-screen__glow loading-screen__glow--secondary" aria-hidden="true" />

            {imgError ? (
              <div className="loading-screen__logo-fallback flex items-center justify-center w-32 h-32 rounded-full bg-yellow-400/20 border-2 border-yellow-400 animate-pulse">
                <span className="text-4xl font-bold text-yellow-400">DA</span>
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="DIRECT AI Logo"
                className="loading-screen__logo"
                loading="eager"
                decoding="async"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </div>

        {/* Texto e informações */}
        <div className="loading-screen__text">
          <h1 className="loading-screen__title">DIRECT AI</h1>
          <p className="loading-screen__subtitle">
            Carregando<span className="loading-screen__dots" aria-hidden="true"></span>
          </p>
          <p className="loading-screen__tip" aria-live="polite">
            Preparando sua experiência
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="loading-screen__progress-container" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
          <div className="loading-screen__progress-bar" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
