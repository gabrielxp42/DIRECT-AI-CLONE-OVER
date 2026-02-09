import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, Sparkles, ExternalLink } from 'lucide-react';
import { useIsPlusMode } from '@/hooks/useIsPlusMode';
import { GabiActionDialog } from '@/components/GabiActionDialog';
import { useSession } from '@/contexts/SessionProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WhatsAppButtonProps {
    /** Phone number (with or without formatting) */
    phone: string;
    /** Message content to send */
    message: string;
    /** Button label */
    label?: string;
    /** Customer name for dialog */
    customerName?: string;
    /** Action type for styling (billing, offer, generic) */
    actionType?: 'billing' | 'offer' | 'generic';
    /** Additional CSS classes */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'default' | 'lg';
    /** Disable the button */
    disabled?: boolean;
    /** Callback after successful send (Plus mode only) */
    onSuccess?: () => void;
}

/**
 * Universal WhatsApp Button Component
 * - Normal users: Opens wa.me link
 * - Plus users: Opens Gabi-styled confirmation dialog → Direct send via Evolution API
 */
export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
    phone,
    message,
    label = 'Enviar WhatsApp',
    customerName = 'Cliente',
    actionType = 'generic',
    className,
    size = 'default',
    disabled = false,
    onSuccess,
}) => {
    const { canSendDirectly, isPlus } = useIsPlusMode();
    const { supabase } = useSession();
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    const handleClick = () => {
        if (canSendDirectly) {
            // Plus Mode: Open confirmation dialog
            setDialogOpen(true);
        } else {
            // Normal Mode: Open WhatsApp Web
            window.open(waLink, '_blank');
        }
    };

    const handleDirectSend = async (phoneToUse?: string) => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const phoneNumber = (phoneToUse || phone).replace(/\D/g, '');
            const finalPhone = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;

            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'send-text',
                    phone: finalPhone,
                    message: message,
                },
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'Erro ao enviar');

            toast({
                title: 'Mensagem Enviada! 🚀',
                description: `Mensagem enviada para ${customerName}.`,
                duration: 3000,
                className: 'bg-green-500 text-white border-0',
            });

            setDialogOpen(false);
            onSuccess?.();
        } catch (err: any) {
            console.error('WhatsAppButton send error:', err);
            toast({
                title: 'Erro no Envio',
                description: 'Não foi possível enviar. Abrindo WhatsApp Web como fallback...',
                variant: 'destructive',
            });
            // Fallback to wa.me link
            window.open(waLink, '_blank');
            setDialogOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Style based on Plus mode AND connection status
    const showPremiumStyle = canSendDirectly;

    const buttonStyle = showPremiumStyle
        ? // Gabi Style (Premium)
        cn(
            'gap-2 font-black text-slate-900 shadow-xl shadow-purple-500/10',
            'bg-gradient-to-r from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7]',
            'border-0 hover:brightness-110 hover:scale-[1.02] transition-all',
            className
        )
        : // Standard WhatsApp Style
        cn(
            'gap-2 font-medium',
            'bg-[#25D366] hover:bg-[#20BA5C] text-white',
            'border-0 shadow-sm',
            className
        );

    const iconComponent = showPremiumStyle ? (
        <Sparkles className="w-4 h-4" />
    ) : (
        <MessageCircle className="w-4 h-4" />
    );

    return (
        <>
            <Button
                onClick={handleClick}
                disabled={disabled || (!showPremiumStyle && !phone)}
                size={size}
                className={buttonStyle}
            >
                {iconComponent}
                {label}
                {!showPremiumStyle && <ExternalLink className="w-3 h-3 opacity-70" />}
            </Button>

            {/* Gabi Action Dialog (Plus Mode Only) */}
            <GabiActionDialog
                isOpen={dialogOpen}
                onOpenChange={setDialogOpen}
                customerName={customerName}
                phone={phone}
                messagePreview={message}
                onConfirm={handleDirectSend}
                isLoading={isLoading}
                actionType={actionType}
            />
        </>
    );
};
