import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Package, AlertTriangle, Search, Pencil, Trash2, Filter, Minus, Link as LinkIcon, ExternalLink } from 'lucide-react';
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
    const [isLinksOpen, setIsLinksOpen] = useState(false);
    const [linksLoading, setLinksLoading] = useState(false);
    const [associatedProducts, setAssociatedProducts] = useState<any[]>([]);
    const [associatedTypes, setAssociatedTypes] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [allTypes, setAllTypes] = useState<any[]>([]);
    const [linkTargetId, setLinkTargetId] = useState("");
    const [linkConsumo, setLinkConsumo] = useState("1");

    // Form State for Create/Edit
    const [formData, setFormData] = useState<Partial<Insumo>>({
        nome: '',
        quantidade_atual: 0,
        quantidade_inicial: 0,
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
            quantidade_inicial: 0,
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
            quantidade_inicial: insumo.quantidade_inicial || insumo.quantidade_atual,
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

    const handleOpenLinks = async (insumo: Insumo) => {
        setSelectedInsumo(insumo);
        setIsLinksOpen(true);
        setLinksLoading(true);
        setLinkTargetId("");
        setLinkConsumo("1");
        try {
            // 1. Fetch current links
            const [prodLinks, typeLinks, prods, types] = await Promise.all([
                supabase.from('produto_insumos').select('*, produtos(nome)').eq('insumo_id', insumo.id),
                supabase.from('tipo_producao_insumos').select('*, tipos_producao(nome)').eq('insumo_id', insumo.id),
                supabase.from('produtos').select('id, nome'),
                supabase.from('tipos_producao').select('id, nome')
            ]);

            setAssociatedProducts(prodLinks.data || []);
            setAssociatedTypes(typeLinks.data || []);
            setAllProducts(prods.data || []);
            setAllTypes(types.data || []);
        } catch (error) {
            console.error(error);
            showError("Erro ao carregar vínculos.");
        } finally {
            setLinksLoading(false);
        }
    };

    const handleLinkProduct = async (produtoId: string, consumo: number) => {
        if (!selectedInsumo) return;
        try {
            const { error } = await supabase.from('produto_insumos').insert([{
                produto_id: produtoId,
                insumo_id: selectedInsumo.id,
                consumo: consumo
            }]);
            if (error) throw error;
            showSuccess("Produto vinculado!");
            handleOpenLinks(selectedInsumo); // Refresh
        } catch (error: any) {
            showError("Erro ao vincular: " + error.message);
        }
    };

    const handleUnlinkProduct = async (linkId: string) => {
        try {
            const { error } = await supabase.from('produto_insumos').delete().eq('id', linkId);
            if (error) throw error;
            showSuccess("Vínculo removido.");
            if (selectedInsumo) handleOpenLinks(selectedInsumo);
        } catch (error: any) {
            showError("Erro ao remover: " + error.message);
        }
    };

    const handleLinkType = async (tipoId: string, consumo: number) => {
        if (!selectedInsumo) return;
        try {
            const { error } = await supabase.from('tipo_producao_insumos').insert([{
                tipo_producao_id: tipoId,
                insumo_id: selectedInsumo.id,
                consumo: consumo,
                user_id: session?.user.id,
                organization_id: session?.user.user_metadata?.organization_id // Better use profile org id if available
            }]);
            if (error) throw error;
            showSuccess("Tipo vinculado!");
            handleOpenLinks(selectedInsumo); // Refresh
        } catch (error: any) {
            showError("Erro ao vincular: " + error.message);
        }
    };

    const handleUnlinkType = async (linkId: string) => {
        try {
            const { error } = await supabase.from('tipo_producao_insumos').delete().eq('id', linkId);
            if (error) throw error;
            showSuccess("Vínculo removido.");
            if (selectedInsumo) handleOpenLinks(selectedInsumo);
        } catch (error: any) {
            showError("Erro ao remover: " + error.message);
        }
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
                quantidade_atual: Number((Number(formData.quantidade_atual) || 0).toFixed(4)),
                quantidade_inicial: Number((Number(formData.quantidade_inicial) || Number(formData.quantidade_atual) || 0).toFixed(4)),
                unidade: formData.unidade || 'un',
                quantidade_minima: Number((Number(formData.quantidade_minima) || 0).toFixed(4)),
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

            const newQuantity = Number((adjustType === 'add'
                ? selectedInsumo.quantidade_atual + qty
                : Math.max(0, selectedInsumo.quantidade_atual - qty)).toFixed(4));

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
                                        <div className="flex gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-primary hover:bg-primary/10"
                                                title="Ver Vínculos"
                                                onClick={() => handleOpenLinks(insumo)}
                                            >
                                                <LinkIcon className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(insumo)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(insumo)}>
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
                                    <div className="space-y-4">
                                        <div className="flex items-end justify-between">
                                            <div
                                                className="text-3xl font-bold text-primary flex items-end gap-1 cursor-help truncate max-w-full"
                                                title={`Valor Exato: ${insumo.quantidade_atual}`}
                                            >
                                                {insumo.quantidade_atual > 1000000 ? "+1M" : insumo.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                                <span className="text-sm font-normal text-muted-foreground mb-1">{insumo.unidade}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Consumo</p>
                                                <p className="text-sm font-bold text-orange-600">
                                                    {Math.max(0, (insumo.quantidade_inicial || 0) - insumo.quantidade_atual).toFixed(1)} {insumo.unidade}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] uppercase text-muted-foreground font-medium">
                                                <span>Progresso de Uso</span>
                                                <span>{insumo.quantidade_inicial > 0 ? Math.min(100, Math.round(((insumo.quantidade_inicial - insumo.quantidade_atual) / insumo.quantidade_inicial) * 100)) : 0}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-orange-500 transition-all duration-500"
                                                    style={{ width: `${insumo.quantidade_inicial > 0 ? Math.min(100, ((insumo.quantidade_inicial - insumo.quantidade_atual) / insumo.quantidade_inicial) * 100) : 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Package className="h-3 w-3" />
                                                Início: {insumo.quantidade_inicial || 0}
                                            </span>
                                            <span>Mín: {insumo.quantidade_minima}</span>
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
                                <Label htmlFor="qtd_ini">Quantidade Inicial</Label>
                                <Input
                                    id="qtd_ini"
                                    type="number"
                                    value={formData.quantidade_inicial}
                                    onChange={e => setFormData({ ...formData, quantidade_inicial: Number(e.target.value) })}
                                    placeholder="Ex: 50"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="qtd">Quantidade Atual</Label>
                                <Input
                                    id="qtd"
                                    type="number"
                                    value={formData.quantidade_atual}
                                    onChange={e => setFormData({ ...formData, quantidade_atual: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="grid gap-2">
                                <Label htmlFor="min">Estoque Mínimo</Label>
                                <Input
                                    id="min"
                                    type="number"
                                    value={formData.quantidade_minima}
                                    onChange={e => setFormData({ ...formData, quantidade_minima: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
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
            {/* Modal Links */}
            <Dialog open={isLinksOpen} onOpenChange={setIsLinksOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-primary" />
                            Vínculos do Insumo: {selectedInsumo?.nome}
                        </DialogTitle>
                        <DialogDescription>
                            Gerencie quais produtos ou tipos utilizam este material e qual o consumo.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="produtos" className="flex-1 flex flex-col overflow-hidden mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="produtos" className="flex items-center gap-2">
                                <Package className="h-4 w-4" /> Produtos
                            </TabsTrigger>
                            <TabsTrigger value="tipos" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" /> Categorias (Tipos)
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto pt-4 pb-2 px-1">
                            <TabsContent value="produtos" className="m-0 space-y-4">
                                <div className="bg-muted/30 p-4 rounded-xl border border-primary/20 shadow-sm">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                                        <Plus className="h-3 w-3 text-primary" />
                                        Vincular novo Produto
                                    </h4>
                                    <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-7">
                                            <Select value={linkTargetId} onValueChange={setLinkTargetId}>
                                                <SelectTrigger className="h-10 bg-background border-primary/10">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allProducts.filter(p => !associatedProducts.some(ap => ap.produto_id === p.id)).map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="relative">
                                                <Input
                                                    className="h-10 pr-7"
                                                    placeholder="0.00"
                                                    value={linkConsumo}
                                                    onChange={e => setLinkConsumo(e.target.value)}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold uppercase">
                                                    {selectedInsumo?.unidade}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <Button
                                                className="w-full h-10 shadow-lg shadow-primary/10"
                                                disabled={!linkTargetId || !linkConsumo}
                                                onClick={() => handleLinkProduct(linkTargetId, Number(linkConsumo.replace(',', '.')))}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Produtos Vinculados</h4>
                                    {linksLoading ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-12 w-full" />
                                            <Skeleton className="h-12 w-full" />
                                        </div>
                                    ) : associatedProducts.length > 0 ? (
                                        associatedProducts.map(link => (
                                            <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border bg-background group">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{link.produtos?.nome}</span>
                                                    <span className="text-xs text-muted-foreground">Consumo: {link.consumo} {selectedInsumo?.unidade}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleUnlinkProduct(link.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 border rounded-lg bg-muted/20 border-dashed">
                                            <p className="text-xs text-muted-foreground">Nenhum produto vinculado ainda.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="tipos" className="m-0 space-y-4">
                                <div className="bg-muted/30 p-4 rounded-xl border border-primary/20 shadow-sm">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                                        <Plus className="h-3 w-3 text-primary" />
                                        Vincular nova Categoria
                                    </h4>
                                    <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-7">
                                            <Select value={linkTargetId} onValueChange={setLinkTargetId}>
                                                <SelectTrigger className="h-10 bg-background border-primary/10">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allTypes.filter(t => !associatedTypes.some(at => at.tipo_producao_id === t.id)).map(t => (
                                                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="relative">
                                                <Input
                                                    className="h-10 pr-7"
                                                    placeholder="0.00"
                                                    value={linkConsumo}
                                                    onChange={e => setLinkConsumo(e.target.value)}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold uppercase">
                                                    {selectedInsumo?.unidade}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <Button
                                                className="w-full h-10 shadow-lg shadow-primary/10"
                                                disabled={!linkTargetId || !linkConsumo}
                                                onClick={() => handleLinkType(linkTargetId, Number(linkConsumo.replace(',', '.')))}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-3 italic bg-primary/5 p-2 rounded border border-primary/10">
                                        💡 Insumos vinculados aqui serão descontados de <b>todos</b> os produtos do tipo selecionado.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Categorias Vinculadas</h4>
                                    {linksLoading ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-12 w-full" />
                                            <Skeleton className="h-12 w-full" />
                                        </div>
                                    ) : associatedTypes.length > 0 ? (
                                        associatedTypes.map(link => (
                                            <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border bg-background group">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{link.tipos_producao?.nome}</span>
                                                    <span className="text-xs text-muted-foreground">Consumo Base: {link.consumo} {selectedInsumo?.unidade}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleUnlinkType(link.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 border rounded-lg bg-muted/20 border-dashed">
                                            <p className="text-xs text-muted-foreground">Nenhum tipo vinculado ainda.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <DialogFooter className="mt-4 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsLinksOpen(false)} className="w-full">
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Insumos;
