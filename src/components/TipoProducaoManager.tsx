import { useState } from "react";
import { Plus, Pencil, Trash2, Printer, Scissors, Package, Ruler, Info, Wrench, Zap, Tag, Layers, PenTool, BadgeCheck, Palette, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTiposProducao, useAddTipoProducao, useUpdateTipoProducao, useDeleteTipoProducao, useInsumos, useAddTipoProducaoInsumo, useDeleteTipoProducaoInsumo } from "@/hooks/useDataFetch";
import { TipoProducao, TipoProducaoInsumo } from "@/types/producao";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { Loader2, ScrollText } from "lucide-react";

export const TipoProducaoManager = () => {
    const { data: tipos, isLoading } = useTiposProducao();
    const { data: insumos } = useInsumos();
    const addMutation = useAddTipoProducao();
    const updateMutation = useUpdateTipoProducao();
    const deleteMutation = useDeleteTipoProducao();
    const addLinkMutation = useAddTipoProducaoInsumo();
    const deleteLinkMutation = useDeleteTipoProducaoInsumo();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTipo, setEditingTipo] = useState<Partial<TipoProducao> | null>(null);
    const [selectedInsumoId, setSelectedInsumoId] = useState("");
    const [consumoValue, setConsumoValue] = useState("");

    const handleOpenAdd = () => {
        setEditingTipo({
            nome: "",
            unidade_medida: "metro",
            is_active: true,
            order_index: (tipos?.length || 0) + 1,
            icon: "Package",
            color: "bg-gray-100 text-gray-700",
        });
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (tipo: TipoProducao) => {
        setEditingTipo(tipo);
        setIsDialogOpen(true);
        setSelectedInsumoId("");
        setConsumoValue("");
    };

    const handleAddLink = async () => {
        if (!editingTipo?.id || !selectedInsumoId || !consumoValue) {
            showError("Selecione um insumo e informe o consumo");
            return;
        }

        try {
            await addLinkMutation.mutateAsync({
                tipo_producao_id: editingTipo.id,
                insumo_id: selectedInsumoId,
                consumo: Number(consumoValue.replace(',', '.')),
            });
            setSelectedInsumoId("");
            setConsumoValue("");
            showSuccess("Insumo vinculado com sucesso");
        } catch (error: any) {
            showError("Erro ao vincular: " + error.message);
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        if (confirm("Deseja remover este vínculo?")) {
            try {
                await deleteLinkMutation.mutateAsync(linkId);
                showSuccess("Vínculo removido");
            } catch (error: any) {
                showError("Erro ao remover: " + error.message);
            }
        }
    };

    const handleSave = async () => {
        if (!editingTipo?.nome) {
            showError("O nome é obrigatório");
            return;
        }

        try {
            if (editingTipo.id) {
                await updateMutation.mutateAsync({
                    id: editingTipo.id,
                    nome: editingTipo.nome,
                    unidade_medida: editingTipo.unidade_medida,
                    is_active: editingTipo.is_active,
                    order_index: editingTipo.order_index,
                    icon: editingTipo.icon,
                    color: editingTipo.color,
                });
                showSuccess("Tipo de produção atualizado");
            } else {
                await addMutation.mutateAsync(editingTipo as Omit<TipoProducao, "id" | "user_id" | "created_at">);
                showSuccess("Tipo de produção criado");
            }
            setIsDialogOpen(false);
        } catch (error: any) {
            showError("Erro ao salvar: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Deseja realmente excluir este tipo? Isso pode afetar pedidos existentes.")) {
            try {
                await deleteMutation.mutateAsync(id);
                showSuccess("Tipo excluído com sucesso");
            } catch (error: any) {
                showError("Erro ao excluir: " + error.message);
            }
        }
    };

    const icons: Record<string, any> = {
        Printer,
        Scissors,
        Package,
        Ruler,
        Info,
        Wrench,
        Zap,
        Tag,
        Layers,
        PenTool,
        BadgeCheck,
        Palette
    };

    const colors = [
        { label: "Laranja", value: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
        { label: "Azul", value: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
        { label: "Verde", value: "text-green-500 bg-green-500/10 border-green-500/30" },
        { label: "Roxo", value: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
        { label: "Vermelho", value: "text-red-500 bg-red-500/10 border-red-500/30" },
        { label: "Rosa", value: "text-pink-500 bg-pink-500/10 border-pink-500/30" },
        { label: "Amarelo", value: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
        { label: "Teal", value: "text-teal-500 bg-teal-500/10 border-teal-500/30" },
        { label: "Indigo", value: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30" },
        { label: "Cinza", value: "text-gray-400 bg-gray-500/10 border-gray-500/30" },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1" id="tipos-heading">
                    <h2 className="text-xl font-semibold tracking-tight">Tipos de Produtos</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-[300px] sm:max-w-none">
                        Configure as categorias de produtos e suas unidades de medida.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={async () => {
                            if (!tipos) return;
                            const seen = new Map<string, string>(); // nome -> id (mantido)
                            const toDelete: string[] = [];

                            tipos.forEach(t => {
                                const nomeLow = t.nome.trim().toLowerCase();
                                if (seen.has(nomeLow)) {
                                    toDelete.push(t.id);
                                } else {
                                    seen.set(nomeLow, t.id);
                                }
                            });

                            if (toDelete.length === 0) {
                                showSuccess("Nenhuma duplicata encontrada.");
                                return;
                            }

                            if (confirm(`Encontradas ${toDelete.length} duplicatas. Deseja removê-las? (Os dados dos pedidos não serão afetados)`)) {
                                let successCount = 0;
                                for (const id of toDelete) {
                                    try {
                                        await deleteMutation.mutateAsync(id);
                                        successCount++;
                                    } catch (e) {
                                        console.error("Erro ao deletar duplicata", id, e);
                                    }
                                }
                                showSuccess(`${successCount} duplicatas removidas com sucesso!`);
                            }
                        }}
                    >
                        <Wrench className="mr-2 h-4 w-4" />
                        Corrigir Duplicados
                    </Button>
                    <Button id="btn-novo-tipo" onClick={handleOpenAdd} size="sm" className="flex-1 sm:flex-initial">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Tipo
                    </Button>
                </div>
            </div>

            <div id="tipos-table" className="rounded-md border hidden sm:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tipos?.map((tipo) => (
                            <TableRow key={tipo.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("p-1.5 rounded-md", tipo.color || "bg-gray-100 text-gray-700")}>
                                            {(() => {
                                                const IconComp = icons[tipo.icon || 'Package'] || Package;
                                                return <IconComp className="h-4 w-4" />;
                                            })()}
                                        </div>
                                        {tipo.nome}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="capitalize">{tipo.unidade_medida === 'metro' ? 'Metro (ML)' : 'Unidade (UND)'}</span>
                                </TableCell>
                                <TableCell>
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                        tipo.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                    )}>
                                        {tipo.is_active ? "Ativo" : "Inativo"}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(tipo)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(tipo.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards View */}
            <div id="tipos-cards" className="space-y-4 block sm:hidden">
                {tipos?.map((tipo) => (
                    <Card key={tipo.id} className="touch-manipulation">
                        <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", tipo.color || "bg-gray-100 text-gray-700")}>
                                    {(() => {
                                        const IconComp = icons[tipo.icon || 'Package'] || Package;
                                        return <IconComp className="h-5 w-5" />;
                                    })()}
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold">{tipo.nome}</CardTitle>
                                    <CardDescription className="text-xs">
                                        {tipo.unidade_medida === 'metro' ? 'Metro Linear (ML)' : 'Unidade (UND)'}
                                    </CardDescription>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Abrir menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenEdit(tipo)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(tipo.id)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                    tipo.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                )}>
                                    {tipo.is_active ? "Ativo" : "Inativo"}
                                </span>
                                {tipo.icon && (
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                        Ícone: {tipo.icon}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTipo?.id ? "Editar Tipo" : "Novo Tipo de Produção"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nome">Nome da Categoria</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: DTF UV, Silk, Bordado"
                                value={editingTipo?.nome || ""}
                                onChange={(e) => setEditingTipo({ ...editingTipo, nome: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="icon">Ícone</Label>
                                <Select
                                    value={editingTipo?.icon || "Package"}
                                    onValueChange={(val) => setEditingTipo({ ...editingTipo, icon: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(icons).map((iconName) => {
                                            const IconComp = icons[iconName];
                                            return (
                                                <SelectItem key={iconName} value={iconName}>
                                                    <div className="flex items-center gap-2 max-w-[120px]">
                                                        <IconComp className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{iconName}</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="color">Cor</Label>
                                <Select
                                    value={editingTipo?.color || "bg-gray-100 text-gray-700"}
                                    onValueChange={(val) => setEditingTipo({ ...editingTipo, color: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colors.map((color) => (
                                            <SelectItem key={color.value} value={color.value}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-3 w-3 rounded-full", color.value.split(" ")[0].replace("bg-", "bg-"))} style={{ backgroundColor: "currentColor" }} />
                                                    {/* Hack to show color preview properly is tricky with just classes, let's just use the badge style */}
                                                    <span className={cn("px-2 py-0.5 rounded text-xs", color.value)}>{color.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="unidade">Unidade de Medida Padrão</Label>
                            <Select
                                value={editingTipo?.unidade_medida}
                                onValueChange={(val: any) => setEditingTipo({ ...editingTipo, unidade_medida: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="metro">Metro Linear (ML)</SelectItem>
                                    <SelectItem value="unidade">Unidade (UND)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="active"
                                checked={editingTipo?.is_active}
                                onCheckedChange={(checked) => setEditingTipo({ ...editingTipo, is_active: checked })}
                            />
                            <Label htmlFor="active">Categoria Ativa</Label>
                        </div>

                        {editingTipo?.id && (
                            <div className="space-y-4 border rounded-xl p-5 bg-muted/20 border-primary/10 shadow-inner mt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold flex items-center gap-2">
                                            <ScrollText className="h-4 w-4 text-primary" />
                                            Insumos Globais (Base de Cálculo)
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground">Estes itens serão descontados de todos os produtos desta categoria.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-2 bg-background/50 p-3 rounded-lg border border-dashed border-primary/20">
                                    <div className="col-span-6">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Escolher Insumo</Label>
                                        <Select value={selectedInsumoId} onValueChange={setSelectedInsumoId}>
                                            <SelectTrigger className="h-9 bg-background">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {insumos?.filter(i => !editingTipo.tipo_producao_insumos?.some(link => link.insumo_id === i.id)).map(i => (
                                                    <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-4">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Consumo base</Label>
                                        <div className="relative">
                                            <Input
                                                className="h-9 pr-8"
                                                placeholder="0.00"
                                                value={consumoValue}
                                                onChange={e => setConsumoValue(e.target.value)}
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold">
                                                {insumos?.find(i => i.id === selectedInsumoId)?.unidade || ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-end">
                                        <Button
                                            type="button"
                                            className="w-full h-9 shadow-md shadow-primary/5"
                                            onClick={handleAddLink}
                                            disabled={addLinkMutation.isPending || !selectedInsumoId || !consumoValue}
                                        >
                                            {addLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {!editingTipo.tipo_producao_insumos || editingTipo.tipo_producao_insumos.length === 0 ? (
                                        <div className="text-center py-4 border rounded-lg bg-background/30 border-dashed">
                                            <p className="text-xs text-muted-foreground">Nenhum insumo global configurado.</p>
                                        </div>
                                    ) : (
                                        editingTipo.tipo_producao_insumos.map(link => (
                                            <div key={link.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-background group animate-in fade-in slide-in-from-top-1">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{link.insumos?.nome}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                        Consumo: <span className="text-primary">{link.consumo} {link.insumos?.unidade}</span>
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteLink(link.id)}
                                                    disabled={deleteLinkMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending}>
                            {addMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
};
