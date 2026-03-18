import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Wallet, Search, Loader2, Plus, ArrowDownLeft, ArrowUpRight, RefreshCw, Truck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

type UserWalletInfo = {
    id: string;
    email: string | null;
    company_name: string | null;
    wallet_balance: number;
    frenet_balance: number | null;
    ai_credits: number;
    subscription_status: string | null;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export function AdminWalletManager() {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserWalletInfo[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserWalletInfo | null>(null);
    const [amount, setAmount] = useState('');
    const [balanceType, setBalanceType] = useState<'superfrete' | 'frenet' | 'ai_credits'>('superfrete');
    const [description, setDescription] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTx, setLoadingTx] = useState(false);
    const [allUsers, setAllUsers] = useState<UserWalletInfo[]>([]);
    const [viewMode, setViewMode] = useState<'active' | 'all'>('active');

    const fetchAllUsers = async () => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles_v2')
                .select('id, email, company_name, wallet_balance, frenet_balance, ai_credits, subscription_status')
                .order('company_name', { ascending: true });

            if (error) throw error;
            const userData = (data as UserWalletInfo[]) || [];
            setAllUsers(userData);
            setUsers(userData);
        } catch (err: any) {
            toast.error('Erro ao carregar usuários: ' + err.message);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setUsers(allUsers);
            return;
        }

        const term = searchTerm.toLowerCase();
        let filtered = allUsers.filter(u =>
            (u.email?.toLowerCase().includes(term) ||
            u.company_name?.toLowerCase().includes(term))
        );

        if (viewMode === 'active') {
            filtered = filtered.filter(u => u.subscription_status === 'active');
        }

        setUsers(filtered);
    };

    // Inicialização e Busca Reativa
    useEffect(() => {
        fetchAllUsers();
    }, []);

    useEffect(() => {
        handleSearch();
    }, [searchTerm, allUsers, viewMode]);

    const handleSelectUser = async (user: UserWalletInfo) => {
        setSelectedUser(user);
        setLoadingTx(true);
        try {
            const { data, error } = await supabase
                .from('logistics_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar transações:', err);
            setTransactions([]);
        } finally {
            setLoadingTx(false);
        }
    };

    const handleAddCredit = async () => {
        if (!selectedUser) return;
        const numAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Informe um valor válido maior que zero.');
            return;
        }

        setIsAdding(true);
        try {
            const fieldToUpdate = balanceType === 'frenet' ? 'frenet_balance' : balanceType === 'ai_credits' ? 'ai_credits' : 'wallet_balance';
            const currentBalance = balanceType === 'frenet' ? (selectedUser.frenet_balance || 0) : balanceType === 'ai_credits' ? (selectedUser.ai_credits || 0) : (selectedUser.wallet_balance || 0);

            // 1. Update balance
            const newBalance = currentBalance + numAmount;
            const { error: updateError } = await supabase
                .from('profiles_v2')
                .update({ [fieldToUpdate]: newBalance })
                .eq('uid', selectedUser.id);

            if (updateError) throw updateError;

            // 2. Insert transaction record
            const { error: txError } = await supabase
                .from('logistics_transactions')
                .insert({
                    user_id: selectedUser.id,
                    type: 'credit',
                    amount: numAmount,
                    description: description.trim() || `Crédito ${balanceType === 'frenet' ? 'Frenet' : balanceType === 'ai_credits' ? 'Vetoriza AI' : 'SuperFrete'} adicionado pelo admin`,
                    provider: balanceType
                });

            if (txError) throw txError;

            // 3. Update local state
            const updatedUser = {
                ...selectedUser,
                [fieldToUpdate]: newBalance
            };
            setSelectedUser(updatedUser);
            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? updatedUser : u
            ));
            setAmount('');
            setDescription('');

            // 4. Refresh transactions
            handleSelectUser(updatedUser);

            toast.success(`${balanceType === 'ai_credits' ? numAmount : formatCurrency(numAmount)} adicionado à carteira ${balanceType === 'frenet' ? 'Frenet' : balanceType === 'ai_credits' ? 'Vetoriza AI' : 'SuperFrete'} de ${selectedUser.company_name || selectedUser.email}!`);
        } catch (err: any) {
            toast.error('Erro ao adicionar crédito: ' + err.message);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Busca + Lista de Usuários */}
            <Card className="lg:col-span-1 shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 text-purple-600">
                        <Sparkles className="h-5 w-5" />
                        Gestão de Saldos & Créditos AI
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                        Gerencie saldo de logística e créditos do Vetoriza AI.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar por nome ou email..."
                                className="pl-10 h-10 rounded-xl"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    // Filtragem imediata ao digitar
                                    const term = e.target.value.toLowerCase();
                                    if (!term.trim()) {
                                        setUsers(allUsers);
                                    } else {
                                        const filtered = allUsers.filter(u =>
                                            (u.email?.toLowerCase().includes(term) ||
                                            u.company_name?.toLowerCase().includes(term))
                                        );
                                        setUsers(filtered);
                                    }
                                }}
                            />
                        </div>
                        <Button onClick={fetchAllUsers} disabled={isSearching} className="rounded-xl h-10 px-4" title="Recarregar Lista">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>

                    <div className="flex p-1 bg-muted/50 rounded-xl mb-2">
                        <button 
                            onClick={() => setViewMode('active')}
                            className={`flex-1 py-1 px-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                                viewMode === 'active' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                            }`}
                        >
                            Assinantes
                        </button>
                        <button 
                            onClick={() => setViewMode('all')}
                            className={`flex-1 py-1 px-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                                viewMode === 'all' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                            }`}
                        >
                            Todos
                        </button>
                    </div>

                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleSelectUser(user)}
                                className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${selectedUser?.id === user.id
                                    ? 'bg-primary/10 border border-primary/30 shadow-sm'
                                    : 'hover:bg-muted/50 border border-transparent'
                                    }`}
                            >
                                <p className="text-sm font-black italic uppercase leading-none mb-1 truncate">
                                    {user.company_name || 'Sem Nome'}
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] text-muted-foreground font-medium truncate flex-1">{user.email}</p>
                                    <Badge 
                                        variant="secondary" 
                                        className={`text-[8px] font-black uppercase px-1.5 py-0 h-4 ${
                                            user.subscription_status === 'active' 
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}
                                    >
                                        {user.subscription_status === 'active' ? 'Assinante' : 'Trial'}
                                    </Badge>
                                </div>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SuperFrete</span>
                                        <Badge
                                            variant="outline"
                                            className={`font-black text-[10px] tabular-nums ${(user.wallet_balance || 0) > 0
                                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                                : 'text-zinc-500 border-zinc-200'
                                                }`}
                                        >
                                            {formatCurrency(user.wallet_balance || 0)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Frenet</span>
                                        <Badge
                                            variant="outline"
                                            className={`font-black text-[10px] tabular-nums ${(user.frenet_balance || 0) > 0
                                                ? 'text-blue-600 border-blue-200 bg-blue-50'
                                                : 'text-zinc-500 border-zinc-200'
                                                }`}
                                        >
                                            {formatCurrency(user.frenet_balance || 0)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vetoriza AI</span>
                                        <Badge
                                            variant="outline"
                                            className={`font-black text-[10px] tabular-nums ${(user.ai_credits || 0) > 0
                                                ? 'text-purple-600 border-purple-200 bg-purple-50'
                                                : 'text-zinc-500 border-zinc-200'
                                                }`}
                                        >
                                            {user.ai_credits || 0} créditos
                                        </Badge>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Coluna 2-3: Adicionar Crédito + Histórico */}
            <div className="lg:col-span-2 space-y-6">
                {selectedUser ? (
                    <>
                        {/* Card de Adicionar Crédito */}
                        <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                            <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                                            {selectedUser.company_name || 'Usuário'}
                                        </CardTitle>
                                        <CardDescription className="text-xs font-medium">{selectedUser.email}</CardDescription>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">SuperFrete</p>
                                            <p className={`text-sm font-black italic tracking-tighter ${(selectedUser.wallet_balance || 0) > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                                {formatCurrency(selectedUser.wallet_balance || 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Frenet</p>
                                            <p className={`text-sm font-black italic tracking-tighter ${(selectedUser.frenet_balance || 0) > 0 ? 'text-blue-600' : 'text-zinc-400'}`}>
                                                {formatCurrency(selectedUser.frenet_balance || 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vetoriza AI</p>
                                            <p className={`text-sm font-black italic tracking-tighter ${(selectedUser.ai_credits || 0) > 0 ? 'text-purple-600' : 'text-zinc-400'}`}>
                                                {selectedUser.ai_credits || 0} Créditos
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Carteira Destino
                                        </Label>
                                        <Select value={balanceType} onValueChange={(val: any) => setBalanceType(val)}>
                                            <SelectTrigger className="h-12 rounded-xl font-bold italic">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="superfrete" className="font-bold italic">SUPERFRETE</SelectItem>
                                                <SelectItem value="frenet" className="font-bold italic">FRENET</SelectItem>
                                                <SelectItem value="ai_credits" className="font-bold italic">VETORIZA AI (CRÉDITOS)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Valor do Crédito (R$)
                                        </Label>
                                        <Input
                                            placeholder="Ex: 50.00"
                                            className="h-12 rounded-xl text-lg font-black"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            type="text"
                                            inputMode="decimal"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Descrição (opcional)
                                        </Label>
                                        <Input
                                            placeholder="Motivo do crédito..."
                                            className="h-12 rounded-xl"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs gap-2 shadow-lg shadow-primary/20"
                                    onClick={handleAddCredit}
                                    disabled={isAdding || !amount}
                                >
                                    {isAdding ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    Adicionar Crédito
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Card de Histórico de Transações */}
                        <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                            <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                                <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    Histórico de Transações
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingTx ? (
                                    <div className="p-8 flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : transactions.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                                                <TableHead className="font-black uppercase tracking-widest text-[10px] p-4">Tipo</TableHead>
                                                <TableHead className="font-black uppercase tracking-widest text-[10px] p-4">Descrição</TableHead>
                                                <TableHead className="font-black uppercase tracking-widest text-[10px] p-4 text-right">Valor</TableHead>
                                                <TableHead className="font-black uppercase tracking-widest text-[10px] p-4">Data</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transactions.map((tx) => (
                                                <TableRow key={tx.id} className="hover:bg-muted/20 border-zinc-50 dark:border-zinc-900">
                                                    <TableCell className="p-4">
                                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${tx.type === 'credit'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            }`}>
                                                            {tx.type === 'credit' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                                            {tx.type === 'credit' ? 'Crédito' : 'Débito'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="p-4 text-sm font-medium">
                                                        {tx.description || (tx.type === 'credit' ? 'Recarga' : 'Emissão de Etiqueta')}
                                                    </TableCell>
                                                    <TableCell className={`p-4 text-right font-black tabular-nums ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'
                                                        }`}>
                                                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                                    </TableCell>
                                                    <TableCell className="p-4 text-xs text-muted-foreground">
                                                        {new Date(tx.created_at).toLocaleString('pt-BR')}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="p-12 text-center text-muted-foreground italic font-medium text-sm">
                                        Nenhuma transação para este usuário.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
                        <CardContent className="p-16 text-center">
                            <Wallet className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-lg font-black uppercase italic tracking-tighter text-muted-foreground/60">
                                Selecione um Usuário
                            </h3>
                            <p className="text-sm text-muted-foreground/40 mt-2 font-medium">
                                Busque e selecione um usuário na lista ao lado para gerenciar o saldo de logística.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
