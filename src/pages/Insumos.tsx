import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Package, AlertTriangle, Search, Pencil, Trash2, Filter, Minus } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Insumo } from '@/types/insumo';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';

const Insumos = () => {
    const { session, supabase } = useSession();
    const location = useLocation();
    const navigate = useNavigate();
    const accessToken = session?.access_token;
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Selection State
    const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
    const [adjustQuantity, setAdjustQuantity] = useState<string>('');
    const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');

    // Form State for Create/Edit
    const [formData, setFormData] = useState<Partial<Insumo>>({
        nome: '',
        quantidade_atual: 0,
        unidade: 'un',
        quantidade_minima: 10,
        custo_unitario: 0
    });

    // Abrir modal se vier do Dashboard
    useEffect(() => {
        if (location.state?.openForm) {
            resetForm();
            setIsFormOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    const formatCurrencyDisplay = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        const numericValue = Number(rawValue) / 100;
        setFormData({ ...formData, custo_unitario: numericValue });
    };

    const fetchInsumos = async () => {
        try {
            setLoading(true);
            if (!session) return;

            const { data, error } = await supabase
                .from('insumos')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;
            setInsumos(data || []);
        } catch (error) {
            console.error(error);
            showError("Não foi possível carregar os insumos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsumos();
    }, [session]);

    const resetForm = () => {
        setFormData({
            nome: '',
            quantidade_atual: 0,
            unidade: 'un',
            quantidade_minima: 10,
            custo_unitario: 0
        });
        setSelectedInsumo(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsFormOpen(true);
    };

    const handleOpenEdit = (insumo: Insumo) => {
        setSelectedInsumo(insumo);
        setFormData({
            nome: insumo.nome,
            quantidade_atual: insumo.quantidade_atual,
            unidade: insumo.unidade,
            quantidade_minima: insumo.quantidade_minima,
            custo_unitario: insumo.custo_unitario
        });
        setIsFormOpen(true);
    };

    const handleOpenAdjust = (insumo: Insumo, type: 'add' | 'remove') => {
        setSelectedInsumo(insumo);
        setAdjustType(type);
        setAdjustQuantity('');
        setIsAdjustOpen(true);
    };

    const handleDeleteClick = (insumo: Insumo) => {
        setSelectedInsumo(insumo);
        setIsDeleteOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.nome) {
                showError("O nome do insumo é obrigatório.");
                return;
            }

            const payload = {
                user_id: session?.user.id,
                nome: formData.nome,
                quantidade_atual: Number(formData.quantidade_atual) || 0,
                unidade: formData.unidade || 'un',
                quantidade_minima: Number(formData.quantidade_minima) || 0,
                custo_unitario: Number(formData.custo_unitario) || 0
            };

            let error;
            if (selectedInsumo) {
                // Edit
                const { error: updateError } = await supabase
                    .from('insumos')
                    .update(payload)
                    .eq('id', selectedInsumo.id);
                error = updateError;
            } else {
                // Create
                const { error: insertError } = await supabase
                    .from('insumos')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            showSuccess(selectedInsumo ? "Insumo atualizado!" : "Insumo criado com sucesso!");
            setIsFormOpen(false);
            fetchInsumos();
        } catch (error: any) {
            showError(`Erro ao salvar: ${error.message}`);
        }
    };

    const handleConfirmAdjust = async () => {
        if (!selectedInsumo || !adjustQuantity) return;

        try {
            const qty = Number(adjustQuantity);
            if (isNaN(qty) || qty <= 0) {
                showError("Digite uma quantidade válida.");
                return;
            }

            const newQuantity = adjustType === 'add'
                ? selectedInsumo.quantidade_atual + qty
                : Math.max(0, selectedInsumo.quantidade_atual - qty);

            const { error } = await supabase
                .from('insumos')
                .update({ quantidade_atual: newQuantity })
                .eq('id', selectedInsumo.id);

            if (error) throw error;

            showSuccess(`Estoque ${adjustType === 'add' ? 'adicionado' : 'removido'} com sucesso!`);
            setIsAdjustOpen(false);
            fetchInsumos();
        } catch (error: any) {
            showError(`Erro ao ajustar estoque: ${error.message}`);
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedInsumo) return;
        try {
            const { error } = await supabase
                .from('insumos')
                .delete()
                .eq('id', selectedInsumo.id);

            if (error) throw error;

            showSuccess("Insumo removido com sucesso.");
            setIsDeleteOpen(false);
            fetchInsumos();
        } catch (error: any) {
            showError(`Erro ao deletar: ${error.message}`);
        }
    };

    const filteredInsumos = insumos.filter(i => {
        const matchesSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLowStock = filterLowStock ? i.quantidade_atual <= i.quantidade_minima : true;
        return matchesSearch && matchesLowStock;
    });

    return (
        <div className="space-y-6 p-6 pb-20 md:pb-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="h-8 w-8 text-primary" />
                        Gestão de Estoque
                    </h1>
                    <p className="text-muted-foreground">Controle de insumos e materiais.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={filterLowStock ? "destructive" : "outline"}
                        onClick={() => setFilterLowStock(!filterLowStock)}
                        className="gap-2"
                    >
                        <AlertTriangle className="h-4 w-4" />
                        {filterLowStock ? "Mostrando Baixo Estoque" : "Filtrar Baixo Estoque"}
                    </Button>
                    <Button onClick={handleOpenCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> Novo Insumo
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar insumos por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 max-w-md bg-background"
                />
            </div>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                </div>
            ) : filteredInsumos.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title={searchTerm ? "Nenhum insumo encontrado" : "Estoque vazio"}
                    description={searchTerm ? "Tente outro termo de busca." : "Comece adicionando seus materiais e insumos."}
                    action={!searchTerm ? (
                        <Button onClick={handleOpenCreate} variant="outline" className="mt-4">
                            Adicionar Primeiro Insumo
                        </Button>
                    ) : undefined}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredInsumos.map(insumo => {
                        const isLowStock = insumo.quantidade_atual <= insumo.quantidade_minima;
                        return (
                            <Card key={insumo.id} className={cn(
                                "hover:shadow-md transition-shadow flex flex-col justify-between",
                                isLowStock && "border-red-200 bg-red-50/50 dark:bg-red-900/10"
                            )}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-lg font-semibold truncate" title={insumo.nome}>
                                            {insumo.nome}
                                        </CardTitle>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEdit(insumo)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(insumo)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    {isLowStock && (
                                        <Badge variant="destructive" className="w-fit flex gap-1 items-center text-[10px] px-1.5">
                                            <AlertTriangle className="h-3 w-3" /> Estoque Baixo
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        <div className="text-3xl font-bold text-primary flex items-end gap-1">
                                            {insumo.quantidade_atual}
                                            <span className="text-sm font-normal text-muted-foreground mb-1">{insumo.unidade}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Mínimo: {insumo.quantidade_minima} {insumo.unidade}</span>
                                            <span>R$ {insumo.custo_unitario.toFixed(2)} / {insumo.unidade}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-xs gap-1 border-dashed"
                                            onClick={() => handleOpenAdjust(insumo, 'remove')}
                                        >
                                            <Minus className="h-3 w-3" /> Baixa
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-xs gap-1 border-dashed"
                                            onClick={() => handleOpenAdjust(insumo, 'add')}
                                        >
                                            <Plus className="h-3 w-3" /> Entrada
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal Create/Edit */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedInsumo ? 'Editar Insumo' : 'Adicionar Novo Insumo'}</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do material para controle de estoque.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nome">Nome do Material</Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Tinta DTF Branca"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="qtd">Quantidade Atual</Label>
                                <Input
                                    id="qtd"
                                    type="number"
                                    value={formData.quantidade_atual}
                                    onChange={e => setFormData({ ...formData, quantidade_atual: Number(e.target.value) })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="unidade">Unidade de Medida</Label>
                                <Select
                                    value={formData.unidade}
                                    onValueChange={(value) => setFormData({ ...formData, unidade: value })}
                                >
                                    <SelectTrigger id="unidade">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="un">Unidade (un)</SelectItem>
                                        <SelectItem value="m">Metros (m)</SelectItem>
                                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                                        <SelectItem value="l">Litro (l)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {formData.unidade === 'm' && (
                                    <p className="text-[10px] text-muted-foreground text-blue-500">
                                        * Permite baixa automática por m² em pedidos.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="min">Estoque Mínimo</Label>
                                <Input
                                    id="min"
                                    type="number"
                                    value={formData.quantidade_minima}
                                    onChange={e => setFormData({ ...formData, quantidade_minima: Number(e.target.value) })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="custo">Custo Unitário (R$)</Label>
                                <Input
                                    id="custo"
                                    type="text"
                                    value={formData.custo_unitario === 0 ? '' : formatCurrencyDisplay(formData.custo_unitario || 0)}
                                    onChange={handleCurrencyChange}
                                    placeholder="R$ 0,00"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>{selectedInsumo ? 'Salvar Alterações' : 'Criar Insumo'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Adjust Stock */}
            <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
                <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                        <DialogTitle>{adjustType === 'add' ? 'Adicionar Estoque' : 'Baixa de Estoque'}</DialogTitle>
                        <DialogDescription>
                            {selectedInsumo?.nome} - Atual: {selectedInsumo?.quantidade_atual} {selectedInsumo?.unidade}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Quantidade a {adjustType === 'add' ? 'adicionar' : 'remover'}</Label>
                        <div className="flex items-center gap-2 mt-2">
                            <Input
                                type="number"
                                value={adjustQuantity}
                                onChange={(e) => setAdjustQuantity(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                            />
                            <span className="text-sm font-medium text-muted-foreground">{selectedInsumo?.unidade}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAdjustOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmAdjust} variant={adjustType === 'remove' ? 'destructive' : 'default'}>
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Alert Delete */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso removerá permanentemente o insumo <b>{selectedInsumo?.nome}</b> do seu estoque.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Insumos;
