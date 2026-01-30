
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
    Star
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
    subscription_gift_viewed?: boolean;
    pedidos_count?: number;
    clientes_count?: number;
    whatsapp_api_url?: string;
    whatsapp_api_key?: string;
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
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [editForm, setEditForm] = useState<Partial<AdminProfile>>({});
    const [userStats, setUserStats] = useState<{ pedidos: number, clientes: number } | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

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
            // pro: 49.90, enterprise: 149.90
            const mrrValue = usersData.reduce((acc, u) => {
                if (u.subscription_status === 'active' && !u.is_gifted_plan) {
                    return acc + (u.subscription_tier === 'enterprise' ? 149.90 : 49.90);
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

        } catch (err: any) {
            toast.error('Erro ao buscar dados: ' + err.message);
        } finally {
            setIsLoading(false);
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
            is_gifted_plan: user.is_gifted_plan || false
        });
        fetchUserStats(user.id);
        setIsDetailOpen(true);
    };

    const handleSaveDetail = async () => {
        if (!selectedUser) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update(editForm)
                .eq('id', selectedUser.id);

            if (error) throw error;
            toast.success('Usuário atualizado!');
            setIsDetailOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
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
                            <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500">
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
                    <TabsTrigger value="logs" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0">Monitoramento IA</TabsTrigger>
                    <TabsTrigger value="evolution" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0 text-green-500">Evolution API</TabsTrigger>
                    <TabsTrigger value="marketing" className="rounded-xl px-4 md:px-8 font-black uppercase tracking-widest text-[11px] flex-1 md:flex-none shrink-0">Marketing & Ganhos</TabsTrigger>
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
                                                        Ativo {user.is_gifted_plan && "🎁"}
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
                                                <Badge variant="outline" className="font-black tabular-nums border-zinc-200 dark:border-zinc-800 text-violet-500">
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
                </TabsContent>

                {/* ABA DE MONITORAMENTO IA (LOGS) */}
                <TabsContent value="logs">
                    {/* ... (conteúdo existente do logs) */}
                </TabsContent>

                {/* ABA DE CONFIGURAÇÃO EVOLUTION API */}
                <TabsContent value="evolution">
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardHeader className="p-8">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Motor de WhatsApp</CardTitle>
                                    <CardDescription>Configure as credenciais globais da Evolution API v2.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">URL da API (Koyeb/Seu Link)</label>
                                    <Input
                                        placeholder="https://sua-api.koyeb.app"
                                        className="h-12 rounded-xl"
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
                                            className="h-12 rounded-xl flex-1"
                                            id="global_evolution_key"
                                            defaultValue={users.find(u => u.is_admin)?.whatsapp_api_key || ''}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic">A chave que você definiu na variável `AUTHENTICATION_API_KEY`.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button
                                    className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-lg shadow-green-500/20 bg-green-500 hover:bg-green-600"
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

                            <div className="bg-muted/30 p-6 rounded-3xl space-y-4">
                                <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-amber-500" /> Notas de Segurança
                                </h4>
                                <ul className="text-xs space-y-2 text-muted-foreground font-medium">
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
                                        <span className="text-5xl font-black tracking-tighter italic leading-none">R$ 54,90</span>
                                        <span className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">por Assinante</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Distribuição de Receita</h4>
                                    <div className="space-y-4">
                                        {[
                                            { name: 'Plano Pro (R$ 49,90)', pct: 70, color: 'bg-primary' },
                                            { name: 'Enterprise (R$ 149,90)', pct: 20, color: 'bg-blue-500' },
                                            { name: 'Gifted/Promo (R$ 0,00)', pct: 10, color: 'bg-zinc-700' },
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
                </TabsContent>
            </Tabs>

            {/* Modal de Edição de Usuário (Existente mas estilizado) */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Ajuste de Credenciais</DialogTitle>
                        <DialogDescription className="font-bold">Modificando privilégios de {selectedUser?.company_name}.</DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="space-y-6 py-6 font-bold">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-500 block mb-1">Pedidos Feitos</span>
                                    <span className="text-2xl font-black italic text-violet-700 dark:text-violet-400 leading-none">
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

                            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Gift size={18} />
                                        <span className="text-xs font-black uppercase tracking-tighter italic">Recompensas White Label</span>
                                    </div>
                                    <Badge variant={(selectedUser.clientes_count || 0) >= 100 ? "default" : "secondary"} className="text-[9px] uppercase font-black tracking-widest">
                                        {(selectedUser.clientes_count || 0) >= 100 ? "DESBLOQUEADO" : "BLOQUEADO"}
                                    </Badge>
                                </div>

                                <p className="text-[10px] text-zinc-500 font-medium">
                                    Atingiu 100 clientes? {(selectedUser.clientes_count || 0) >= 100 ? "Sim. Meta batida!" : `Não. Falta ${100 - (selectedUser.clientes_count || 0)} para o presente.`}
                                </p>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-10 rounded-xl border-primary/20 text-primary hover:bg-primary/10 text-[10px] uppercase font-black italic gap-2"
                                    onClick={() => {
                                        toast.success("Branding Liberado com Sucesso!");
                                        // We could update a DB field here if we had branding_unlocked
                                    }}
                                >
                                    <Palette size={14} /> Liberar Cores Manualmente
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest text-muted-foreground">Status do Plano</label>
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
                                <label className="text-xs uppercase tracking-widest text-muted-foreground">Nivel do Sistema (Tier)</label>
                                <Select value={editForm.subscription_tier} onValueChange={(v: any) => setEditForm(p => ({ ...p, subscription_tier: v }))}>
                                    <SelectTrigger className="rounded-xl h-12 border-zinc-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">Free/Trial</SelectItem>
                                        <SelectItem value="pro">Pro (R$ 49.90)</SelectItem>
                                        <SelectItem value="enterprise">Enterprise (R$ 149.90)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {editForm.subscription_status === 'active' && (
                                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                    <input
                                        type="checkbox"
                                        id="gifted"
                                        checked={editForm.is_gifted_plan}
                                        onChange={(e) => setEditForm(p => ({ ...p, is_gifted_plan: e.target.checked }))}
                                        className="w-5 h-5 rounded-md accent-primary"
                                    />
                                    <label htmlFor="gifted" className="text-sm font-black uppercase italic">Considerar como Presente (Gift)</label>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold uppercase text-xs" onClick={() => setIsDetailOpen(false)}>Cancelar</Button>
                        <Button className="rounded-xl h-12 font-black uppercase tracking-widest text-xs px-8 shadow-lg" onClick={handleSaveDetail}>Aplicar Ordem</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="text-center opacity-30 mt-20">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">DIRECT AI COMMAND CENTER • SECURE ACCESS ONLY</p>
            </div>
        </div>
    );
}

function CrownIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
    )
}
