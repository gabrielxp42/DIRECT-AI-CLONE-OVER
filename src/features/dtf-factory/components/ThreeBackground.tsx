

/**
 * Background leve — CSS puro, ZERO canvas/WebGL.
 * 
 * Usa gradientes animados + grid sutil + partículas CSS.
 * Funciona suave em qualquer PC.
 */

export default function ThreeBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050507]">
            {/* Gradiente base animado */}
            <div
                className="absolute inset-0 animate-gradient-shift"
                style={{
                    background: `
                        radial-gradient(ellipse 60% 50% at 20% 50%, rgba(6,182,212,0.06) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 60% at 80% 30%, rgba(99,102,241,0.05) 0%, transparent 70%),
                        radial-gradient(ellipse 40% 40% at 50% 80%, rgba(6,182,212,0.04) 0%, transparent 60%)
                    `
                }}
            />

            {/* Grid sutil */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px'
                }}
            />

            {/* Glow orbs — CSS puro, will-change: transform para GPU */}
            <div
                className="absolute w-[500px] h-[500px] rounded-full animate-float-slow"
                style={{
                    top: '10%',
                    left: '15%',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    willChange: 'transform',
                }}
            />
            <div
                className="absolute w-[400px] h-[400px] rounded-full animate-float-slow-reverse"
                style={{
                    bottom: '15%',
                    right: '10%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    willChange: 'transform',
                }}
            />
            <div
                className="absolute w-[300px] h-[300px] rounded-full animate-float-medium"
                style={{
                    top: '50%',
                    left: '60%',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
                    filter: 'blur(70px)',
                    willChange: 'transform',
                }}
            />

            {/* Partículas CSS estáticas com brilho */}
            <div className="absolute inset-0">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-twinkle"
                        style={{
                            width: `${1 + Math.random() * 2}px`,
                            height: `${1 + Math.random() * 2}px`,
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            background: i % 3 === 0 ? '#06b6d4' : '#6366f1',
                            opacity: 0.2 + Math.random() * 0.4,
                            animationDelay: `${Math.random() * 6}s`,
                            animationDuration: `${3 + Math.random() * 4}s`,
                        }}
                    />
                ))}
            </div>

            {/* Vignette nas bordas */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)'
                }}
            />
        </div>
    );
}
