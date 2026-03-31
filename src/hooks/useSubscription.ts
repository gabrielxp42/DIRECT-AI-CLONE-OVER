
import { useSession } from '@/contexts/SessionProvider';
import { differenceInDays, addDays, parseISO } from 'date-fns';

export interface SubscriptionState {
    isTrial: boolean;
    isActive: boolean;
    isExpired: boolean;
    daysRemaining: number;
    trialEndsAt: Date | null;
    dailyUsage: number;
    maxDailyUsage: number;
    canUseAI: boolean;
    canWriteData: boolean;
    isWhatsAppPlusActive: boolean;
}

export const useSubscription = (): SubscriptionState => {
    const { session, profile, isLoading } = useSession();

    // Default state while loading
    if (isLoading) {
        return {
            isTrial: true,
            isActive: false,
            isExpired: false,
            daysRemaining: 30,
            trialEndsAt: null,
            dailyUsage: 0,
            maxDailyUsage: 20,
            canUseAI: false,
            canWriteData: true, // Optimistic during loading
            isWhatsAppPlusActive: false
        };
    }

    // Fallback if profile is missing - Restricted by default
    const effectiveProfile = profile;

    if (!effectiveProfile) {
        return {
            isTrial: false,
            isActive: false,
            isExpired: true,
            daysRemaining: 0,
            trialEndsAt: null,
            dailyUsage: 0,
            maxDailyUsage: 20,
            canUseAI: false,
            canWriteData: false,
            isWhatsAppPlusActive: false
        };
    }

    const TRIAL_DURATION_DAYS = 30; // Increasing to 30 for trial periods to be safer

    // Normalize status (default to trial if missing)
    const status = effectiveProfile.subscription_status || 'trial';
    const isTrial = status === 'trial';
    const isActive = status === 'active';
    const isStatusExpired = status === 'expired';

    // Normalize date string (replace space with T for SQL timestamps)
    const dateString = effectiveProfile.trial_start_date
        ? String(effectiveProfile.trial_start_date).replace(' ', 'T')
        : new Date().toISOString();

    const start = new Date(dateString);
    const isValidDate = !isNaN(start.getTime());

    const trialEndsAt = isValidDate ? addDays(start, TRIAL_DURATION_DAYS) : addDays(new Date(), TRIAL_DURATION_DAYS);
    const today = new Date();

    let daysRemaining = 0;
    if (isActive && effectiveProfile.next_billing_date) {
        const nextBilling = new Date(effectiveProfile.next_billing_date);
        daysRemaining = Math.max(0, differenceInDays(nextBilling, today));
    } else {
        const daysUsed = isValidDate ? Math.max(0, differenceInDays(today, start)) : 0;
        daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - daysUsed);
    }

    // Logic: It is expired if status says so OR if trial days ran out and not active
    const isExpired = isStatusExpired || (isTrial && daysRemaining <= 0);

    // Daily Limits
    const MAX_DAILY_AI = 20; // Increasing daily AI count for trials too
    const currentUsage = effectiveProfile.daily_ai_count || 0;

    // Permissions
    // Can Write: If Active OR (Trial AND Not Expired)
    const canWriteData = isActive || (isTrial && !isExpired);

    // Can AI: Can Write AND (Active (unlimited) OR (Usage < Max))
    const canUseAI = canWriteData && (isActive || currentUsage < MAX_DAILY_AI);

    return {
        isTrial,
        isActive,
        isExpired,
        daysRemaining,
        trialEndsAt,
        dailyUsage: currentUsage,
        maxDailyUsage: MAX_DAILY_AI,
        canUseAI,
        canWriteData,
        isWhatsAppPlusActive: !!effectiveProfile.is_whatsapp_plus_active
    };
};
