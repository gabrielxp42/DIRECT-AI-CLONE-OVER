import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ruler, Lock, Unlock, Check, ArrowRight } from 'lucide-react';

interface ResizeModalProps {
    imageUrl: string;
    onConfirm: (resizedUrl: string) => void;
}

const DPI = 300;
const CM_TO_PX_FACTOR = DPI / 2.54;

export default function ResizeModal({ imageUrl, onConfirm }: ResizeModalProps) {
    const [originalDimensions, setOriginalDimensions] = useState({ w: 0, h: 0 });
    const [widthCm, setWidthCm] = useState<number>(0);
    const [heightCm, setHeightCm] = useState<number>(0);
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            setOriginalDimensions({ w, h });

            // Convert existing px to cm
            setWidthCm(parseFloat((w / CM_TO_PX_FACTOR).toFixed(2)));
            setHeightCm(parseFloat((h / CM_TO_PX_FACTOR).toFixed(2)));
            setIsLoading(false);
        };
    }, [imageUrl]);

    // Handle Dimension Change
    const handleWidthChange = (val: string) => {
        let newW = parseFloat(val);
        if (isNaN(newW)) newW = 0;
        setWidthCm(newW);

        if (isLocked && originalDimensions.w > 0) {
            const ratio = originalDimensions.h / originalDimensions.w;
            setHeightCm(parseFloat((newW * ratio).toFixed(2)));
        }
    };

    const handleHeightChange = (val: string) => {
        let newH = parseFloat(val);
        if (isNaN(newH)) newH = 0;
        setHeightCm(newH);

        if (isLocked && originalDimensions.h > 0) {
            const ratio = originalDimensions.w / originalDimensions.h;
            setWidthCm(parseFloat((newH * ratio).toFixed(2)));
        }
    };

    const handleConfirm = () => {
        setIsLoading(true);

        // Timeout to allow UI render before heavy canvas op
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const targetW = Math.round(widthCm * CM_TO_PX_FACTOR);
            const targetH = Math.round(heightCm * CM_TO_PX_FACTOR);

            canvas.width = targetW;
            canvas.height = targetH;

            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = imageUrl;
            img.crossOrigin = "anonymous";

            img.onload = () => {
                ctx?.drawImage(img, 0, 0, targetW, targetH);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const resizedUrl = URL.createObjectURL(blob);
                        onConfirm(resizedUrl);
                    } else {
                        onConfirm(imageUrl); // Fallback
                    }
                }, 'image/png');
            };
        }, 50);
    };

    if (isLoading && originalDimensions.w === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6"
        >
            <div className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 text-white/90">
                    <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
                        <Ruler size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Ajustar Tamanho de Impressão</h3>
                        <p className="text-xs text-white/50">Defina as medidas em CM para 300 DPI</p>
                    </div>
                </div>

                <div className="flex items-end gap-3 mb-6">
                    {/* Width */}
                    <div className="flex-1">
                        <label className="text-xs text-white/40 font-bold mb-1 block uppercase">Largura (cm)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={widthCm}
                            onChange={(e) => handleWidthChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-cyan-500/50 outline-none transition-all"
                        />
                    </div>

                    {/* Lock Toggle */}
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        className={`mb-3 p-2 rounded-lg transition-colors ${isLocked ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/20 hover:text-white/40'}`}
                        title={isLocked ? "Proporção Travada" : "Proporção Livre"}
                    >
                        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                    </button>

                    {/* Height */}
                    <div className="flex-1">
                        <label className="text-xs text-white/40 font-bold mb-1 block uppercase">Altura (cm)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={heightCm}
                            onChange={(e) => handleHeightChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-cyan-500/50 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-white/30 mb-6 bg-white/5 rounded-lg p-3">
                    <span>{originalDimensions.w} x {originalDimensions.h} px (Original)</span>
                    <ArrowRight size={12} />
                    <span className="text-cyan-400 font-bold">
                        {Math.round(widthCm * CM_TO_PX_FACTOR)} x {Math.round(heightCm * CM_TO_PX_FACTOR)} px (300dpi)
                    </span>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={isLoading && originalDimensions.w > 0}
                    className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    {isLoading && originalDimensions.w > 0 ? (
                        'Processando...'
                    ) : (
                        <>
                            <Check size={20} />
                            CONFIRMAR E CONTINUAR
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}
