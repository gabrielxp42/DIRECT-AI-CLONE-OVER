

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Coins, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'coins';

interface NotificationToastProps {
    message: string;
    type?: NotificationType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export default function NotificationToast({
    message,
    type = 'info',
    isVisible,
    onClose,
    duration = 3000
}: NotificationToastProps) {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'coins': return <Coins className="w-5 h-5 text-yellow-400" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
            default: return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'coins': return 'bg-yellow-500/10 border-yellow-500/20';
            case 'success': return 'bg-green-500/10 border-green-500/20';
            case 'error': return 'bg-red-500/10 border-red-500/20';
            default: return 'bg-blue-500/10 border-blue-500/20';
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: -20, x: '-50%' }}
                    className={`fixed top-24 left-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-md border shadow-xl ${getBgColor()}`}
                >
                    {getIcon()}
                    <span className="font-medium text-white/90 text-sm">{message}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
