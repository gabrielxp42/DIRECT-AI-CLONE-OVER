import React, { useMemo } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const SubscriptionAlert = () => {
    const { profile } = useSession();
    const navigate = useNavigate();

    const alertStatus = useMemo(() => {
        if (!profile?.next_billing_date || profile.subscription_status !== 'active') return null;

        const today = new Date();
        const dueDate = new Date(profile.next_billing_date);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return {
                type: 'critical',
                message: "Sua assinatura vence HOJE!",
                color: "bg-red-500",
                textColor: "text-white"
            };
        }

        if (diffDays <= 3) {
            return {
                type: 'warning',
                message: `Sua assinatura vence em ${diffDays} dias.`,
                color: "bg-[#FFF200]",
                textColor: "text-black"
            };
        }

        if (diffDays <= 6) {
            return {
                type: 'info',
                message: `Lembrete: Sua assinatura vence em ${diffDays} dias.`,
                color: "bg-blue-600",
                textColor: "text-white"
            };
        }

        return null;
    }, [profile]);

    if (!alertStatus) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`${alertStatus.color} ${alertStatus.textColor} w-full overflow-hidden`}
            >
                <div className="container mx-auto px-4 py-2 flex items-center justify-between text-xs md:text-sm font-bold uppercase tracking-wide">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{alertStatus.message}</span>
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        className={`hover:bg-black/10 h-7 text-xs px-3 ${alertStatus.textColor === 'text-white' ? 'text-white' : 'text-black'}`}
                        onClick={() => navigate('/profile')} // Link correto para o perfil
                    >
                        <span>Renovar Agora</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
