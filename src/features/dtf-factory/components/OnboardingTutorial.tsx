

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Sparkles, PenLine, Image, Lightbulb, Shirt, Palette, X } from 'lucide-react';

interface OnboardingTutorialProps {
    onComplete: () => void;
}

const STEPS = [
    {
        icon: Sparkles,
        title: 'Bem-vindo ao DTF Factory!',
        description: 'Crie artes profissionais para estampas DTF usando inteligência artificial. Vamos conhecer o modo gratuito!',
        color: 'from-cyan-500 to-blue-600',
    },
    {
        icon: PenLine,
        title: 'Prompt de Criação',
        description: 'Descreva a imagem que deseja criar. Quanto mais detalhes, melhor será o resultado!',
        color: 'from-purple-500 to-indigo-600',
    },
    {
        icon: Image,
        title: 'Imagens de Referência',
        description: 'Carregue até 5 imagens como referência para guiar a IA na criação.',
        color: 'from-pink-500 to-rose-600',
    },
    {
        icon: Lightbulb,
        title: 'Ideias Prontas',
        description: 'Use o botão "Ideias" para se inspirar com prompts sugeridos pela comunidade.',
        color: 'from-amber-500 to-orange-600',
    },
    {
        icon: Shirt,
        title: 'Tipo de Camiseta',
        description: 'Escolha entre camiseta preta ou branca. Cada uma gera um resultado otimizado para aquele fundo.',
        color: 'from-emerald-500 to-teal-600',
    },
    {
        icon: Palette,
        title: 'Estilos',
        description: 'Selecione um estilo visual (Streetwear, Vintage, Neon...) para personalizar a arte com sua identidade.',
        color: 'from-red-500 to-pink-600',
    },
];

export default function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem('dtf_onboarding_completed');
        if (!completed) {
            setShow(true);
        }
    }, []);

    const handleComplete = () => {
        localStorage.setItem('dtf_onboarding_completed', 'true');
        setShow(false);
        onComplete();
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    if (!show) return null;

    const step = STEPS[currentStep];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
            >
                {/* Skip */}
                <button
                    onClick={handleComplete}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white"
                >
                    <X size={18} />
                </button>

                {/* Icon */}
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                    <step.icon className="w-10 h-10 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-center text-white mb-3">
                    {step.title}
                </h3>
                <p className="text-white/50 text-center text-sm leading-relaxed mb-8">
                    {step.description}
                </p>

                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mb-6">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep
                                ? 'w-8 bg-cyan-500'
                                : i < currentStep
                                    ? 'w-1.5 bg-cyan-500/50'
                                    : 'w-1.5 bg-white/10'
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex gap-3">
                    {currentStep > 0 && (
                        <button
                            onClick={handlePrev}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Voltar
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={`flex-1 py-3 bg-gradient-to-r ${step.color} text-white font-bold rounded-xl transition-all hover:shadow-lg flex items-center justify-center gap-2`}
                    >
                        {currentStep === STEPS.length - 1 ? 'Começar!' : 'Próximo'}
                        {currentStep < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* Step Counter */}
                <p className="text-center text-xs text-white/20 mt-4">
                    {currentStep + 1} de {STEPS.length}
                </p>
            </motion.div>
        </motion.div>
    );
}
