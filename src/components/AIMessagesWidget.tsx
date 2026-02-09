import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, MessageCircle, ExternalLink } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
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

export const AIMessagesWidget: React.FC = () => {
    const { supabase } = useSession();
    const [selectedAction, setSelectedAction] = useState<{ message: string, type: 'billing' | 'offer' | 'generic', customerName: string, phone: string } | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { toast } = useToast();
    const { canSendDirectly: isPlusMode } = useIsPlusMode();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const { visibleInsights, isLoading: loading, handleDismiss } = useAIInsights();

    const triggerAI = (msg: string) => {
        window.dispatchEvent(new CustomEvent('trigger-ai-message', { detail: msg }));
    };

    const handleActionClickMain = (e: React.MouseEvent, item: InsightItem) => {
        e.stopPropagation();
        if (item.action?.type === 'action' && item.action.directMessage) {
            let customerName = "Cliente";
            const nameMatch = item.text.match(/\*\*(.*?)\*\*/);
            if (nameMatch) customerName = nameMatch[1];

            let phone = item.action.phone || "";
            if (!phone) {
                if (item.action.url && item.action.url.includes('phone=')) {
                    phone = item.action.url.split('phone=')[1]?.split('&')[0];
                } else if (item.action.url && item.action.url.includes('wa.me/')) {
                    phone = item.action.url.split('wa.me/')[1]?.split('?')[0];
                }
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
        const currentMessage = editedMessage || selectedAction.message;

        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'send-text',
                    phone: selectedAction.phone,
                    message: currentMessage
                }
            });

            if (error) throw error;
            if (!data || !data.success) throw new Error(data?.message || 'Erro ao enviar mensagem');

            toast({
                title: "Sucesso! 🚀",
                description: `Mensagem enviada para ${selectedAction.customerName}.`,
                duration: 3000,
                className: "bg-green-500 text-white border-0"
            });

            setSelectedAction(null);
        } catch (err: any) {
            console.error('Erro no envio:', err);
            toast({
                title: "Erro no envio ❌",
                description: "Não foi possível enviar automaticamente. Abrindo WhatsApp Web...",
                variant: "destructive",
            });
            setSelectedAction(null);
        } finally {
            setIsActionLoading(false);
        }
    };

    const SwipeableMessage = ({ item, onDismiss }: { item: InsightItem, onDismiss: () => void }) => {
        const [isRemoving, setIsRemoving] = useState(false);

        const getStyles = (type: string) => {
            switch (type) {
                case 'alert': return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
                case 'warning': return 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20';
                case 'success': return 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20';
                default: return 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20';
            }
        };

        const handleDismissClick = () => {
            setIsRemoving(true);
            setTimeout(onDismiss, 400);
        };

        const handleDragEnd = (event: any, info: any) => {
            const threshold = 120;
            const velocity = Math.abs(info.velocity.x);
            if (Math.abs(info.offset.x) > threshold || velocity > 500) {
                setIsRemoving(true);
                setTimeout(onDismiss, 400);
            }
        };

        return (
            <AnimatePresence>
                {!isRemoving && (
                    <motion.div
                        drag={isMobile ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.15}
                        onDragEnd={handleDragEnd}
                        initial={{ opacity: 0, x: -30, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative mb-2"
                    >
                        <Card className={`p-4 border-l-4 pr-8 relative ${getStyles(item.type)} transition-shadow hover:shadow-md`}>
                            <div className="flex flex-col gap-3">
                                <p className="text-sm select-none" dangerouslySetInnerHTML={{
                                    __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }} />

                                <div className="flex gap-2 flex-wrap items-center mt-1">
                                    {item.action && item.action.type !== 'action' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs gap-2 bg-background/50 hover:bg-background border-zinc-200 dark:border-zinc-800"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (item.action?.type === 'whatsapp') {
                                                    window.open(item.action.url, '_blank');
                                                } else if (item.action?.url) {
                                                    navigate(item.action.url);
                                                }
                                            }}
                                        >
                                            {item.action.type === 'whatsapp' && <MessageCircle className="h-3.5 w-3.5 text-green-500" />}
                                            {item.action.label}
                                            <ExternalLink className="h-3 w-3 opacity-50" />
                                        </Button>
                                    )}

                                    {item.aiAction && (
                                        isPlusMode ? (
                                            <div className="relative group rounded-lg p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-sm hover:shadow-md transition-all cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.action?.type === 'action') {
                                                        handleActionClickMain(e, item);
                                                    } else {
                                                        triggerAI(item.aiAction!.message);
                                                    }
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-sm rounded-lg group-hover:opacity-40 transition-opacity pointer-events-none" />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="relative h-8 text-xs gap-2 bg-slate-950/90 text-white hover:bg-slate-900 border-0 hover:text-white w-full pointer-events-none"
                                                >
                                                    <Sparkles className="h-3.5 w-3.5 text-[#ffd93d]" />
                                                    {item.action?.actionType === 'offer' ? "DEIXAR A GABI OFERECER O DESCONTO ⚡" : "DEIXAR A GABI COBRAR 👊🏽"}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs gap-2 bg-[#25D366] hover:bg-[#20BA5C] text-white border-0 shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.action?.url) {
                                                        window.open(item.action.url, '_blank');
                                                    }
                                                }}
                                            >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                                {item.action?.actionType === 'offer' ? "Enviar Oferta" : "Enviar Cobrança"}
                                                <ExternalLink className="h-3 w-3 opacity-70" />
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>

                            <motion.button
                                onClick={handleDismissClick}
                                className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <X className="h-4 w-4 text-muted-foreground" />
                            </motion.button>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    };

    if (loading) return <div className="h-20 bg-muted rounded-lg animate-pulse" />;

    const Content = () => (
        <div className="space-y-2">
            {visibleInsights.length > 0 ? (
                visibleInsights.map((item) => (
                    <SwipeableMessage
                        key={item.id}
                        item={item}
                        onDismiss={() => handleDismiss(item.id)}
                    />
                ))
            ) : (
                <Card className="p-4 border-dashed text-center text-muted-foreground text-sm">
                    Tudo limpo! Bom trabalho! 👍
                </Card>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ai-insights" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8 border-2 border-primary shadow-sm">
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                                    <Sparkles className="h-4 w-4" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold">Assistente IA</p>
                                <p className="text-xs text-muted-foreground">
                                    {visibleInsights.length > 0 ? `${visibleInsights.length} alertas` : "Tudo limpo! ✨"}
                                </p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <Content />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }

    return (
        <div id="ai-insights-section" className="space-y-3">
            <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border-2 border-primary shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold">Assistente IA</p>
                    <p className="text-xs text-muted-foreground">
                        {visibleInsights.length > 0 ? "Algumas coisas que notei..." : "Tudo limpo! ✨"}
                    </p>
                </div>
            </div>
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
