import { useMemo } from 'react';
import { useSession } from '@/contexts/SessionProvider';

interface PlusModeStatus {
    /** User has Plus Mode (Expert tier, Admin, Gifted plan, or WhatsApp Add-on) */
    isPlus: boolean;
    /** WhatsApp instance is connected and ready */
    isWhatsAppReady: boolean;
    /** Can use direct Evolution API send (isPlus AND isWhatsAppReady) */
    canSendDirectly: boolean;
    /** Whether the WhatsApp power was specifically gifted by an admin */
    isWhatsAppGifted: boolean;
}

/**
 * Central hook to determine if user has Plus Mode features enabled.
 * Plus Mode unlocks:
 * - Direct WhatsApp send via Evolution API
 * - Gabi-styled action buttons
 * - Premium AI features
 */
export function useIsPlusMode(): PlusModeStatus {
    const { profile } = useSession();

    return useMemo(() => {
        if (!profile) {
            return { isPlus: false, isWhatsAppReady: false, canSendDirectly: false, isWhatsAppGifted: false };
        }

        const isPlus = !!(
            profile.is_admin ||
            profile.subscription_tier === 'expert' ||
            profile.is_gifted_plan ||
            (profile as any).is_whatsapp_plus_active
        );

        const isWhatsAppGifted = !!(profile as any).is_whatsapp_plus_gifted;

        const isWhatsAppReady = !!(
            profile.whatsapp_status &&
            profile.whatsapp_status !== 'disconnected' &&
            profile.whatsapp_instance_id
        );

        return {
            isPlus,
            isWhatsAppReady,
            canSendDirectly: isPlus && isWhatsAppReady,
            isWhatsAppGifted,
        };
    }, [profile]);
}

/**
 * Utility function for use outside React components (e.g., in aiTools.ts)
 * Takes a profile object and returns Plus status.
 */
export function isEligibleForPlusMode(profile: {
    is_admin?: boolean;
    subscription_tier?: string | null;
    is_gifted_plan?: boolean;
    whatsapp_status?: string | null;
    whatsapp_instance_id?: string | null;
}): PlusModeStatus {
    if (!profile) {
        return { isPlus: false, isWhatsAppReady: false, canSendDirectly: false, isWhatsAppGifted: false };
    }

    const isPlus = !!(
        profile.is_admin ||
        profile.subscription_tier === 'expert' ||
        profile.is_gifted_plan ||
        (profile as any).is_whatsapp_plus_active
    );

    const isWhatsAppGifted = !!(profile as any).is_whatsapp_plus_gifted;

    const isWhatsAppReady = !!(
        profile.whatsapp_status &&
        profile.whatsapp_status !== 'disconnected' &&
        profile.whatsapp_instance_id
    );

    return {
        isPlus,
        isWhatsAppReady,
        canSendDirectly: isPlus && isWhatsAppReady,
        isWhatsAppGifted,
    };
}
