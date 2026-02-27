
import { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { supabase } from '@/integrations/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Loader2,
    ShieldAlert,
    RefreshCw,
    MoreHorizontal,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    DollarSign,
    Users,
    AlertTriangle,
    Eye,
    Check,
    Activity,
    Package,
    Palette,
    Gift,
    Star,
    Copy,
    Mail,
    Send,
    Brain,
    Wallet
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';
import { differenceInDays, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { AdminGeminiConfig } from "@/components/AdminGeminiConfig";
import { AdminAIMonitoring } from "@/components/AdminAIMonitoring";
import { AdminWalletManager } from "@/components/AdminWalletManager";

type AdminProfile = {
    id: string;
    email: string | null;
    company_name: string | null;
    company_phone: string | null;
    subscription_status: 'trial' | 'active' | 'expired';
    subscription_tier: string | null;
    trial_start_date: string | null;
    daily_ai_count: number;
    is_admin: boolean;
    created_at: string;
    is_gifted_plan?: boolean;
    is_whatsapp_plus_active?: boolean;
    is_whatsapp_plus_gifted?: boolean;
    subscription_gift_viewed?: boolean;
    pedidos_count?: number;
    clientes_count?: number;
    whatsapp_api_url?: string;
    whatsapp_api_key?: string;
    is_affiliate?: boolean;
    affiliate_code?: string;
    commission_rate?: number;
    affiliate_pix_key?: string;
    affiliate_pix_key_type?: string;
};

type GlobalStats = {
    totalUsers: number;
    activeSubscribers: number;
    mrr: number;
    newUsers7d: number;
    totalAiUsage: number;
    totalClients: number;
    totalOrders: number;
    orders7d: number;
    activeUsers30d: number;
};

type SystemLog = {
    id: string;
    created_at: string;
    level: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    details: any;
    user_id: string;
    resolved: boolean;
    profile?: { company_name: string; email: string };
};

type AffiliateStat = {
    code: string;
    users: number;
    revenue: number;
    commission: number;
    pixKey?: string;
    pixType?: string;
    referredUsersProfiles: { id: string, email: string, company_name: string, subscription_status: string }[];
};

export default function Admin() {
    const { profile } = useSession();
    const [users, setUsers] = useState<AdminProfile[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [stats, setStats] = useState<GlobalStats>({
        totalUsers: 0,
        activeSubscribers: 0,
        mrr: 0,
        newUsers7d: 0,
        totalAiUsage: 0,
        totalClients: 0,
        totalOrders: 0,
        orders7d: 0,
        activeUsers30d: 0
    });
    const [affiliateStats, setAffiliateStats] = useState<AffiliateStat[]>([]);
    const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
    const [sendingEmailToId, setSendingEmailToId] = useState<string | null>(null);
    const [customRecoveryEmail, setCustomRecoveryEmail] = useState("");
    const [customRecoveryName, setCustomRecoveryName] = useState("");

    const [editForm, setEditForm] = useState<Partial<AdminProfile>>({});
    const [userStats, setUserStats] = useState<{ pedidos: number, clientes: number } | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [evolutionStatus, setEvolutionStatus] = useState<'idle' | 'online' | 'error'>('idle');

    const fetchUserStats = async (userId: string) => {
        setLoadingStats(true);
        setUserStats(null);
        try {
            const [{ count: pedidosCount }, { count: clientesCount }] = await Promise.all([
                supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', userId),
                supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('user_id', userId)
            ]);
            setUserStats({ pedidos: pedidosCount || 0, clientes: clientesCount || 0 });
        } catch (error) {
            console.error("Erro ao buscar stats:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Users
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (usersError) throw usersError;

            // Fetch stats for all users in parallel
            const usersWithStats = await Promise.all(usersData.map(async (u) => {
                const [{ count: pCount }, { count: cCount }] = await Promise.all([
                    supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
                    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
                ]);
                return { ...u, pedidos_count: pCount || 0, clientes_count: cCount || 0 };
            }));

            setUsers(usersWithStats as AdminProfile[]);

            // Fetch Logs (Recent 50)
            const { data: logsData, error: logsError } = await supabase
                .from('system_logs')
                .select('*, profile:profiles(company_name, email)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (!logsError) setLogs(logsData as any);

            // Fetch Platform Totals
            const sevenDaysAgoStr = subDays(new Date(), 7).toISOString();
            const thirtyDaysAgoStr = subDays(new Date(), 30).toISOString();

            const [
                { count: totalClients },
                { count: totalOrders },
                { count: orders7d },
                { data: recentOrders }
            ] = await Promise.all([
                supabase.from('clientes').select('*', { count: 'exact', head: true }),
                supabase.from('pedidos').select('*', { count: 'exact', head: true }),
                supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoStr),
                supabase.from('pedidos').select('user_id').gte('created_at', thirtyDaysAgoStr)
            ]);

            const activeUsersSet = new Set(recentOrders?.map((o: any) => o.user_id));
            const activeUsers30d = activeUsersSet.size;

            // Calculate Stats
            const totalUsers = usersData.length;
            const activeSubscribers = usersData.filter(u => u.subscription_status === 'active' && !u.is_gifted_plan).length;

            // Estimates MRR based on plans (hardcoded prices based on public.plans query)
            // pro: 97.00
            const mrrValue = usersData.reduce((acc, u) => {
                if (u.subscription_status === 'active' && !u.is_gifted_plan) {
                    let price = u.subscription_tier === 'pro_max' ? 137.00 : 97.00;
                    // Apply 15% discount if user has the partner code
                    if (u.partner_code?.toUpperCase() === 'DTFAGUDOS') {
                        price = Number((price * 0.85).toFixed(2));
                    }
                    return acc + price;
                }
                return acc;
            }, 0);

            const sevenDaysAgo = subDays(new Date(), 7);
            const newUsers7d = usersData.filter(u => new Date(u.created_at) >= sevenDaysAgo).length;
            const totalAiUsage = usersData.reduce((acc, u) => acc + (u.daily_ai_count || 0), 0);

            setStats({
                totalUsers,
                activeSubscribers,
                mrr: mrrValue,
                newUsers7d,
                totalAiUsage,
                totalClients: totalClients || 0,
                totalOrders: totalOrders || 0,
                orders7d: orders7d || 0,
                activeUsers30d
            });

            // Affiliate Tracking Logic
            const affMap = new Map<string, AffiliateStat>();

            // Build a lookup for affiliate's configuration
            const affiliatesConfig = new Map<string, { rate: number, pixKey?: string, pixType?: string }>();
            usersData.forEach(u => {
                if (u.is_affiliate && u.affiliate_code) {
                    affiliatesConfig.set(u.affiliate_code.toUpperCase(), {
                        rate: u.commission_rate || 10,
                        pixKey: (u as any).affiliate_pix_key,
                        pixType: (u as any).affiliate_pix_key_type
                    });
                }
            });

            usersData.forEach((u: any) => {
                const rawCode = u.partner_code;
                if (rawCode) {
                    const code = rawCode.toUpperCase();
                    let price = 0;

                    if (u.subscription_status === 'active' && !u.is_gifted_plan) {
                        price = u.subscription_tier === 'pro_max' ? 137.00 : 97.00;
                        // Support the fixed 15% discount for partner codes
                        price = Number((price * 0.85).toFixed(2));
                    }

                    const existing = affMap.get(code) || {
                        code,
                        users: 0,
                        revenue: 0,
                        commission: 0,
                        referredUsersProfiles: []
                    };

                    if (price > 0) {
                        existing.users += 1;
                        existing.revenue += price;
                    }

                    // Always add to referred list if they used the code
                    existing.referredUsersProfiles.push({
                        id: u.id,
                        email: u.email || '',
                        company_name: u.company_name || 'Usuário',
                        subscription_status: u.subscription_status
                    });

                    // Get specific rate or fallback to 10%
                    const config = affiliatesConfig.get(code);
                    const rate = config?.rate || 10;
                    existing.commission = Number((existing.revenue * (rate / 100)).toFixed(2));
                    existing.pixKey = config?.pixKey;
                    existing.pixType = config?.pixType;

                    affMap.set(code, existing);
                }
            });
            setAffiliateStats(Array.from(affMap.values()).sort((a, b) => b.revenue - a.revenue));

            // Fetch pending withdrawals
            const { data: withdrawalsData, error: wError } = await supabase
                .from('affiliate_withdrawals')
                .select('*, profile:profiles(company_name, email)')
                .in('status', ['pending', 'approved'])
                .order('created_at', { ascending: true });

            if (wError) throw wError;
            setPendingWithdrawals(withdrawalsData || []);

            // Auto-check Evolution API connection on admin load
            handleCheckConnection(false);

        } catch (err: any) {
            toast.error('Erro ao buscar dados: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckConnection = async (showToast = true) => {
        if (showToast) toast.info("Testando conexão...");
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'check-connection' }
            });

            if (error) throw error;

            if (data?.status === 'ok') {
                if (showToast) toast.success("Conexão com Evolution API Estabelecida!");
                setEvolutionStatus('online');
            } else {
                setEvolutionStatus('error');
            }
        } catch (e: any) {
            console.error(e);
            setEvolutionStatus('error');
            if (showToast) toast.error("Falha na conexão: " + e.message);
        }
    };

    useEffect(() => {
        if (profile?.is_admin) {
            fetchData();
        }
    }, [profile]);

    const handleOpenDetail = (user: AdminProfile) => {
        setSelectedUser(user);
        setEditForm({
            subscription_status: user.subscription_status,
            subscription_tier: user.subscription_tier,
            trial_start_date: user.trial_start_date,
            daily_ai_count: user.daily_ai_count,
            is_gifted_plan: user.is_gifted_plan || false,
            is_whatsapp_plus_active: (user as any).is_whatsapp_plus_active || false,
            is_whatsapp_plus_gifted: (user as any).is_whatsapp_plus_gifted || false,
            is_affiliate: user.is_affiliate || false,
            affiliate_code: user.affiliate_code || '',
            commission_rate: user.commission_rate || 10,
            affiliate_pix_key: (user as any).affiliate_pix_key || '',
            affiliate_pix_key_type: (user as any).affiliate_pix_key_type || ''
        });
        fetchUserStats(user.id);
        setIsDetailOpen(true);
    };

    const handleSaveDetail = async () => {
        if (!selectedUser) return;
        try {
            // When gifting a plan or WA plus, we need to reset the "viewed" flags 
            // so the user sees the celebration modal again
            const finalForm = { ...editForm };

            if (editForm.is_gifted_plan && !selectedUser.is_gifted_plan) {
                (finalForm as any).subscription_gift_viewed = false;
            }
            if (editForm.is_whatsapp_plus_gifted && !(selectedUser as any).is_whatsapp_plus_gifted) {
                (finalForm as any).is_whatsapp_plus_gifted_viewed = false;
            }

            const { error } = await supabase
                .from('profiles')
                .update(finalForm)
                .eq('id', selectedUser.id);

            if (error) throw error;
            toast.success('Usuário atualizado!');
            setIsDetailOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        }
    };

    const handleSendRecoveryEmail = async (userId: string, email: string, name: string) => {
        try {
            setSendingEmailToId(userId);
            const response = await fetch('/email-templates/recovery-30-days.html');
            let htmlContent = await response.text();

            htmlContent = htmlContent.replace(/\[NOME\]/g, name || 'Parceiro');

            const { data, error } = await supabase.functions.invoke('send-recovery-email', {
                body: {
                    to: email,
                    subject: '30 Dias Grátis na Direct AI (Presente do Gabriel)',
                    htmlContent: htmlContent
                }
            });

            if (error) throw error;
            if (data && data.success === false) {
                throw new Error(data.error || "Erro desconhecido na API.");
            }

            toast.success("E-mail enviado com sucesso!");
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao enviar e-mail. Verifique o console.");
        } finally {
            setSendingEmailToId(null);
        }
    };

    const resolveLog = async (logId: string) => {
        try {
            const { error } = await supabase
                .from('system_logs')
                .update({ resolved: true })
                .eq('id', logId);
            if (error) throw error;
            setLogs(prev => prev.map(l => l.id === logId ? { ...l, resolved: true } : l));
            toast.success("Log marcado como resolvido");
        } catch (err: any) {
            toast.error("Erro ao resolver log");
        }
    };

    const handleProcessWithdrawal = async (id: string, newStatus: 'paid' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('affiliate_withdrawals')
                .update({
                    status: newStatus,
                    processed_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            toast.success(newStatus === 'paid' ? "Saque marcado como pago!" : "Saque recusado.");
            setPendingWithdrawals(p => p.filter(w => w.id !== id));
        } catch (error: any) {
            toast.error("Erro ao processar: " + error.message);
        }
    };

    const filteredUsers = users.filter(u =>
    (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.includes(searchTerm))
    );

    if (!profile?.is_admin) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-center text-muted-foreground">
                <ShieldAlert className="w-16 h-16 mb-4 text-destructive" />
                <h2 className="text-3xl font-bold">Acesso Restrito</h2>
                <p>Efetue login como administrador.</p>
            </div>
        );
    }

    return (
        <div className="container max-w-7xl px-4 pt-6 pb-24 md:py-10 space-y-8 md:space-y-10 selection:bg-primary selection:text-black">

            {/* Header com Liquid Identity */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">
                        Quartel-General <span className="text-primary">Direct AI</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium text-sm md:text-base">Painel de Controle e Inteligência de Faturamento.</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="gap-2 rounded-xl">
                    <RefreshCw className={isLoading ? "animate-spin" : ""} size={18} />
                    Sincronizar Dados
                </Button>
            </div>

            {/* Dashboard Stats Grid - OS NÚMEROS QUE IMPORTAM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <DollarSign size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Faturamento (MRR)</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mrr)}
                            </h3>
                            <p className="text-green-500 text-xs font-bold flex items-center gap-1">
                                <TrendingUp size={12} /> +12.5% vs mês anterior
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                                <Users size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assinaturas Ativas</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter">
                                {stats.activeSubscribers} <span className="text-sm font-medium text-muted-foreground">Assinantes</span>
                            </h3>
                            <p className="text-zinc-500 text-xs font-bold italic">Base total: {stats.totalUsers} usuários</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                                <Activity size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Usuários Ativos (30d)</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter">
                                {stats.activeUsers30d}
                            </h3>
                            <p className="text-indigo-500 text-xs font-bold flex items-center gap-1">
                                <Users size={12} /> Operando a plataforma
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                <Package size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pedidos na Plataforma</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter">
                                {stats.totalOrders}
                            </h3>
                            <p className="text-emerald-500 text-xs font-bold">
                                +{stats.orders7d} essa semana
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                <Users size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Clientes Cadastrados</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter">
                                {stats.totalClients}
                            </h3>
                            <p className="text-violet-500 text-xs font-bold italic">
                                Total de clientes finais
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                <AlertTriangle size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alertas de Sistema</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter text-amber-500">
                                {logs.filter(l => !l.resolved && l.level === 'error').length} <span className="text-sm font-medium text-muted-foreground">Erros</span>
                            </h3>
                            <p className="text-zinc-500 text-xs font-bold italic">Últimas 50 atividades</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Abas Principais */}
            <Tabs defaultValue="users" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-2xl mb-8 flex overflow-x-auto scrollbar-hide w-full md:w-auto">
                    <TabsTrigger value="users" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0">Usuários</TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0">Logs</TabsTrigger>
                    <TabsTrigger value="ai-monitoring" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 flex items-center gap-2">
                        <Brain size={14} /> Monitoramento IA
                    </TabsTrigger>
                    <TabsTrigger value="gemini-config" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 text-emerald-500">Gemini Config</TabsTrigger>
                    <TabsTrigger value="evolution" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 text-green-500">Evolution API</TabsTrigger>
                    <TabsTrigger value="marketing" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0">Marketing & Ganhos</TabsTrigger>
                    <TabsTrigger value="payouts" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 text-emerald-500">
                        <DollarSign size={14} className="mr-1" /> Pagamentos
                    </TabsTrigger>
                    <TabsTrigger value="wallet" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 text-blue-500 flex items-center gap-2">
                        <Wallet size={14} /> Carteira
                    </TabsTrigger>
                </TabsList>

                {/* ABA DE USUÁRIOS */}
                <TabsContent value="users">
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardHeader className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Lista de Operadores</CardTitle>
                                    <CardDescription className="text-sm font-medium">Gerenciamento total de contas e acessos.</CardDescription>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                                    <Button
                                        onClick={() => setIsRecoveryModalOpen(true)}
                                        className="w-full md:w-auto border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 rounded-xl font-bold italic bg-emerald-500/5 hover:text-emerald-500"
                                        variant="outline"
                                    >
                                        <Mail className="w-4 h-4 mr-2" />
                                        Recuperar Leads
                                    </Button>
                                    <div className="relative w-full md:w-80">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por email ou ID..."
                                            className="pl-10 h-10 rounded-xl"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Empresa / Usuário</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Status</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Pedidos</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Clientes</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Conquistas</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Consumo IA</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-muted/20 border-zinc-50 dark:border-zinc-900">
                                            <TableCell className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                                                        <AvatarFallback className="bg-primary/10 text-primary font-black">
                                                            {user.company_name?.substring(0, 2).toUpperCase() || 'US'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-black italic text-zinc-900 dark:text-white uppercase leading-none mb-1">{user.company_name || 'Usuário Beta'}</span>
                                                        <span className="text-xs text-muted-foreground font-medium">{user.email}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6">
                                                {user.subscription_status === 'active' ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none rounded-lg px-3 py-1 font-black uppercase text-[10px]">
                                                        Ativo {user.is_gifted_plan && "🎁"} {user.is_whatsapp_plus_active && "⚡"}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-none rounded-lg px-3 py-1 font-black uppercase text-[10px]">
                                                        {user.subscription_status}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <Badge variant="outline" className="font-black tabular-nums border-zinc-200 dark:border-zinc-800">
                                                    {user.pedidos_count || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <Badge variant="outline" className="font-black tabular-nums border-zinc-200 dark:border-zinc-800 text-emerald-500">
                                                    {user.clientes_count || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {(user.clientes_count || 0) >= 100 && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <div className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/20">
                                                                        <Palette size={14} />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Branding Desbloqueado</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {(user.pedidos_count || 0) >= 100 && (
                                                        <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-500 border border-orange-500/20">
                                                            <Star size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary"
                                                            style={{ width: `${Math.min(100, (user.daily_ai_count / 100) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black italic">{user.daily_ai_count}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(user)} className="rounded-xl">
                                                    <MoreHorizontal size={20} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* MODAL DE RECUPERAÇÃO DE LEADS */}
                    <Dialog open={isRecoveryModalOpen} onOpenChange={setIsRecoveryModalOpen}>
                        <DialogContent className="sm:max-w-[700px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black uppercase italic flex items-center gap-2">
                                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                        <Mail size={24} />
                                    </div>
                                    Recuperação de Leads
                                </DialogTitle>
                                <DialogDescription>
                                    Envie o e-mail de 30 dias grátis direto para os leads inativos pelo Resend API.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                {/* CUSTOM EMAIL SENDER */}
                                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-emerald-500/20 mb-6">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-emerald-500" />
                                        <p className="font-bold text-sm text-zinc-900 dark:text-white">Envio Manual Avulso</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                        <Input
                                            placeholder="Nome do Lead (Opcional)"
                                            className="h-10 rounded-xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                            value={customRecoveryName}
                                            onChange={(e) => setCustomRecoveryName(e.target.value)}
                                        />
                                        <Input
                                            placeholder="E-mail"
                                            className="h-10 rounded-xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                            value={customRecoveryEmail}
                                            onChange={(e) => setCustomRecoveryEmail(e.target.value)}
                                        />
                                        <Button
                                            size="sm"
                                            disabled={sendingEmailToId === 'custom' || !customRecoveryEmail}
                                            onClick={() => handleSendRecoveryEmail('custom', customRecoveryEmail, customRecoveryName)}
                                            className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shrink-0 h-10 px-6"
                                        >
                                            {sendingEmailToId === 'custom' ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Send className="w-4 h-4 mr-2" />
                                            )}
                                            Enviar 30 Dias
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="my-6 opacity-30" />

                                <p className="font-bold text-sm text-muted-foreground mb-4 uppercase tracking-widest">Leads Cadastrados</p>

                                {users.filter((u) => u.subscription_status !== 'active' && u.email).length === 0 && (
                                    <div className="text-center text-muted-foreground py-8 font-medium">Nenhum lead inativo encontrado com email cadastrado.</div>
                                )}
                                {users
                                    .filter((u) => u.subscription_status !== 'active' && u.email)
                                    .map((lead) => (
                                        <div key={lead.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 gap-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border-2 border-emerald-500/20">
                                                    <AvatarFallback className="bg-emerald-500/10 text-emerald-500 font-black">
                                                        {lead.company_name?.substring(0, 2).toUpperCase() || 'L'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-black text-sm uppercase italic text-zinc-900 dark:text-white leading-none mb-1">
                                                        {lead.company_name || 'Sem Nome'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-medium">{lead.email}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                disabled={sendingEmailToId === lead.id}
                                                onClick={() => lead.email && handleSendRecoveryEmail(lead.id, lead.email, lead.company_name || '')}
                                                className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shrink-0"
                                            >
                                                {sendingEmailToId === lead.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                Enviar 30 Dias
                                            </Button>
                                        </div>
                                    ))
                                }
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* ABA DE LOGS DO SISTEMA */}
                <TabsContent value="logs">
                    {/* ... (conteúdo existente do logs) */}
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardHeader className="p-8">
                            <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Logs do Sistema</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Nível</TableHead>
                                        <TableHead>Mensagem</TableHead>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={log.level === 'error' ? 'destructive' : 'outline'}>
                                                    {log.level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{log.message}</TableCell>
                                            <TableCell>{log.profile?.company_name || 'Sistema'}</TableCell>
                                            <TableCell>
                                                {!log.resolved && (
                                                    <Button size="sm" onClick={() => resolveLog(log.id)}>Resolver</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA MONITORAMENTO IA (NOVA) */}
                <TabsContent value="ai-monitoring">
                    <AdminAIMonitoring />
                </TabsContent>

                {/* ABA GEMINI CONFIG (NOVA) */}
                <TabsContent value="gemini-config">
                    <AdminGeminiConfig />
                </TabsContent>

                {/* ABA DE CONFIGURAÇÃO EVOLUTION API */}
                <TabsContent value="evolution">
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardHeader className="p-8">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                                    <Activity size={24} />
                                </div>
                                <div className="flex-1">
                                    <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Motor de WhatsApp</CardTitle>
                                    <CardDescription>Configure as credenciais globais da Evolution API v2.</CardDescription>
                                </div>
                                {/* CONNECTION STATUS LED */}
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                    <div className={`w-3 h-3 rounded-full ${evolutionStatus === 'error' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                        evolutionStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                            'bg-zinc-400'
                                        }`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {evolutionStatus === 'error' ? 'FALHA DE CONEXÃO' : evolutionStatus === 'online' ? 'API ONLINE' : 'STATUS DESCONHECIDO'}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">URL da API (Koyeb/Seu Link)</label>
                                    <Input
                                        placeholder="https://sua-api.koyeb.app"
                                        className="h-12 rounded-xl border-zinc-200 dark:border-zinc-800"
                                        id="global_evolution_url"
                                        defaultValue={users.find(u => u.is_admin)?.whatsapp_api_url || ''}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">O link que o Koyeb te deu sem a barra no final.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Global API Key</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="password"
                                            placeholder="Sua_Chave_Secreta"
                                            className="h-12 rounded-xl flex-1 border-zinc-200 dark:border-zinc-800"
                                            id="global_evolution_key"
                                            defaultValue={users.find(u => u.is_admin)?.whatsapp_api_key || ''}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic">A chave que você definiu na variável `AUTHENTICATION_API_KEY`.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl h-12 px-6 font-black uppercase tracking-widest border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    onClick={() => handleCheckConnection(true)}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" /> Testar Conexão
                                </Button>

                                <Button
                                    className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-lg shadow-green-500/20 bg-green-500 hover:bg-green-600 outline-none ring-0 border-0"
                                    onClick={async () => {
                                        const url = (document.getElementById('global_evolution_url') as HTMLInputElement).value;
                                        const key = (document.getElementById('global_evolution_key') as HTMLInputElement).value;

                                        if (!url || !key) {
                                            toast.error("Preencha todos os campos!");
                                            return;
                                        }

                                        try {
                                            const { error } = await supabase
                                                .from('profiles')
                                                .update({
                                                    whatsapp_api_url: url,
                                                    whatsapp_api_key: key
                                                })
                                                .eq('id', profile?.id);

                                            if (error) throw error;
                                            toast.success("Credenciais Globais Salvas!");
                                        } catch (err: any) {
                                            toast.error("Erro ao salvar: " + err.message);
                                        }
                                    }}
                                >
                                    Salvar Configuração Master
                                </Button>
                            </div>

                            <Separator className="my-8" />

                            <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-3xl space-y-4">
                                <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-amber-600">
                                    <ShieldAlert size={16} /> Notas de Segurança
                                </h4>
                                <ul className="text-xs space-y-2 text-amber-700/80 font-medium">
                                    <li>• Estas credenciais são **GLOBAIS** e usadas para criar instâncias para novos clientes.</li>
                                    <li>• Apenas administradores do DIRECT AI têm acesso a esta aba.</li>
                                    <li>• Certifique-se de que a Evolution API está com o Cache Redis ativado para melhor estabilidade.</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA DE MARKETING & GANHOS */}
                <TabsContent value="marketing">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-zinc-900 text-white overflow-hidden">
                            <CardHeader className="p-10 pb-4">
                                <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">Inteligência de Lucro</CardTitle>
                                <CardDescription className="text-zinc-400">Projeção e análise de faturamento por tier.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-10 space-y-8">
                                <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10">
                                    <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">Ticket Médio Projetado</h4>
                                    <div className="flex items-end gap-3 text-white">
                                        <span className="text-5xl font-black tracking-tighter italic leading-none">R$ 97,00</span>
                                        <span className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">por Assinante</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Distribuição de Receita</h4>
                                    <div className="space-y-4">
                                        {[
                                            { name: 'Plano Pro (R$ 97,00)', pct: 70, color: 'bg-primary' },
                                            { name: 'Pro Max (R$ 137,00)', pct: 25, color: 'bg-green-500' },
                                            { name: 'Gifted/Promo (R$ 0,00)', pct: 5, color: 'bg-zinc-700' },
                                        ].map((item) => (
                                            <div key={item.name} className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold uppercase italic">
                                                    <span>{item.name}</span>
                                                    <span>{item.pct}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <p className="text-xs text-zinc-500 leading-relaxed font-bold italic translate-y-[-10px]">
                                        * Baseado no faturamento recorrente mensal (MRR). Exclui taxas de checkout do Stripe.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-zinc-900/50 backdrop-blur-3xl overflow-hidden flex flex-col justify-center align-middle p-8">
                            <div className="text-center space-y-6">
                                <div className="inline-flex p-4 rounded-full bg-primary/20 text-primary mb-4">
                                    <TrendingUp size={48} />
                                </div>
                                <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-tight">Insight de Marketing</h3>
                                <p className="text-muted-foreground font-bold italic max-w-xs mx-auto">
                                    Você conquistou <strong>{stats.newUsers7d} novos usuários</strong> nos últimos 7 dias. Seu custo de aquisição está equilibrado.
                                </p>
                                <Button className="w-full h-16 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-105 transition-transform">
                                    Impulsionar Campanhas
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden mt-8">
                        <CardHeader className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Tracking de Afiliados</CardTitle>
                                <CardDescription className="text-xs font-medium italic">Monitoramento de códigos de parceiros e comissões.</CardDescription>
                            </div>
                            <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase tracking-widest text-[10px]">
                                {affiliateStats.length} Parceiros Ativos
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Código do Parceiro</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Cupons Ativos</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Receita Gerada (MRR)</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-right text-emerald-500">Comissão (Est. 10%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {affiliateStats.length > 0 ? affiliateStats.map((aff) => (
                                        <TableRow key={aff.code} className="hover:bg-muted/20 border-zinc-50 dark:border-zinc-900">
                                            <TableCell className="p-6 font-black italic uppercase tracking-tighter">
                                                <div className="flex flex-col">
                                                    <span>{aff.code}</span>
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="link" className="p-0 h-auto text-[10px] text-primary self-start font-bold uppercase italic">
                                                                Ver {aff.referredUsersProfiles.length} Indicados
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-md rounded-3xl">
                                                            <DialogHeader>
                                                                <DialogTitle className="font-black italic uppercase">Indicados: {aff.code}</DialogTitle>
                                                                <DialogDescription>Lista de usuários que utilizaram este código.</DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 mt-4">
                                                                {aff.referredUsersProfiles.map(u => (
                                                                    <div key={u.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-zinc-100 dark:border-zinc-800">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-black uppercase italic">{u.company_name}</span>
                                                                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                                                        </div>
                                                                        <Badge className={u.subscription_status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"}>
                                                                            {u.subscription_status}
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <Badge variant="outline" className="font-black tabular-nums border-zinc-200 dark:border-zinc-800">
                                                    {aff.users}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-6 text-center font-black tabular-nums text-emerald-600">
                                                R$ {aff.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="p-6 text-right font-black tabular-nums text-primary">
                                                <div className="flex flex-col items-end">
                                                    <span>R$ {aff.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    {aff.pixKey ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-[9px] uppercase font-black hover:bg-primary/10 text-primary p-0 px-2 mt-1"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(aff.pixKey!);
                                                                toast.success(`Chave ${aff.pixType?.toUpperCase()} Copiada!`);
                                                            }}
                                                        >
                                                            <Copy size={10} className="mr-1" /> Copiar PIX
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[9px] text-zinc-500 italic mt-1 uppercase font-bold">PIX não cadastrado</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="p-12 text-center text-muted-foreground italic font-medium">
                                                Nenhum parceiro com cupons ativos no momento.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA DE PAGAMENTOS (SAQUES) */}
                <TabsContent value="payouts">
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardHeader className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter text-emerald-500">Solicitações de Saque</CardTitle>
                                <CardDescription className="text-xs font-medium italic">Gerencie os pedidos de transferência dos seus parceiros.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 font-black uppercase tracking-widest text-[10px]">
                                    {pendingWithdrawals.length} Pendentes
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Data</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Afiliado</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-center">Valor</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6">Chave PIX</TableHead>
                                        <TableHead className="font-black uppercase tracking-widest text-[10px] p-6 text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingWithdrawals.length > 0 ? pendingWithdrawals.map((w) => (
                                        <TableRow key={w.id} className="hover:bg-muted/20 border-zinc-50 dark:border-zinc-900">
                                            <TableCell className="p-6 text-xs font-medium text-muted-foreground">
                                                {new Date(w.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="p-6">
                                                <div className="flex flex-col">
                                                    <span className="font-black italic uppercase text-sm tracking-tighter leading-none">{w.profile?.company_name || 'Desconhecido'}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{w.profile?.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <Badge variant="outline" className="font-black italic text-sm border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                                                    R$ {Number(w.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="uppercase text-[9px] font-black border-zinc-200">{w.pix_key_type}</Badge>
                                                    <span className="text-xs font-bold tabular-nums">{w.pix_key}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-zinc-400 hover:text-primary"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(w.pix_key);
                                                            toast.success("Chave PIX Copiada!");
                                                        }}
                                                    >
                                                        <Copy size={12} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        className="h-9 rounded-xl font-black uppercase text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleProcessWithdrawal(w.id, 'rejected')}
                                                    >
                                                        RECUSAR
                                                    </Button>
                                                    <Button
                                                        className="h-9 rounded-xl font-black uppercase text-[10px] bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                                                        onClick={() => handleProcessWithdrawal(w.id, 'paid')}
                                                    >
                                                        MARCAR COMO PAGO
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="p-12 text-center text-muted-foreground italic font-medium">
                                                Nenhuma solicitação de saque pendente.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA DE CARTEIRA / LOGÍSTICA */}
                <TabsContent value="wallet">
                    <AdminWalletManager />
                </TabsContent>
            </Tabs>

            {/* Modal de Edição de Usuário (Existente mas estilizado) */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-3xl bg-white dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Ajuste de Credenciais</DialogTitle>
                        <DialogDescription className="font-bold">Modificando privilégios de {selectedUser?.company_name || 'Usuário'}.</DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="space-y-6 py-6 font-bold overflow-y-auto max-h-[70vh] pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 block mb-1">Pedidos Feitos</span>
                                    <span className="text-2xl font-black italic text-emerald-700 dark:text-emerald-400 leading-none">
                                        {loadingStats ? <RefreshCw className="animate-spin inline" size={16} /> : userStats?.pedidos || 0}
                                    </span>
                                </div>
                                <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 block mb-1">Clientes</span>
                                    <span className="text-2xl font-black italic text-orange-700 dark:text-orange-400 leading-none">
                                        {loadingStats ? <RefreshCw className="animate-spin inline" size={16} /> : userStats?.clientes || 0}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-muted-foreground font-black">Status do Plano</label>
                                <Select value={editForm.subscription_status} onValueChange={(v: any) => setEditForm(p => ({ ...p, subscription_status: v, subscription_tier: v === 'active' ? 'pro' : p.subscription_tier }))}>
                                    <SelectTrigger className="rounded-xl h-12 border-zinc-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="trial">Trial (Beta)</SelectItem>
                                        <SelectItem value="active">Operador Ativo (Pago)</SelectItem>
                                        <SelectItem value="expired">Acesso Revogado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-muted-foreground font-black">Nível do Sistema (Tier)</label>
                                <Select value={editForm.subscription_tier} onValueChange={(v: any) => setEditForm(p => ({ ...p, subscription_tier: v }))}>
                                    <SelectTrigger className="rounded-xl h-12 border-zinc-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">Free/Trial</SelectItem>
                                        <SelectItem value="pro">Elite PRO</SelectItem>
                                        <SelectItem value="pro_max">Elite PRO MAX</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator className="opacity-10" />

                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <TrendingUp size={16} />
                                        </div>
                                        <label className="text-xs font-black uppercase italic tracking-tighter">Status de Afiliado</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded-md border-zinc-200 accent-emerald-500"
                                            checked={editForm.is_affiliate}
                                            onChange={(e) => setEditForm(p => ({ ...p, is_affiliate: e.target.checked }))}
                                        />
                                    </div>
                                </div>

                                {editForm.is_affiliate && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="space-y-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 overflow-hidden"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Código Único</label>
                                            <Input
                                                value={editForm.affiliate_code}
                                                onChange={(e) => setEditForm(p => ({ ...p, affiliate_code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                                                placeholder="EX: PARCEIRO10"
                                                className="rounded-xl border-zinc-200 font-black italic h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Comissão do Afiliado (%)</label>
                                            <Input
                                                type="number"
                                                value={editForm.commission_rate}
                                                onChange={(e) => setEditForm(p => ({ ...p, commission_rate: Number(e.target.value) }))}
                                                className="rounded-xl border-zinc-200 font-black h-10"
                                            />
                                            <p className="text-[9px] text-muted-foreground italic">O desconto do cliente é fixo em 15% (Cupom).</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Chave PIX (Para Pagamento)</label>
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className="h-10 px-3 flex items-center shrink-0 uppercase text-[10px] font-black border-zinc-200">
                                                    {editForm.affiliate_pix_key_type || 'NÃO DEF.'}
                                                </Badge>
                                                <Input
                                                    value={editForm.affiliate_pix_key}
                                                    readOnly
                                                    placeholder="Aguardando cadastro..."
                                                    className="rounded-xl border-zinc-200 font-bold h-10 bg-zinc-50"
                                                />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground italic leading-none">Apenas o próprio parceiro pode alterar sua chave PIX por segurança.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {editForm.subscription_status === 'active' && (
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                        <input
                                            type="checkbox"
                                            id="gifted"
                                            checked={editForm.is_gifted_plan}
                                            onChange={(e) => setEditForm(p => ({ ...p, is_gifted_plan: e.target.checked }))}
                                            className="w-5 h-5 rounded-md accent-primary"
                                        />
                                        <label htmlFor="gifted" className="text-sm font-black uppercase italic">Dada de Presente (Gift)</label>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                                        <input
                                            type="checkbox"
                                            id="wa_plus"
                                            checked={editForm.is_whatsapp_plus_active}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setEditForm(p => ({
                                                    ...p,
                                                    is_whatsapp_plus_active: checked,
                                                    is_whatsapp_plus_gifted: checked
                                                }));
                                            }}
                                            className="w-5 h-5 rounded-md accent-emerald-500"
                                        />
                                        <div className="flex flex-col">
                                            <label htmlFor="wa_plus" className="text-sm font-black uppercase italic text-emerald-600">Poder WhatsApp Plus</label>
                                            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest leading-none">Libera Gabi Engine</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 pt-4">
                        <Button variant="ghost" className="rounded-xl font-bold uppercase text-xs" onClick={() => setIsDetailOpen(false)}>Cancelar</Button>
                        <Button className="rounded-xl h-12 font-black uppercase tracking-widest text-xs px-8 shadow-lg" onClick={handleSaveDetail}>Aplicar Alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="text-center opacity-30 mt-20">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">DIRECT AI COMMAND CENTER • SECURE ACCESS ONLY</p>
            </div>
        </div >
    );
}

function CrownIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
    )
}
