import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, MessageCircle, TrendingUp, Banknote, Star } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { cn } from '@/lib/utils';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/hooks/use-toast";
import { GabiActionDialog } from './GabiActionDialog';
import { useIsPlusMode } from '@/hooks/useIsPlusMode';
import { useAIInsights, InsightItem } from '@/hooks/useAIInsights';

const getStatusConfig = (item: InsightItem) => {
    const text = item.text.toLowerCase();
    if (text.includes('pagar') || text.includes('cobrar') || text.includes('pendente') || text.includes('dias sem')) {
        return { 
            borderColor: 'bg-red-500', 
            glowColor: 'rgba(239, 68, 68, 0.5)',
            icon: <Banknote className="h-4 w-4 text-white" />,
            bgTint: 'bg-red-500/5'
        };
    }
    if (text.includes('venda') || text.includes('faturament') || text.includes('pedidos') || text.includes('lucro')) {
        return { 
            borderColor: 'bg-emerald-500', 
            glowColor: 'rgba(16, 185, 129, 0.5)',
            icon: <TrendingUp className="h-4 w-4 text-white" />,
            bgTint: 'bg-emerald-500/5'
        };
    }
    if (text.includes('vip') || text.includes('desconto') || text.includes('oferta')) {
        return { 
            borderColor: 'bg-violet-500', 
            glowColor: 'rgba(139, 92, 246, 0.5)',
            icon: <Star className="h-4 w-4 text-white" />,
            bgTint: 'bg-violet-500/5'
        };
    }
    return { 
        borderColor: 'bg-blue-500', 
        glowColor: 'rgba(59, 130, 246, 0.5)',
        icon: <Sparkles className="h-4 w-4 text-white" />,
        bgTint: 'bg-blue-500/5'
    };
};

export const AIMessagesWidget: React.FC = () => {
    const { supabase } = useSession();
    const [selectedAction, setSelectedAction] = useState<{ message: string, type: 'billing' | 'offer' | 'generic', customerName: string, phone: string } | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { toast } = useToast();
    const { canSendDirectly: isPlusMode } = useIsPlusMode();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { visibleInsights, isLoading: loading, handleDismiss } = useAIInsights();

    const handleActionClickMain = (e: React.MouseEvent, item: InsightItem) => {
        e.stopPropagation();
        if (item.action?.type === 'action' && item.action.directMessage) {
            let customerName = "Cliente";
            const nameMatch = item.text.match(/\*\*(.*?)\*\*/);
            if (nameMatch) customerName = nameMatch[1];
            
            let phone = item.action.phone || "";
            if (!phone && item.action.url) {
                if (item.action.url.includes('phone=')) phone = item.action.url.split('phone=')[1]?.split('&')[0];
                else if (item.action.url.includes('wa.me/')) phone = item.action.url.split('wa.me/')[1]?.split('?')[0];
            }

            setSelectedAction({
                message: item.action.directMessage,
                type: item.action.actionType || 'generic',
                customerName: customerName,
                phone: phone
            });
        } else if (item.action?.type === 'whatsapp') {
            window.open(item.action.url, '_blank');
        } else if (item.action?.url) {
            navigate(item.action.url);
        }
    };

    const handleConfirmActionMain = async (editedMessage?: string) => {
        if (!selectedAction || isActionLoading) return;
        setIsActionLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'send-text', phone: selectedAction.phone, message: editedMessage || selectedAction.message }
            });
            if (error) throw error;
            toast({ title: "Sucesso!", description: `Mensagem enviada.`, duration: 3000 });
            setSelectedAction(null);
        } catch (err) {
            toast({ title: "Erro no envio", description: "Falha ao enviar.", variant: "destructive" });
        } finally {
            setIsActionLoading(false);
        }
    };

    const SwipeableMessage = ({ item, onDismiss }: { item: InsightItem, onDismiss: () => void }) => {
        const [isRemoving, setIsRemoving] = useState(false);
        const config = getStatusConfig(item);

        return (
            <AnimatePresence>
                {!isRemoving && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                        className="relative group w-full mb-3"
                    >
                        <div className={cn(
                            "absolute -inset-1 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none neon-only",
                            config.borderColor
                        )} />

                        <Card className={cn(
                            "relative overflow-hidden border-none transition-all duration-500",
                            "bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 hover:ring-[hsl(var(--primary)/var(--neon-border-opacity))]",
                            "flex items-stretch min-h-[72px] shadow-2xl shadow-black/40"
                        )}>
                            <div className={cn("w-1 flex-shrink-0 relative", config.borderColor)}>
                                <div className="neon-only absolute inset-0 opacity-40 blur-[3px]" style={{ backgroundColor: config.glowColor }} />
                            </div>

                            <div className="flex flex-1 items-center gap-4 p-4 pr-12 bg-white/[0.02]">
                                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center shadow-inner">
                                    {config.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] md:text-sm text-zinc-300 font-medium leading-relaxed" 
                                       dangerouslySetInnerHTML={{
                                           __html: item.text.replace(/\*\*(.*?)\*\*/g, '<b class="text-white font-black tracking-tight">$1</b>')
                                       }} 
                                    />
                                    <div className="flex gap-2 mt-3">
                                        {item.aiAction && isPlusMode && (
                                            <div onClick={(e) => handleActionClickMain(e, item)} className="relative group/btn cursor-pointer">
                                                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 rounded-lg blur-[2px] opacity-20 group-hover/btn:opacity-50 transition-opacity" />
                                                <Button size="sm" variant="ghost" className="relative h-8 bg-zinc-950/90 text-white border-0 hover:bg-black text-[10px] font-black uppercase tracking-tight italic gap-2 px-4 rounded-lg pointer-events-none">
                                                    <Sparkles className="h-3 w-3 text-amber-400" />
                                                    {item.action?.actionType === 'offer' ? "Gabi: Sugerir Oferta" : "Gabi: Cobrar Agora"}
                                                </Button>
                                            </div>
                                        )}
                                        {item.action && item.action.type !== 'action' && (
                                            <Button size="sm" variant="outline" className="h-8 bg-white/5 border border-white/10 text-zinc-400 text-[10px] uppercase font-black tracking-widest hover:bg-white/10 hover:text-white transition-all" onClick={(e) => handleActionClickMain(e, item)}>
                                                {item.action.type === 'whatsapp' && <MessageCircle className="h-3 w-3 text-emerald-500 mr-1" />}
                                                {item.action.label}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => { setIsRemoving(true); setTimeout(onDismiss, 200); }} className="absolute right-3 top-4 p-2 rounded-full hover:bg-white/10 text-zinc-600 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                                <X className="h-4 w-4" />
                            </button>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    };

    if (loading) return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-[80px] bg-white/5 rounded-2xl animate-pulse ring-1 ring-white/10" />)}</div>;

    const Content = () => (
        <div className="space-y-1">
            {visibleInsights.length > 0 ? (
                visibleInsights.map((item) => <SwipeableMessage key={item.id} item={item} onDismiss={() => handleDismiss(item.id)} />)
            ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-30"><Sparkles className="h-10 w-10 mb-2" /><p className="text-sm font-medium">Tudo sob controle!</p></div>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ai" className="border-none">
                    <AccordionTrigger className="hover:no-underline bg-white/5 backdrop-blur-xl p-4 rounded-2xl ring-1 ring-white/10 shadow-lg">
                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/20 rounded-xl"><Sparkles className="h-5 w-5 text-primary" /></div><div className="text-left"><p className="text-sm font-bold text-white">Assistente Gabi</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{visibleInsights.length} TAREFAS</p></div></div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4"><Content /></AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }

    return (
        <div id="ai-insights-section" className="w-full">
            <Content />
            {selectedAction && (
                <GabiActionDialog
                    isOpen={!!selectedAction}
                    onOpenChange={(open) => !open && setSelectedAction(null)}
                    customerName={selectedAction.customerName}
                    messagePreview={selectedAction.message}
                    phone={selectedAction.phone}
                    onConfirm={(msg) => handleConfirmActionMain(msg)}
                    isLoading={isActionLoading}
                    actionType={selectedAction.type}
                />
            )}
        </div>
    );
};