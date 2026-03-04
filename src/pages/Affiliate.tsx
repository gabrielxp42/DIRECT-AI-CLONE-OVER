import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionProvider';
import {
    TrendingUp,
    Users,
    DollarSign,
    Copy,
    ExternalLink,
    PieChart,
    ChevronRight,
    Sparkles,
    Wallet,
    Target,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type Withdrawal = {
    id: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    pix_key: string;
    pix_key_type: string;
    created_at: string;
    processed_at: string | null;
};

const PIX_TYPES = [
    { value: 'cpf', label: 'CPF' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'email', label: 'E-mail' },
    { value: 'phone', label: 'Telefone' },
    { value: 'random', label: 'Chave Aleatória' },
];

const GOALS = [
    { threshold: 5, label: 'Bronze', icon: '🥉', bonus: 'Bônus de R$ 50,00' },
    { threshold: 10, label: 'Silver', icon: '🥈', bonus: 'Bônus de R$ 100,00' },
    { threshold: 20, label: 'Gold', icon: '🥇', bonus: 'Bônus de R$ 200,00' },
    { threshold: 50, label: 'Diamond', icon: '💎', bonus: 'Bônus de R$ 500,00' },
    { threshold: 100, label: 'Black', icon: '🚀', bonus: 'Notebook Dell Inspiron' },
];


export default function AffiliatePortal() {
    const { profile } = useSession();
    const [stats, setStats] = useState({
        activeUsers: 0,
        totalRevenue: 0,
        estimatedCommission: 0,
        availableBalance: 0,
        pendingWithdrawals: 0
    });
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState('');
    const [isSavingPix, setIsSavingPix] = useState(false);
    const [pixType, setPixType] = useState(profile?.affiliate_pix_key_type || '');
    const [pixKey, setPixKey] = useState(profile?.affiliate_pix_key || '');

    const landingPageLink = `${window.location.origin}/landing-page?ref=${profile?.affiliate_code || ''}`;
    const checkoutLink = `${window.location.origin}/checkout?code=${profile?.affiliate_code || ''}`;

    useEffect(() => {
        if (profile) {
            setPixType(profile.affiliate_pix_key_type || '');
            setPixKey(profile.affiliate_pix_key || '');
        }
    }, [profile]);

    useEffect(() => {
        if (profile?.affiliate_code) {
            fetchAffiliateStats();
            fetchWithdrawals();
        }
    }, [profile]);

    const fetchWithdrawals = async () => {
        try {
            const { data, error } = await supabase
                .from('affiliate_withdrawals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setWithdrawals(data || []);
        } catch (error) {
            console.error('Error fetching withdrawals:', error);
        }
    };

    const fetchAffiliateStats = async () => {
        try {
            setIsLoading(true);

            // Use SECURITY DEFINER RPC to bypass RLS and get aggregate stats
            const { data: rpcData, error } = await supabase.rpc('get_affiliate_stats', {
                affiliate_code_param: profile?.affiliate_code
            });

            if (error) throw error;

            const activeCount = rpcData?.active_users || 0;
            const revenue = Number(rpcData?.total_revenue || 0);

            const { data: withdrawalsData, error: wError } = await supabase
                .from('affiliate_withdrawals')
                .select('amount, status')
                .eq('user_id', profile?.id);

            if (wError) throw wError;

            const totalCommission = Number((revenue * (profile?.commission_rate || 10) / 100).toFixed(2));

            // Calculate pending and paid amounts
            const paidAmount = withdrawalsData
                ?.filter(w => w.status === 'paid' || w.status === 'approved')
                .reduce((acc, w) => acc + Number(w.amount), 0) || 0;

            const pendingAmount = withdrawalsData
                ?.filter(w => w.status === 'pending')
                .reduce((acc, w) => acc + Number(w.amount), 0) || 0;

            setStats({
                activeUsers: activeCount,
                totalRevenue: revenue,
                estimatedCommission: totalCommission,
                availableBalance: Number((totalCommission - paidAmount - pendingAmount).toFixed(2)),
                pendingWithdrawals: pendingAmount
            });
        } catch (error) {
            console.error('Error fetching affiliate stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} Copiado!`);
    };

    const handleSavePix = async () => {
        if (!pixType || !pixKey) {
            toast.error("Preencha o tipo e a chave PIX.");
            return;
        }

        setIsSavingPix(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    affiliate_pix_key: pixKey,
                    affiliate_pix_key_type: pixType
                })
                .eq('id', profile?.id);

            if (error) throw error;
            toast.success("Dados de pagamento salvos!");
        } catch (error: any) {
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setIsSavingPix(false);
        }
    };

    const handleRequestWithdrawal = async () => {
        const amount = Number(withdrawalAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Insira um valor válido.");
            return;
        }

        if (amount < 50) {
            toast.error("O valor mínimo para saque é R$ 50,00.");
            return;
        }

        if (amount > stats.availableBalance) {
            toast.error("Saldo insuficiente.");
            return;
        }

        if (!profile?.affiliate_pix_key) {
            toast.error("Cadastre uma chave PIX antes de solicitar o saque.");
            return;
        }

        setIsRequestingWithdrawal(true);
        try {
            const { error } = await supabase
                .from('affiliate_withdrawals')
                .insert({
                    user_id: profile?.id,
                    amount: amount,
                    pix_key: profile.affiliate_pix_key,
                    pix_key_type: profile.affiliate_pix_key_type,
                    status: 'pending'
                });

            if (error) throw error;
            toast.success("Pedido de saque enviado!");
            setWithdrawalAmount('');
            fetchAffiliateStats();
            fetchWithdrawals();
        } catch (error: any) {
            toast.error("Erro ao solicitar saque: " + error.message);
        } finally {
            setIsRequestingWithdrawal(false);
        }
    };

    if (!profile?.is_affiliate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <Target className="w-16 h-16 text-zinc-300 mb-4" />
                <h1 className="text-2xl font-black uppercase italic tracking-tighter">Portal Restrito</h1>
                <p className="text-zinc-500 max-w-xs mt-2 font-medium">Você ainda não é um afiliado oficial. Entre em contato com o suporte para ativar sua conta.</p>
                <Button variant="outline" className="mt-8 rounded-full font-bold uppercase" onClick={() => window.history.back()}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="container max-w-6xl px-4 py-8 md:py-12 space-y-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-none flex items-center gap-4">
                        Portal <span className="text-emerald-500">Parceiro</span>
                    </h1>
                    <p className="text-muted-foreground mt-3 font-bold text-sm md:text-lg flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 font-black italic">AFILIADO ATIVO</Badge>
                        Acompanhe seus resultados e comissões.
                    </p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="p-1 px-4 bg-zinc-900 rounded-full border border-white/5 flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic leading-none">CÓDIGO:</span>
                        <span className="text-sm font-black text-emerald-400 italic">{profile.affiliate_code}</span>
                    </div>
                </div>
            </div>

            {/* Link de Indicação - CTA PRINCIPAL */}
            <Card className="rounded-[2.5rem] bg-gradient-to-br from-zinc-900 to-black border-none shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                <div className="absolute top-0 right-10 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700" />

                <CardContent className="p-8 md:p-12 relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                <Sparkles size={16} />
                                <span className="text-xs font-black uppercase tracking-widest leading-none">Sua Máquina de Vendas</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic leading-[0.9] tracking-tighter">
                                Compartilhe seu <br />
                                <span className="text-emerald-500">Link Exclusivo</span>
                            </h2>
                            <p className="text-zinc-400 font-medium text-sm md:text-lg max-w-md">
                                Ao usar seu link, o cliente ganha **15% de desconto** automaticamente e você garante sua comissão recorrente.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 bg-emerald-500/5 p-4 rounded-3xl border border-emerald-500/20 backdrop-blur-xl group/link transition-all duration-300 hover:border-emerald-500/50 shadow-lg shadow-emerald-500/5">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Link Principal (Landing Page + Orçamentos)</p>
                                    <p className="text-zinc-300 font-bold truncate text-sm italic">{landingPageLink}</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(landingPageLink, "Link da Landing Page")}
                                    size="icon"
                                    className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 w-12 h-12 shrink-0"
                                >
                                    <Copy size={20} />
                                </Button>
                            </div>

                            {/* Link Secundário: Checkout Direto */}
                            <div className="flex items-center gap-2 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-xl group/link transition-all duration-300 hover:border-white/20">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">Link Direto (Pular Landing Page)</p>
                                    <p className="text-zinc-400 font-bold truncate text-sm italic">{checkoutLink}</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(checkoutLink, "Link Direto")}
                                    variant="outline"
                                    size="icon"
                                    className="rounded-2xl border-white/10 hover:bg-white/10 text-white w-12 h-12 shrink-0"
                                >
                                    <Copy size={20} />
                                </Button>
                            </div>
                            <div className="flex items-center gap-6 justify-center md:justify-start px-2">
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] uppercase font-black tracking-widest">15% OFF pro Usuário</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] uppercase font-black tracking-widest">{profile.commission_rate}% de Comissão</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2.5rem] border-none bg-white dark:bg-zinc-900/50 shadow-xl overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                        <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <Users size={24} />
                        </div>
                        <Badge variant="outline" className="rounded-full font-black uppercase italic text-[10px]">Ativos</Badge>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 leading-none">Usuários Convertidos</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black italic tracking-tighter leading-none">{stats.activeUsers}</span>
                            <span className="text-emerald-500 font-black italic uppercase leading-none text-xs">Licenças</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none bg-white dark:bg-zinc-900/50 shadow-xl overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                        <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                            <TrendingUp size={24} />
                        </div>
                        <Badge variant="outline" className="rounded-full font-black uppercase italic text-[10px]">Mensal</Badge>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 leading-none">Receita Gerada (MRR)</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black italic tracking-tighter leading-none">R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-2xl shadow-emerald-500/10 overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border-2">
                    <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                        <div className="p-3 rounded-2xl bg-emerald-500 text-black shadow-lg shadow-emerald-500/20">
                            <Wallet size={24} />
                        </div>
                        <Badge className="rounded-full font-black uppercase italic text-[10px] bg-emerald-500 text-black border-none">Saldo Disponível</Badge>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-4">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-2 leading-none">Para Resgate</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black italic tracking-tighter leading-none text-emerald-600">R$ {stats.availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {stats.pendingWithdrawals > 0 && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest italic">
                                <Clock size={12} />
                                R$ {stats.pendingWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Pendente
                            </div>
                        )}

                        <div className="flex gap-2 p-1 bg-white dark:bg-zinc-900 rounded-3xl border border-emerald-500/10">
                            <Input
                                placeholder="0,00"
                                type="number"
                                value={withdrawalAmount}
                                onChange={(e) => setWithdrawalAmount(e.target.value)}
                                className="border-none bg-transparent h-10 shadow-none font-black italic focus-visible:ring-0"
                            />
                            <Button
                                size="sm"
                                onClick={handleRequestWithdrawal}
                                disabled={isRequestingWithdrawal || stats.availableBalance < 50}
                                className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase italic px-6"
                            >
                                {isRequestingWithdrawal ? "..." : "SACAR"}
                            </Button>
                        </div>
                        {stats.availableBalance < 50 && (
                            <p className="text-[9px] text-zinc-500 font-medium uppercase text-center tracking-widest">Saque mínimo R$ 50,00</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Metas e Gamificação */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-none bg-white dark:bg-zinc-900/50 shadow-xl overflow-hidden flex flex-col">
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                                <Target size={24} />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Suas Metas</CardTitle>
                                <CardDescription className="text-xs font-medium italic">Alcance novos níveis para desbloquear bônus.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-6">
                            {GOALS.map((goal, idx) => {
                                const isCompleted = stats.activeUsers >= goal.threshold;
                                const isCurrent = stats.activeUsers < goal.threshold && (idx === 0 || stats.activeUsers >= GOALS[idx - 1].threshold);

                                return (
                                    <div key={goal.label} className={`flex items-center gap-4 transition-all duration-300 ${isCompleted ? 'opacity-100' : isCurrent ? 'opacity-100 scale-[1.02]' : 'opacity-40'}`}>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg ${isCompleted ? 'bg-emerald-500/20 grayscale-0' : 'bg-zinc-100 dark:bg-zinc-800 grayscale'}`}>
                                            {goal.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-end mb-1">
                                                <h4 className="font-black uppercase italic text-sm tracking-tighter">Nível {goal.label}</h4>
                                                <span className="text-[10px] font-black italic text-zinc-500">{stats.activeUsers}/{goal.threshold}</span>
                                            </div>
                                            <Progress value={Math.min((stats.activeUsers / goal.threshold) * 100, 100)} className="h-1.5 bg-zinc-100 dark:bg-zinc-800" />
                                            {isCurrent && (
                                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-2 animate-pulse">
                                                    Próximo Bônus: {goal.bonus}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Projeção de Ganhos */}
                <Card className="rounded-[2.5rem] border-none bg-zinc-950 shadow-xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-zinc-950 pointer-events-none" />

                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                    <CardHeader className="p-8 pb-4 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-white/20 text-white backdrop-blur-md">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter text-white">Projeção de Ganhos</CardTitle>
                                <CardDescription className="text-xs font-medium italic text-white/70">Veja quanto você pode ganhar por mês.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-4 relative z-10 space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                            {[10, 20, 50, 100].map((num) => {
                                const monthlyComm = num * 97 * (profile?.commission_rate || 10) / 100;

                                return (
                                    <div key={num} className="p-4 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-md">
                                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{num} Indicações</p>
                                        <p className="text-2xl font-black text-white italic tracking-tighter">R$ {monthlyComm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                        <p className="text-[9px] font-bold text-emerald-400 uppercase italic">Por Mês (Recorrente)</p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-6 rounded-[2rem] bg-black/20 border border-white/5 backdrop-blur-xl">
                            <h4 className="text-xs font-black text-white uppercase italic tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-400" />
                                Grande Meta do Mês
                            </h4>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white italic tracking-tighter leading-none">R$ {(200 * 97 * (profile?.commission_rate || 10) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                <span className="text-xs font-black text-white/50 uppercase italic tracking-tighter">/Mês</span>
                            </div>
                            <p className="text-[10px] text-white/70 font-medium mt-2">
                                Baseado em 200 usuários ativos. Com nossa taxa de retenção média, isso se torna sua <b>aposentadoria digital</b>.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Next Steps / Info */}
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-none bg-white dark:bg-zinc-900/50 shadow-xl overflow-hidden">
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Dados de Recebimento</CardTitle>
                                <CardDescription className="text-xs font-medium italic">Como você prefere receber suas comissões?</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-4 space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tipo de Chave</Label>
                                <Select value={pixType} onValueChange={setPixType}>
                                    <SelectTrigger className="rounded-2xl h-12 border-zinc-100 dark:border-zinc-800">
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PIX_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}

                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Chave PIX</Label>
                                <Input
                                    value={pixKey}
                                    onChange={(e) => setPixKey(e.target.value)}
                                    placeholder="Sua chave aqui..."
                                    className="rounded-2xl h-12 border-zinc-100 dark:border-zinc-800"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleSavePix}
                            disabled={isSavingPix}
                            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase italic tracking-tighter"
                        >
                            {isSavingPix ? "Salvando..." : "Salvar Dados de PIX"}
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase italic tracking-widest text-zinc-500">Regras de Negócio</h4>
                    <div className="space-y-3">
                        <div className="flex items-start gap-4 p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center font-black text-xs shrink-0">1</div>
                            <div>
                                <p className="font-bold text-sm">Comissão Recurrente</p>
                                <p className="text-[10px] text-zinc-500 font-medium">Você recebe {profile.commission_rate}% de cada mensalidade enquanto o cliente estiver ativo.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center font-black text-xs shrink-0">2</div>
                            <div>
                                <p className="font-bold text-sm">Pagamento Automático</p>
                                <p className="text-[10px] text-zinc-500 font-medium">As comissões são fechadas todo dia 30 e pagas via PIX na sua chave cadastrada.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <Card className="p-0 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900/40 border-none flex flex-col overflow-hidden">
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-zinc-800 text-zinc-400">
                                <Clock size={24} />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Histórico de Saques</CardTitle>
                                <CardDescription className="text-xs font-medium italic">Seus últimos resgates realizados.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-4">
                        {withdrawals.length > 0 ? (
                            <div className="space-y-3">
                                {withdrawals.map((w) => (
                                    <div key={w.id} className="flex items-center justify-between p-4 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 group hover:border-emerald-500/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl ${w.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                                                w.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                                    'bg-amber-500/10 text-amber-500'
                                                }`}>
                                                {w.status === 'paid' && <CheckCircle2 size={16} />}
                                                {w.status === 'rejected' && <XCircle size={16} />}
                                                {(w.status === 'pending' || w.status === 'approved') && <Clock size={16} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-sm italic tracking-tighter leading-none">R$ {w.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mt-1">
                                                    {new Date(w.created_at).toLocaleDateString()} • {w.pix_key_type}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`rounded-full uppercase text-[9px] font-black italic ${w.status === 'paid' ? 'text-emerald-500 border-emerald-500/20' :
                                            w.status === 'rejected' ? 'text-red-500 border-red-500/20' :
                                                'text-amber-500 border-amber-500/20'
                                            }`}>
                                            {w.status === 'pending' && 'PENDENTE'}
                                            {w.status === 'approved' && 'APROVADO'}
                                            {w.status === 'paid' && 'PAGO'}
                                            {w.status === 'rejected' && 'RECUSADO'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                <div className="p-4 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                    <ArrowUpRight className="w-8 h-8 text-zinc-400 opacity-20" />
                                </div>
                                <p className="text-xs text-zinc-500 font-medium italic">Nenhum saque realizado até o momento.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
