

import { useState, useEffect, useCallback } from 'react';
import { electronBridge } from '@dtf/lib/electronBridge';
import { motion } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';

interface RecentBoxProps {
    onSelectImage: (file: File) => void;
}

export default function RecentBox({ onSelectImage }: RecentBoxProps) {
    const [recentImages, setRecentImages] = useState<{ path: string; data: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadRecents = useCallback(async () => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const result = await electronBridge.getRecentDownloads();
            if (result.success && result.files && result.files.length > 0) {
                // Carregar apenas 4 imagens, uma por vez para não travar
                const imagesToLoad = result.files.slice(0, 4);
                const loaded: { path: string; data: string }[] = [];

                for (const filePath of imagesToLoad) {
                    try {
                        const fileData = await electronBridge.readImageFile(filePath);
                        if (fileData.success && fileData.data) {
                            loaded.push({ path: filePath, data: fileData.data });
                        }
                    } catch {
                        // Ignora erros individuais
                    }
                }
                setRecentImages(loaded);
            }
        } catch (error) {
            console.error('Erro ao carregar recentes:', error);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    }, [isLoading]);

    // Carrega apenas uma vez quando o componente monta
    useEffect(() => {
        if (!hasLoaded) {
            // Delay para não travar a UI inicial
            const timer = setTimeout(() => {
                loadRecents();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasLoaded, loadRecents]);

    const handleImageClick = async (img: { path: string; data: string }) => {
        try {
            const res = await fetch(img.data);
            const blob = await res.blob();
            const filename = img.path.split(/[/\\]/).pop() || 'download.png';
            const file = new File([blob], filename, { type: blob.type });
            onSelectImage(file);
        } catch (error) {
            console.error('Erro ao selecionar imagem:', error);
        }
    };

    // Não renderiza nada se não carregou ou está vazio
    if (!hasLoaded && !isLoading) return null;
    if (hasLoaded && recentImages.length === 0) return null;

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                    <Clock size={12} />
                    Downloads Recentes
                </div>
                <button
                    onClick={loadRecents}
                    disabled={isLoading}
                    className="p-1 hover:bg-white/5 rounded text-white/20 hover:text-white/60 transition-colors disabled:opacity-50"
                    title="Atualizar"
                >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {isLoading && recentImages.length === 0 ? (
                    // Skeleton loading - apenas se ainda não tem imagens
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-square bg-white/5 rounded-lg animate-pulse" />
                    ))
                ) : (
                    recentImages.map((img, idx) => (
                        <motion.button
                            key={img.path}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => handleImageClick(img)}
                            className="group relative aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-cyan-500/50 transition-colors bg-black/40"
                        >
                            <img
                                src={img.data}
                                alt="Recent"
                                loading="lazy"
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                        </motion.button>
                    ))
                )}
            </div>
        </div>
    );
}
