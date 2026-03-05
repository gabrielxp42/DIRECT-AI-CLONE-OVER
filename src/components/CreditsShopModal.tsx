import React, { useState } from 'react';
import { toast } from 'sonner';

import {
    Zap,
    X,
    Check,
    Loader2,
    CreditCard,
    QrCode,
    TrendingUp,
    ShieldCheck,
    ArrowLeft,
    AlertCircle,
    MessageCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, VisuallyHidden } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionProvider';


interface CreditsShopModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CREDIT_PACKAGES = [
    {
        id: 'starter',
        name: 'Starter',
        credits: 1000,
        price: 50.00,
        popular: false,
        bonus: null
    },
    {
        id: 'professional',
        name: 'Professional',
        credits: 2200,
        price: 100.00,
        popular: true,
        bonus: '10% BÔNUS'
    },
    {
        id: 'studio',
        name: 'Studio',
        credits: 4800,
        price: 200.00,
        popular: false,
        bonus: '20% BÔNUS'
    },
    {
        id: 'elite',
        name: 'Elite',
        credits: 13000,
        price: 500.00,
        popular: false,
        bonus: '30% BÔNUS'
    }
];

export const CreditsShopModal: React.FC<CreditsShopModalProps> = ({ isOpen, onClose }) => {
    const { supabase, session, profile } = useSession();
    const [step, setStep] = useState<'packages' | 'cpf' | 'pix'>('packages');
    const [selectedPkg, setSelectedPkg] = useState<typeof CREDIT_PACKAGES[0] | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    const [loading, setLoading] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [cpfCnpj, setCpfCnpj] = useState((profile as any)?.cpf_cnpj || '');


    const handleInitialPurchase = (pkg: typeof CREDIT_PACKAGES[0], method: 'PIX' | 'CREDIT_CARD') => {
        setSelectedPkg(pkg);
        setPaymentMethod(method);

        // Se for PIX e não tivermos o CPF, vamos para o passo de CPF
        if (method === 'PIX' && !cpfCnpj) {
            setStep('cpf');
        } else {
            processCheckout(pkg, method, cpfCnpj);
        }
    };

    const processCheckout = async (pkg: typeof CREDIT_PACKAGES[0], method: 'PIX' | 'CREDIT_CARD', cpf?: string) => {
        setLoading(pkg.id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Faça login para continuar');

            // Use Supabase Functions Invoke for better security/reliability
            const { data, error } = await supabase.functions.invoke('asaas-checkout', {
                body: {
                    userId: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.email?.split('@')[0],
                    paymentMethod: method,
                    productType: 'AI_RECHARGE',
                    amount: pkg.price,
                    credits: pkg.credits, // Passamos os créditos separadamente agora
                    cpfCnpj: cpf?.replace(/\D/g, '')
                }
            });

            if (error) throw error;

            if (method === 'PIX' && data.pix) {
                setPaymentData(data);
                setStep('pix');
            } else if (method === 'CREDIT_CARD' && data.invoiceUrl) {
                window.open(data.invoiceUrl, '_blank');
                toast.success('Fatura aberta com sucesso! 🚀');
                onClose();
            }
        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error(error.message || 'Erro ao processar pagamento');
            setStep('packages');
        } finally {
            setLoading(null);
        }
    };



    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="dialog-content-vec max-w-4xl p-0 overflow-hidden bg-[#0a0a0a] border-white/10" hideCloseButton>
                <VisuallyHidden>
                    <DialogTitle>Recarregar Créditos AI</DialogTitle>
                    <DialogDescription>Escolha um pacote de créditos para continuar criando.</DialogDescription>
                </VisuallyHidden>

                <div className="header-vec">
                    <div className="flex items-center gap-3">
                        {step === 'packages' ? (
                            <Zap className="text-primary fill-primary" size={24} />
                        ) : (
                            <button onClick={() => setStep('packages')} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                                <ArrowLeft className="text-white/60" size={20} />
                            </button>
                        )}
                        <div>
                            <h2 className="title-vec">
                                {step === 'packages' ? 'Recarregar Créditos AI' :
                                    step === 'cpf' ? 'Verificação de CPF' : 'Pagamento PIX'}
                            </h2>
                            <p className="subtitle-vec text-[10px] text-white/40 uppercase tracking-widest font-bold">Asaas Secure Checkout</p>
                        </div>
                    </div>
                    <button className="close-btn-vec" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="relative p-6 md:p-10 min-h-[400px] flex flex-col justify-center">
                    {step === 'packages' && (
                        <div className="fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                <p className="text-white/60">Escolha o melhor pacote para suas criações.</p>
                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                    <ShieldCheck size={16} className="text-primary" />
                                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Pagamento via Asaas</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {CREDIT_PACKAGES.map((pkg) => (
                                    <div
                                        key={pkg.id}
                                        className={`relative group p-6 rounded-2xl border transition-all duration-300 ${pkg.popular
                                            ? 'bg-primary/10 border-primary/40 scale-105 z-10'
                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {pkg.bonus && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-black text-[10px] font-black rounded-full shadow-lg">
                                                {pkg.bonus}
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">{pkg.name}</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-white">{pkg.credits.toLocaleString()}</span>
                                                <span className="text-white/40 text-xs font-bold uppercase">Créditos</span>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <div className="text-white/40 text-xs mb-1">Investimento</div>
                                            <div className="text-2xl font-bold text-white">
                                                R$ {pkg.price.toFixed(2).replace('.', ',')}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <button
                                                disabled={!!loading}
                                                onClick={() => handleInitialPurchase(pkg, 'PIX')}
                                                className="w-full py-3 bg-primary hover:brightness-110 disabled:opacity-50 text-black rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                                            >
                                                {loading === pkg.id ? <Loader2 className="animate-spin" size={18} /> : <><QrCode size={18} /> PIX</>}
                                            </button>
                                            <button
                                                disabled={!!loading}
                                                onClick={() => handleInitialPurchase(pkg, 'CREDIT_CARD')}
                                                className="w-full py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                            >
                                                <CreditCard size={18} /> CARTÃO
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'cpf' && (
                        <div className="max-w-md mx-auto w-full fade-in space-y-6">
                            <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex gap-4">
                                <AlertCircle className="text-primary shrink-0" />
                                <p className="text-xs text-white/80 leading-relaxed">
                                    O Banco Central exige um CPF/CNPJ para gerar pagamentos via PIX. Seus dados estão seguros e criptografados.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Digite seu CPF ou CNPJ</label>
                                <Input
                                    value={cpfCnpj}
                                    onChange={(e) => setCpfCnpj(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="h-14 bg-white/5 border-white/10 text-white text-xl font-black rounded-2xl focus:border-primary"
                                />
                            </div>

                            <Button
                                onClick={() => selectedPkg && processCheckout(selectedPkg, paymentMethod, cpfCnpj)}
                                disabled={cpfCnpj.length < 11 || !!loading}
                                className="w-full h-14 bg-primary text-black font-black uppercase italic rounded-2xl text-lg hover:scale-[1.02] transition-all"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'GERAR COBRANÇA AGORA'}
                            </Button>
                        </div>
                    )}

                    {step === 'pix' && paymentData && (
                        <div className="max-w-md mx-auto w-full fade-in flex flex-col items-center text-center">
                            <p className="text-white/60 mb-6">Seus créditos serão liberados instantaneamente após o pagamento.</p>

                            <div className="bg-white p-4 rounded-2xl mb-6 shadow-2xl">
                                <img src={`data:image/png;base64,${paymentData.pix.encodedImage}`} alt="QR Code PIX" className="w-48 h-48" />
                            </div>

                            <div className="w-full bg-white/5 p-4 rounded-2xl mb-6 text-left border border-white/5">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Código Copia e Cola</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={paymentData.pix.payload}
                                        className="bg-transparent border-none text-white text-sm flex-1 focus:ring-0 truncate font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(paymentData.pix.payload);
                                            toast.success('Copiado! 📋');
                                        }}
                                        className="px-4 py-2 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-all"
                                    >
                                        COPIAR
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                                >
                                    JÁ REALIZEI O PAGAMENTO
                                </button>

                                <a
                                    href="https://wa.me/5541992147395?text=Olá, estou com problemas no checkout de créditos AI."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 flex items-center justify-center gap-2 text-white/40 hover:text-white transition-all text-sm font-bold"
                                >
                                    <MessageCircle size={16} />
                                    Problemas? Falar com suporte
                                </a>
                            </div>
                        </div>
                    )}

                    {step === 'packages' && (
                        <div className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-transparent border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-primary/20">
                                    <TrendingUp className="text-black" size={24} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-lg">Precisa de muito mais?</h4>
                                    <p className="text-white/60 text-sm">Pacotes empresariais com descontos agressivos acima de 50k créditos.</p>
                                </div>
                            </div>
                            <button className="px-8 py-3 bg-white text-black rounded-xl font-black text-sm hover:scale-105 transition-all">
                                FALAR COM SUPORTE
                            </button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

