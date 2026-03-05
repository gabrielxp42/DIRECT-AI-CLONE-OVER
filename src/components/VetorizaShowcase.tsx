
import { motion } from "framer-motion";
import { Sparkles, Zap, ArrowRight, ShieldCheck } from "lucide-react";

export function VetorizaShowcase() {
    return (
        <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black/40 border border-white/10 shadow-2xl group">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-tr from-amber-500/20 to-transparent blur-[80px] opacity-30" />
            </div>

            {/* Images Comparison */}
            <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                <div className="relative w-full h-full flex items-center justify-center gap-4">
                    {/* Before (Low Quality) */}
                    <motion.div
                        initial={{ opacity: 1, x: 0 }}
                        animate={{
                            opacity: [1, 1, 0.2, 0.2, 1],
                            x: [0, -40, -40, 0, 0],
                            scale: [1, 0.9, 0.9, 1, 1]
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            times: [0, 0.2, 0.4, 0.8, 1]
                        }}
                        className="relative w-1/2 h-full rounded-2xl overflow-hidden border border-white/5 bg-white/5 backdrop-blur-sm"
                    >
                        <img
                            src="/BAIXA-QUALIDADE-BRASIL.png"
                            alt="Baixa Qualidade"
                            className="w-full h-full object-contain p-4 opacity-60 grayscale-[0.3]"
                        />
                        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
                            <span className="text-[10px] font-black uppercase text-zinc-400">Antes (Bitmap)</span>
                        </div>
                    </motion.div>

                    {/* Transition Effect Icon */}
                    <motion.div
                        animate={{
                            rotate: 360,
                            scale: [1, 1.2, 1]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute z-20 w-12 h-12 rounded-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center justify-center text-black"
                    >
                        <Zap className="w-6 h-6 fill-current" />
                    </motion.div>

                    {/* After (High Quality) */}
                    <motion.div
                        initial={{ opacity: 0.2, x: 0 }}
                        animate={{
                            opacity: [0.2, 0.2, 1, 1, 0.2],
                            x: [0, 40, 40, 0, 0],
                            scale: [1, 1.1, 1.1, 1, 1]
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            times: [0, 0.2, 0.4, 0.8, 1]
                        }}
                        className="relative w-1/2 h-full rounded-2xl overflow-hidden border border-amber-500/30 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                    >
                        <img
                            src="/ALTA-QUALIDADE-BRASIL.png"
                            alt="Alta Qualidade"
                            className="w-full h-full object-contain p-4"
                        />
                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-amber-500 shadow-lg">
                            <span className="text-[10px] font-black uppercase text-black">Vetorizado (SVG)</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Scanning Line Effect */}
            <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent z-30 opacity-50"
            />
        </div>
    );
}
