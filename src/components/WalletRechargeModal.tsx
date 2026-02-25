
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Zap,
    CreditCard,
    QrCode,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ArrowLeft,
    Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionProvider";
import { toast } from "sonner";

interface WalletRechargeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBalance?: number;
}

const RECHARGE_OPTIONS = [
    { amount: 50, label: "R$ 50", popular: false },
    { amount: 100, label: "R$ 100", popular: true },
    { amount: 200, label: "R$ 200", popular: false },
    { amount: 500, label: "R$ 500", popular: false },
];

export const WalletRechargeModal = ({ open, onOpenChange, currentBalance = 0 }: WalletRechargeModalProps) => {
    const { session } = useSession();
    const [step, setStep] = useState<'amount' | 'method' | 'cpf' | 'processing' | 'pix' | 'success'>('amount');
    const [amount, setAmount] = useState<number | ''>('');
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    const [loading, setLoading] = useState(false);
    const [pixData, setPixData] = useState<any>(null);
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [activeProvider, setActiveProvider] = useState<'superfrete' | 'frenet' | null>(null);

    // Buscar perfil do usuário para verificar CPF
    useEffect(() => {
        if (open && session?.user?.id) {
            fetchProfile();
        }
    }, [open, session?.user?.id]);

    const fetchProfile = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('cpf_cnpj, logistics_provider')
            .eq('id', session?.user?.id)
            .single();

        if (data) {
            setUserProfile(data);
            setActiveProvider(data.logistics_provider as any);
            if (data.cpf_cnpj) {
                setCpfCnpj(data.cpf_cnpj);
            }
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const handleSelectAmount = (val: number) => {
        setAmount(val);
        setStep('method');
    };

    const handleNext = () => {
        if (!amount || amount < 10) {
            toast.error("Valor mínimo de recarga é R$ 10,00");
            return;
        }
        setStep('method');
    };

    const handleConfirmMethod = () => {
        if (paymentMethod === 'PIX' && !cpfCnpj) {
            setStep('cpf');
        } else {
            handleProcessPayment();
        }
    };

    const handleProcessPayment = async () => {
        if (!session?.user?.id) return;

        setLoading(true);
        setStep('processing');

        try {
            // Se for Frenet, usamos o proxy da Frenet para depósito direto (Wallet API)
            if (activeProvider === 'frenet' && paymentMethod === 'PIX') {
                const { data, error } = await supabase.functions.invoke('frenet-proxy', {
                    body: {
                        action: 'deposit',
                        params: {
                            amount: amount,
                            payment_method: 'PIX'
                        }
                    }
                });

                if (error) throw error;
                // A Frenet retorna dados do PIX de forma diferente
                if (data.PixQrCode || data.PixelPayload) {
                    setPixData({
                        payload: data.PixelPayload || data.PixQrCode,
                        encodedImage: data.PixBase64 // Se vier base64 direto
                    });
                    setStep('pix');
                    return;
                }
            }

            // Fallback para Asaas (padrão Direct AI / SuperFrete)
            const { data, error } = await supabase.functions.invoke('asaas-checkout', {
                body: {
                    userId: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || 'Usuário',
                    paymentMethod: paymentMethod,
                    productType: 'REFILL',
                    amount: amount,
                    cpfCnpj: cpfCnpj
                }
            });

            if (error) throw error;

            if (paymentMethod === 'PIX' && data.pix) {
                setPixData(data.pix);
                setStep('pix');
            } else if (paymentMethod === 'CREDIT_CARD') {
                if (data.invoiceUrl) {
                    window.open(data.invoiceUrl, '_blank');
                }
                setStep('success');
            } else {
                setStep('success');
            }
        } catch (err: any) {
            console.error("Erro ao processar recarga:", err);
            toast.error(err.message || "Erro ao gerar cobrança");
            setStep('amount');
        } finally {
            setLoading(false);
        }
    };

    const resetModal = () => {
        setStep('amount');
        setAmount('');
        setPixData(null);
        setLoading(false);
        // Não limpamos CPF pois ele vem do perfil
    };

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(resetModal, 300);
    };

    const copyPixCode = () => {
        if (pixData?.payload) {
            navigator.clipboard.writeText(pixData.payload);
            toast.success("Código PIX copiado!");
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none bg-zinc-950 shadow-2xl rounded-3xl">
                <DialogHeader className="p-6 pb-0 sr-only">
                    <DialogTitle>Recarregar Carteira</DialogTitle>
                    <DialogDescription>Escolha o valor e o método de pagamento</DialogDescription>
                </DialogHeader>

                <div className="relative overflow-hidden">
                    {/* Background decorativo */}
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                    <div className="relative p-6">
                        <AnimatePresence mode="wait">
                            {step === 'amount' && (
                                <motion.div
                                    key="amount"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-primary/20 p-2.5 rounded-xl text-primary">
                                            <Wallet className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Recarregar Saldo</h3>
                                            <p className="text-xs text-zinc-400 font-medium">Seu saldo atual: <span className="text-white font-bold">{formatCurrency(currentBalance)}</span></p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {RECHARGE_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.amount}
                                                onClick={() => handleSelectAmount(opt.amount)}
                                                className={cn(
                                                    "relative p-4 rounded-2xl border transition-all text-left",
                                                    amount === opt.amount
                                                        ? "bg-primary border-primary text-black shadow-lg shadow-primary/20"
                                                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                )}
                                            >
                                                {opt.popular && (
                                                    <span className="absolute top-2 right-2 bg-black/20 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider backdrop-blur-sm">
                                                        Popular
                                                    </span>
                                                )}
                                                <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">Recarga</p>
                                                <p className="text-2xl font-black italic tracking-tighter leading-none mt-1">R$ {opt.amount}</p>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Ou digite um valor personalizado</p>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black group-focus-within:scale-110 transition-transform italic">R$</span>
                                            <Input
                                                type="number"
                                                placeholder="0,00"
                                                value={amount}
                                                onChange={(e) => setAmount(Number(e.target.value))}
                                                className="h-14 pl-12 bg-white/5 border-white/10 text-white text-xl font-black placeholder:text-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleNext}
                                            disabled={!amount || amount < 10}
                                            className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase italic rounded-2xl tracking-tighter gap-2 transition-all shadow-xl shadow-white/5"
                                        >
                                            Escolher forma de pagamento <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'method' && (
                                <motion.div
                                    key="method"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setStep('amount')}
                                            className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5"
                                        >
                                            <ArrowLeft className="h-5 w-5" />
                                        </Button>
                                        <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Forma de Pagamento</h3>
                                    </div>

                                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl mb-4">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Valor da Recarga</p>
                                        <p className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(Number(amount))}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setPaymentMethod('PIX')}
                                            className={cn(
                                                "w-full p-5 rounded-2xl border flex items-center justify-between transition-all",
                                                paymentMethod === 'PIX'
                                                    ? "bg-primary/20 border-primary text-primary"
                                                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-xl", paymentMethod === 'PIX' ? "bg-primary text-black" : "bg-white/10 text-white")}>
                                                    <QrCode className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-black uppercase italic text-sm text-balance leading-none mb-1">Pagamento via PIX</p>
                                                    <p className="text-[10px] font-medium opacity-60 uppercase tracking-widest">Aprovação imediata</p>
                                                </div>
                                            </div>
                                            {paymentMethod === 'PIX' && <CheckCircle2 className="h-5 w-5" />}
                                        </button>

                                        <button
                                            onClick={() => setPaymentMethod('CREDIT_CARD')}
                                            className={cn(
                                                "w-full p-5 rounded-2xl border flex items-center justify-between transition-all",
                                                paymentMethod === 'CREDIT_CARD'
                                                    ? "bg-primary/20 border-primary text-primary"
                                                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-xl", paymentMethod === 'CREDIT_CARD' ? "bg-primary text-black" : "bg-white/10 text-white")}>
                                                    <CreditCard className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-black uppercase italic text-sm text-balance leading-none mb-1">Cartão de Crédito</p>
                                                    <p className="text-[10px] font-medium opacity-60 uppercase tracking-widest">Visa, Master e mais</p>
                                                </div>
                                            </div>
                                            {paymentMethod === 'CREDIT_CARD' && <CheckCircle2 className="h-5 w-5" />}
                                        </button>
                                    </div>

                                    <Button
                                        onClick={handleConfirmMethod}
                                        className="w-full h-14 bg-primary text-black hover:bg-primary/90 font-black uppercase italic rounded-2xl tracking-tighter shadow-xl shadow-primary/10 mt-4"
                                    >
                                        Continuar <ChevronRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </motion.div>
                            )}

                            {step === 'cpf' && (
                                <motion.div
                                    key="cpf"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setStep('method')}
                                            className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5"
                                        >
                                            <ArrowLeft className="h-5 w-5" />
                                        </Button>
                                        <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Verificação de CPF</h3>
                                    </div>

                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                        <div className="flex gap-3">
                                            <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
                                            <p className="text-[11px] text-blue-100 font-medium leading-relaxed">
                                                Para gerar o QR Code PIX, o Banco Central exige a identificação do pagador. Seu CPF ficará salvo para futuras recargas.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Digite seu CPF</label>
                                        <Input
                                            type="text"
                                            placeholder="000.000.000-00"
                                            value={cpfCnpj}
                                            onChange={(e) => setCpfCnpj(e.target.value.replace(/\D/g, ''))}
                                            className="h-14 bg-white/5 border-white/10 text-white text-xl font-black placeholder:text-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleProcessPayment}
                                        disabled={cpfCnpj.length < 11}
                                        className="w-full h-14 bg-primary text-black hover:bg-primary/90 font-black uppercase italic rounded-2xl tracking-tighter shadow-xl shadow-primary/10"
                                    >
                                        Gerar QR Code PIX <Zap className="h-4 w-4 fill-current ml-2" />
                                    </Button>
                                </motion.div>
                            )}

                            {step === 'processing' && (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="py-12 flex flex-col items-center justify-center space-y-4"
                                >
                                    <div className="relative">
                                        <Loader2 className="h-16 w-16 text-primary animate-spin" />
                                        <Zap className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-current" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">Processando...</h4>
                                        <p className="text-zinc-500 text-sm font-medium">Estamos gerando sua cobrança segura</p>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'pix' && (
                                <motion.div
                                    key="pix"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center">
                                        <div className="bg-primary/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                            <QrCode className="h-8 w-8 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Pague com PIX</h3>
                                        <p className="text-xs text-zinc-500 font-medium">Após o pagamento, seu saldo será liberado</p>
                                    </div>

                                    <div className="bg-white p-4 rounded-3xl mx-auto w-48 h-48 flex items-center justify-center shadow-2xl">
                                        {pixData?.encodedImage ? (
                                            <img
                                                src={`data:image/png;base64,${pixData.encodedImage}`}
                                                alt="QR Code PIX"
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <Loader2 className="h-8 w-8 text-zinc-200 animate-spin" />
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Button
                                            variant="outline"
                                            onClick={copyPixCode}
                                            className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold uppercase tracking-tight rounded-xl gap-2"
                                        >
                                            Copiar Código PIX <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            onClick={handleClose}
                                            className="w-full h-12 bg-primary text-black hover:bg-primary/90 font-black uppercase italic rounded-xl tracking-tighter"
                                        >
                                            Já realizei o pagamento
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                        <AlertCircle className="h-4 w-4 text-blue-400 shrink-0" />
                                        <p className="text-[10px] text-blue-400 font-medium leading-tight">
                                            A compensação é automática. Não precisa nos enviar o comprovante.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'success' && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-8 flex flex-col items-center justify-center space-y-6"
                                >
                                    <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center animate-bounce">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter">Solicitação Criada!</h4>
                                        <p className="text-zinc-500 text-sm font-medium px-8 leading-relaxed">
                                            {paymentMethod === 'PIX'
                                                ? "Seu pagamento via PIX foi gerado com sucesso. Assim que confirmado, seu saldo subirá!"
                                                : "Sua recarga via cartão está sendo processada por nosso parceiro de pagamentos."}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleClose}
                                        className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase italic rounded-2xl tracking-tighter"
                                    >
                                        Entendido, obrigado!
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Utilitário para concatenar classes
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
