"use client";

import { useSession } from '@/contexts/SessionProvider';
import { useState, useCallback } from 'react';
import { TutorialStep } from '@/components/TutorialGuide';

export const useTour = (steps: TutorialStep[], tourId: string) => {
    const { profile, supabase } = useSession();
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const completedTours = profile?.completed_tours || [];
    const isCompleted = completedTours.includes(tourId);

    const startTour = useCallback(() => {
        setCurrentStep(0);
        setIsTourOpen(true);
    }, []);

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

        if (isFinished && !isCompleted && profile) {
            const updatedTours = [...completedTours, tourId];

            const { error } = await supabase
                .from('profiles')
                .update({ completed_tours: updatedTours })
                .eq('id', (await supabase.auth.getUser()).data.user?.id);

            if (error) {
                console.error('Error saving tour progress:', error);
            }
        }
    }, [completedTours, isCompleted, profile, supabase, tourId]);

    const closeTour = useCallback(() => {
        setIsTourOpen(false);
    }, []);

    return {
        isTourOpen,
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
