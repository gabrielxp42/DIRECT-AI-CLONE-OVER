import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Package, MessageCircle, Zap, Bot } from 'lucide-react';

export const ShippingAnimation = () => {
    return (
        <div className="relative w-full h-64 bg-zinc-900/50 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />

            {/* Chat Container */}
            <div className="relative z-10 w-full max-w-[280px] space-y-3">
                {/* User Message */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-end gap-2"
                >
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                        <MessageCircle className="w-3 h-3 text-zinc-400" />
                    </div>
                    <div className="bg-zinc-800 rounded-2xl rounded-bl-sm p-3 text-[10px] text-zinc-300 shadow-lg border border-white/5">
                        Quanto fica o frete para 22041-001?
                    </div>
                </motion.div>

                {/* AI Thinking/Typing */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ delay: 1.5, duration: 1.5, times: [0, 0.2, 1] }}
                    className="flex items-end gap-2"
                >
                    <div className="w-6 h-6 rounded-full bg-[#FFF200]/20 flex items-center justify-center border border-[#FFF200]/30">
                        <Bot className="w-3 h-3 text-[#FFF200]" />
                    </div>
                    <div className="flex gap-1 pl-1">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 h-1 bg-[#FFF200] rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-1 h-1 bg-[#FFF200] rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-1 h-1 bg-[#FFF200] rounded-full" />
                    </div>
                </motion.div>

                {/* AI Response with Quote */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ delay: 3 }} // Appears after thinking
                    className="flex flex-row-reverse items-end gap-2"
                >
                    <div className="w-6 h-6 rounded-full bg-[#FFF200] flex items-center justify-center shadow-[0_0_10px_rgba(255,242,0,0.3)]">
                        <Bot className="w-3 h-3 text-black" />
                    </div>
                    <div className="bg-gradient-to-br from-[#FFF200]/10 to-[#FFF200]/5 rounded-2xl rounded-br-sm p-3 border border-[#FFF200]/20 shadow-lg relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[#FFF200]/5 animate-pulse" />
                        <div className="relative z-10">
                            <p className="text-[10px] text-[#FFF200] font-bold mb-1">Sedex: R$ 12,90 (1 dia)</p>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-400">Gerar Etiqueta?</span>
                                <motion.div
                                    className="px-2 py-0.5 bg-[#FFF200] rounded text-black text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    <Zap className="w-2 h-2 fill-current" />
                                    <span>SIM</span>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Truck Animation Layer */}
            <motion.div
                className="absolute bottom-4 left-[-40px] z-20"
                initial={{ x: -100 }}
                animate={{ x: 400 }}
                transition={{
                    delay: 4.5, // Drives by after quote is confirmed
                    duration: 2,
                    ease: "easeInOut"
                }}
            >
                <div className="relative">
                    <Truck className="w-12 h-12 text-[#FFF200] fill-black/50 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                    <motion.div
                        className="absolute -top-1 -right-1"
                        animate={{ y: [0, -2, 0] }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                    >
                        <Package className="w-5 h-5 text-white fill-blue-600" />
                    </motion.div>
                    {/* Speed lines */}
                    <div className="absolute top-1/2 -left-8 space-y-1">
                        <div className="w-6 h-0.5 bg-[#FFF200]/50 rounded-full" />
                        <div className="w-4 h-0.5 bg-[#FFF200]/30 rounded-full ml-2" />
                    </div>
                </div>
            </motion.div>

            {/* Success Confetti/Particles */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 5.5, duration: 1 }}
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
            >
                <div className="w-full h-full flex items-center justify-center">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-[#FFF200] rounded-full"
                            initial={{ scale: 0 }}
                            animate={{
                                scale: [0, 1, 0],
                                x: Math.cos(i * 60 * (Math.PI / 180)) * 50,
                                y: Math.sin(i * 60 * (Math.PI / 180)) * 50,
                            }}
                            transition={{ duration: 0.8 }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
