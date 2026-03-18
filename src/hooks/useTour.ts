"use client";

import { useSession } from '@/contexts/SessionProvider';
import { useState, useCallback, useEffect } from 'react';
import { TutorialStep } from '@/components/TutorialGuide';
import { useModalQueue } from '@/contexts/ModalQueueContext';

export const useTour = (steps: TutorialStep[], tourId: string) => {
    const { profile, supabase } = useSession();
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const { register, deregister, isAllowed } = useModalQueue();
    const MODAL_ID = `tutorial-${tourId}`;

    const completedTours = profile?.completed_tours || [];

    // Check localStorage first for immediate feedback
    const localCompleted = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('completed_tours') || '[]') : [];
    const isCompleted = completedTours.includes(tourId) || localCompleted.includes(tourId);

    const startTour = useCallback(() => {
        setCurrentStep(0);
        register(MODAL_ID, 10);
        // Only set the open state to true immediately if nothing else is open
        // But the registration itself will eventually allow it
        setIsTourOpen(true);
    }, [register, MODAL_ID]);

    // Cleanup on unmount
    useEffect(() => {
        return () => deregister(MODAL_ID);
    }, [deregister, MODAL_ID]);

    const nextStep = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            completeTour(true);
        }
    }, [currentStep, steps.length]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    const completeTour = useCallback(async (isFinished: boolean) => {
        setIsTourOpen(false);
        deregister(MODAL_ID);

        if (isFinished && !isCompleted) {
            // 1. Immediate Local Update
            const local = JSON.parse(localStorage.getItem('completed_tours') || '[]');
            if (!local.includes(tourId)) {
                local.push(tourId);
                localStorage.setItem('completed_tours', JSON.stringify(local));
            }

            // 2. Database Update (if profile exists)
            if (profile) {
                const updatedTours = [...(profile.completed_tours || []), tourId];
                // De-duplicate just in case
                const uniqueTours = Array.from(new Set(updatedTours));

                const { error } = await supabase
                    .from('profiles_v2')
                    .update({ completed_tours: uniqueTours })
                    .eq('uid', profile.id);

                if (error) {
                    console.error('Error saving tour progress:', error);
                } else {
                    console.log('Tour progress saved to DB');
                }
            }
        }
    }, [isCompleted, profile, supabase, tourId]);

    const closeTour = useCallback(() => {
        // If user manually closes the tour, we consider it "seen" so it doesn't auto-open again.
        completeTour(true);
    }, [completeTour]);

    return {
        isTourOpen: isTourOpen && isAllowed(MODAL_ID),
        isCompleted,
        currentStep,
        steps,
        startTour,
        nextStep,
        prevStep,
        closeTour,
        completeTour,
        shouldAutoStart: !isCompleted && !!profile
    };
};
