import React, { useState, useEffect } from 'react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useSession } from '@/contexts/SessionProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const AIFirstOnboarding = () => {
    const { companyProfile, updateProfileAsync, isLoading } = useCompanyProfile();
    const { session } = useSession();
    
    // Determine if onboarding is needed
    // We only demand it if company_name, company_pix_key or origin_zip_code are missing
    const needsOnboarding = Boolean(
        companyProfile && 
        session && 
        (!companyProfile.company_name || !companyProfile.company_pix_key || !companyProfile.origin_zip_code)
    );

    const [step, setStep] = useState(0);
    const [companyName, setCompanyName] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (companyProfile) {
            if (companyProfile.company_name) setCompanyName(companyProfile.company_name);
            if (companyProfile.company_pix_key) setPixKey(companyProfile.company_pix_key);
            if (companyProfile.origin_zip_code) setZipCode(companyProfile.origin_zip_code);
            
            // Auto-advance if partially completed before
            if (!companyProfile.company_name) setStep(0);
            else if (!companyProfile.company_pix_key) setStep(1);
            else if (!companyProfile.origin_zip_code) setStep(2);
        }
    }, [companyProfile]);

    if (isLoading || !needsOnboarding) return null;

    const steps = [
        {
            title: "Bem-vindo ao Direct AI!",
            message: "Olá! Eu sou a Gabi, sua IA assistente. Notei que esta é sua primeira vez aqui. Para que o sistema funcione perfeitamente (orçamentos, automações e recebimentos), precisamos configurar 3 coisinhas rápidas.\n\nQual o NOME da sua empresa?",
            field: companyName,
            setField: setCompanyName,
            placeholder: "Ex: Gráfica Expressa"
        },
        {
            title: "Automação de Recebimentos",
            message: `Ótimo nome, ${companyName}! 🚀 Agora me informe a sua CHAVE PIX (empresa). Eu usarei ela automaticamente em todos os orçamentos e faturas geradas para os seus clientes.`,
            field: pixKey,
            setField: setPixKey,
            placeholder: "E-mail, CPF/CNPJ, Celular ou Aleatória"
        },
        {
            title: "Logística e Fretes",
            message: "Quase pronto! Para os cálculos automáticos de frete e prazos, de onde você envia os pedidos? (Digite o CEP de origem da sua loja ou fábrica).",
            field: zipCode,
            setField: setZipCode,
            placeholder: "Ex: 01001-000"
        }
    ];

    const currentStepData = steps[step];

    const handleNext = async () => {
        if (!currentStepData.field || currentStepData.field.trim() === '') return;
        
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            setIsSaving(true);
            try {
                await updateProfileAsync({
                    company_name: companyName,
                    company_pix_key: pixKey,
                    origin_zip_code: zipCode
                });
                
                // Forçar o re-fetch do SessionProvider para que needsOnboarding vire false e feche o modal
                window.dispatchEvent(new CustomEvent('refresh-profile'));
            } catch (error) {
                console.error(error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-lg"
            >
                <Card className="border-white/10 bg-[#12141A] shadow-2xl shadow-primary/20 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-primary to-purple-500" />
                    
                    <div className="p-8 flex flex-col items-center text-center space-y-6">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center relative shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                            <Bot className="w-12 h-12 text-primary" />
                            <motion.div 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -top-1 -right-1"
                            >
                                <Sparkles className="w-6 h-6 text-yellow-400 drop-shadow-lg" />
                            </motion.div>
                        </div>
                        
                        <div className="space-y-4 w-full">
                            <h2 className="text-2xl md:text-3xl font-black italic tracking-tight text-white">{currentStepData.title}</h2>
                            <p className="text-white/80 text-sm md:text-base leading-relaxed whitespace-pre-wrap px-4">
                                {currentStepData.message}
                            </p>
                            
                            <div className="pt-6 flex flex-col gap-4 max-w-sm mx-auto w-full">
                                <motion.div
                                    key={step}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Input 
                                        value={currentStepData.field}
                                        onChange={(e) => currentStepData.setField(e.target.value)}
                                        placeholder={currentStepData.placeholder}
                                        className="bg-[#1A1C24] border-white/20 h-14 text-center text-lg focus-visible:ring-primary shadow-inner"
                                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        autoFocus
                                    />
                                </motion.div>
                                <Button 
                                    onClick={handleNext}
                                    disabled={!currentStepData.field || currentStepData.field.trim() === '' || isSaving}
                                    className="w-full h-14 bg-primary text-black hover:bg-primary/90 font-bold text-lg gap-2 shadow-[0_0_20px_rgba(var(--primary),0.4)]"
                                >
                                    {isSaving ? "Configurando o Sistema..." : (step === steps.length - 1 ? "Concluir Setup Mágico" : "Continuar")} 
                                    {!isSaving && <ArrowRight className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-6">
                            {steps.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`h-2 rounded-full transition-all duration-500 ${i === step ? 'bg-primary w-8 shadow-[0_0_10px_rgba(var(--primary),0.5)]' : i < step ? 'bg-primary/50 w-2' : 'bg-white/10 w-2'}`} 
                                />
                            ))}
                        </div>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};
