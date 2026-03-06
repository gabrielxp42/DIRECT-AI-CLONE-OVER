
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, ArrowRight, Layers } from "lucide-react";

const showcaseSlides = [
    {
        id: "embroidery",
        label: "Efeito Bordado",
        icon: <Layers className="w-4 h-4" />,
        tagBefore: "Original",
        tagAfter: "Bordado 3D",
        imageBefore: "/START-BUCKS - NAO-BORDADO.png",
        imageAfter: "/START-BUCKS - BORDADO.png",
    },
    {
        id: "vector",
        label: "Vetorização",
        icon: <Zap className="w-4 h-4" />,
        tagBefore: "Bitmap",
        tagAfter: "Vetorizado",
        imageBefore: "/BAIXA-QUALIDADE-BRASIL.png",
        imageAfter: "/ALTA-QUALIDADE-BRASIL.png",
    },
];

export function VetorizaShowcase() {
    const [activeSlide, setActiveSlide] = useState(0);
    const [showAfter, setShowAfter] = useState(false);

    // Auto-cycle: show before → after → next slide
    useEffect(() => {
        const timer = setInterval(() => {
            setShowAfter((prev) => {
                if (prev) {
                    // Was showing after, move to next slide
                    setActiveSlide((s) => (s + 1) % showcaseSlides.length);
                    return false;
                }
                return true;
            });
        }, 2500);
        return () => clearInterval(timer);
    }, []);

    const slide = showcaseSlides[activeSlide];

    return (
        <div className="relative w-full rounded-3xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
            {/* Background Glow */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-primary/15 via-transparent to-primary/10 blur-[60px] opacity-50" />
            </div>

            {/* Slide Tabs */}
            <div className="relative z-20 flex items-center gap-1.5 px-3 pt-2">
                {showcaseSlides.map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => { setActiveSlide(i); setShowAfter(false); }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${i === activeSlide
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                            }`}
                    >
                        {s.icon}
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Main Image Area */}
            <div className="relative z-10 w-full aspect-[5/3] p-1.5 sm:p-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${slide.id}-${showAfter ? "after" : "before"}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm"
                    >
                        <img
                            src={showAfter ? slide.imageAfter : slide.imageBefore}
                            alt={showAfter ? slide.tagAfter : slide.tagBefore}
                            className="w-full h-full object-contain p-2"
                        />

                        {/* Tag */}
                        <div className={`absolute bottom-3 left-3 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${showAfter
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "bg-black/60 text-zinc-400 backdrop-blur-md border border-white/10"
                            }`}>
                            {showAfter && <Sparkles className="w-3 h-3 fill-current" />}
                            {showAfter ? slide.tagAfter : slide.tagBefore}
                        </div>

                        {/* AI Badge on After */}
                        {showAfter && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                            >
                                <Zap className="w-3 h-3 fill-current" />
                                Processado pela IA
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Central Transition Arrow */}
                <motion.div
                    animate={{
                        scale: showAfter ? [1, 1.3, 1] : 1,
                        rotate: showAfter ? 360 : 0,
                    }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.4)] flex items-center justify-center text-primary-foreground pointer-events-none"
                >
                    {showAfter ? <Sparkles className="w-5 h-5 fill-current" /> : <ArrowRight className="w-5 h-5" />}
                </motion.div>
            </div>

            {/* Scanning Line Effect */}
            <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent z-30 opacity-30 pointer-events-none"
            />

            {/* Progress Dots */}
            <div className="relative z-20 flex items-center justify-center gap-1.5 pb-2">
                {showcaseSlides.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-500 ${i === activeSlide ? "w-6 bg-primary" : "w-1 bg-white/20"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
