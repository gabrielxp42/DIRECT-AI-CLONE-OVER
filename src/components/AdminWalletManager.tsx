import { useState } from 'react';
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
import { Wallet, Search, Loader2, Plus, ArrowDownLeft, ArrowUpRight, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

type UserWalletInfo = {
    id: string;
    email: string | null;
    company_name: string | null;
    wallet_balance: number;
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
    const [description, setDescription] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTx, setLoadingTx] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, company_name, wallet_balance')
                .or(`email.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`)
                .order('company_name', { ascending: true })
                .limit(20);

            if (error) throw error;
            setUsers((data as UserWalletInfo[]) || []);
            if (!data?.length) {
                toast.info('Nenhum usuário encontrado.');
            }
        } catch (err: any) {
            toast.error('Erro na busca: ' + err.message);
        } finally {
            setIsSearching(false);
        }
    };

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
            // 1. Update wallet_balance
            const newBalance = (selectedUser.wallet_balance || 0) + numAmount;
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ wallet_balance: newBalance })
                .eq('id', selectedUser.id);

            if (updateError) throw updateError;

            // 2. Insert transaction record
            const { error: txError } = await supabase
                .from('logistics_transactions')
                .insert({
                    user_id: selectedUser.id,
                    type: 'credit',
                    amount: numAmount,
                    description: description.trim() || `Crédito adicionado pelo admin`,
                });

            if (txError) throw txError;

            // 3. Update local state
            setSelectedUser({ ...selectedUser, wallet_balance: newBalance });
            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? { ...u, wallet_balance: newBalance } : u
            ));
            setAmount('');
            setDescription('');

            // 4. Refresh transactions
            handleSelectUser({ ...selectedUser, wallet_balance: newBalance });

            toast.success(`${formatCurrency(numAmount)} adicionado à carteira de ${selectedUser.company_name || selectedUser.email}!`);
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
                    <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        Carteira de Logística
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                        Busque um usuário para gerenciar o saldo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Nome ou email..."
                                className="pl-10 h-10 rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching} className="rounded-xl h-10 px-4">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
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
                                <p className="text-[10px] text-muted-foreground font-medium truncate">{user.email}</p>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo</span>
                                    <Badge
                                        variant="outline"
                                        className={`font-black text-xs tabular-nums ${(user.wallet_balance || 0) > 0
                                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800'
                                                : 'text-zinc-500 border-zinc-200'
                                            }`}
                                    >
                                        {formatCurrency(user.wallet_balance || 0)}
                                    </Badge>
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
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Saldo Atual</p>
                                        <p className={`text-2xl font-black italic tracking-tighter ${(selectedUser.wallet_balance || 0) > 0 ? 'text-emerald-600' : 'text-zinc-400'
                                            }`}>
                                            {formatCurrency(selectedUser.wallet_balance || 0)}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
