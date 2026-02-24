import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Plus, Package, MousePointer, Search, Check, MessageCircle, Send, FileText } from 'lucide-react';

export const OrderCreationAnimation = () => {
    return (
        <div className="relative w-full h-64 bg-zinc-900/50 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />

            {/* Interface container */}
            <div className="relative z-10 w-full max-w-[280px] bg-zinc-950/90 border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col min-h-[220px]">
                {/* Header */}
                <div className="h-8 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between px-3">
                    <span className="text-[10px] font-bold text-zinc-400">Novo Pedido #1234</span>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/50" />
                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-4 space-y-4 relative flex-1">
                    {/* Client Field */}
                    <div className="space-y-1">
                        <div className="w-12 h-2 bg-zinc-800 rounded" />
                        <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 0.5 }}
                            className="h-7 bg-zinc-900 border border-white/5 rounded flex items-center px-2"
                        >
                            <span className="text-[9px] text-zinc-300">Gabriel (Direct AI)</span>
                        </motion.div>
                    </div>

                    {/* Products */}
                    <motion.div
                        className="space-y-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <div className="w-16 h-2 bg-zinc-800 rounded" />
                        <div className="h-10 bg-zinc-900 border border-white/5 rounded flex items-center gap-2 px-2">
                            <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                                <Package className="w-3 h-3 text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <div className="w-20 h-2 bg-zinc-800 rounded mb-1" />
                                <div className="w-10 h-1.5 bg-zinc-800/50 rounded" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Shipping Section */}
                    <motion.div
                        className="pt-2 border-t border-white/5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-zinc-400">Frete & Envio</span>
                        </div>

                        {/* Button that gets clicked */}
                        <motion.div
                            className="h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/5 rounded flex items-center justify-center gap-2 cursor-pointer group relative overflow-hidden"
                            animate={{
                                backgroundColor: ["#27272a", "#3f3f46", "#FFF200"],
                                color: ["#a1a1aa", "#ffffff", "#000000"]
                            }}
                            transition={{ times: [0, 0.8, 1], delay: 1.5, duration: 2 }}
                        >
                            <Truck className="w-3 h-3" />
                            <span className="text-[9px] font-bold">Cotar Frete</span>
                        </motion.div>

                        {/* Results showing up */}
                        <motion.div
                            className="mt-2 space-y-1 overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            transition={{ delay: 3.8, duration: 0.5 }}
                        >
                            {/* SEDEX Option - Selected */}
                            <motion.div
                                className="flex items-center justify-between p-1.5 rounded bg-[#FFF200]/10 border border-[#FFF200]/20 relative overflow-hidden"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 4 }}
                            >
                                <div className="flex items-center gap-1.5 relative z-10">
                                    <div className="w-4 h-4 rounded bg-[#FFF200] flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-black" />
                                    </div>
                                    <span className="text-[9px] text-[#FFF200] font-bold">SEDEX (Selecionado)</span>
                                </div>
                                <span className="text-[9px] text-white font-bold relative z-10">R$ 22,90</span>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Final Success Overlay - The "Marketing Moment" */}
                {/* Replaces the whole form view to clearly show the "Next Step" happening */}
                <motion.div
                    className="absolute inset-0 z-20 bg-[#25D366] flex flex-col items-center justify-center text-center p-4"
                    initial={{ y: "100%" }}
                    animate={{ y: "0%" }}
                    transition={{ delay: 6.5, type: "spring", damping: 20 }}
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 6.8, type: "spring" }}
                        className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3 shadow-lg"
                    >
                        <MessageCircle className="w-8 h-8 text-[#25D366] fill-[#25D366]" />
                    </motion.div>

                    <motion.h3
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 7.0 }}
                        className="text-white font-black text-lg leading-tight mb-1"
                    >
                        Rastreio Enviado!
                    </motion.h3>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 7.2 }}
                        className="text-white/90 text-[10px] font-medium"
                    >
                        O cliente recebeu o código no WhatsApp.
                    </motion.p>

                    {/* Simulated Message Bubble */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 7.5 }}
                        className="mt-4 bg-white/20 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2 w-full max-w-[200px]"
                    >
                        <FileText className="w-4 h-4 text-white" />
                        <div className="flex-1 text-left">
                            <div className="h-1.5 w-16 bg-white/60 rounded mb-1" />
                            <div className="h-1 w-24 bg-white/40 rounded" />
                        </div>
                        <Check className="w-3 h-3 text-white" />
                    </motion.div>
                </motion.div>

                {/* Cursor Animation */}
                <motion.div
                    className="absolute z-50 pointer-events-none"
                    initial={{ x: 200, y: 200, opacity: 0 }}
                    animate={{
                        x: [200, 180, 140, 140, 140, 140, 140, 140, 280],
                        y: [200, 150, 180, 180, 180, 230, 230, 230, 300],
                        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 0],
                        scale: [1, 1, 1, 0.8, 1, 1, 0.8, 1, 1]
                    }}
                    transition={{
                        duration: 4,
                        times: [0, 0.2, 0.25, 0.3, 0.5, 0.55, 0.6, 0.8, 1],
                        delay: 1.2
                    }}
                >
                    <MousePointer className="w-5 h-5 text-[#FFF200] fill-black" strokeWidth={1} />
                </motion.div>
            </div>
        </div>
    );
};
