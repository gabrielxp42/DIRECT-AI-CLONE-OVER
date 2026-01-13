import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Printer, Scissors, Package, Ruler, Info, Wrench } from "lucide-react";
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
import { useTiposProducao, useAddTipoProducao, useUpdateTipoProducao, useDeleteTipoProducao } from "@/hooks/useDataFetch";
import { TipoProducao } from "@/types/producao";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const TipoProducaoManager = () => {
    const { data: tipos, isLoading } = useTiposProducao();
    const addMutation = useAddTipoProducao();
    const updateMutation = useUpdateTipoProducao();
    const deleteMutation = useDeleteTipoProducao();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTipo, setEditingTipo] = useState<Partial<TipoProducao> | null>(null);

    const handleOpenAdd = () => {
        setEditingTipo({
            nome: "",
            unidade_medida: "metro",
            is_active: true,
            order_index: (tipos?.length || 0) + 1,
        });
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (tipo: TipoProducao) => {
        setEditingTipo(tipo);
        setIsDialogOpen(true);
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
        dtf: Printer,
        vinil: Scissors,
        default: Package,
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Tipos de Produção</h2>
                    <p className="text-sm text-muted-foreground">
                        Configure as categorias de produtos e suas unidades de medida.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
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
                    <Button onClick={handleOpenAdd} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Tipo
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
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
                                        <div className={cn(
                                            "p-1.5 rounded-md",
                                            tipo.nome.toLowerCase() === 'dtf' ? "bg-blue-100 text-blue-700" :
                                                tipo.nome.toLowerCase() === 'vinil' ? "bg-orange-100 text-orange-700" :
                                                    "bg-gray-100 text-gray-700"
                                        )}>
                                            {tipo.nome.toLowerCase() === 'dtf' ? <Printer className="h-4 w-4" /> :
                                                tipo.nome.toLowerCase() === 'vinil' ? <Scissors className="h-4 w-4" /> :
                                                    <Package className="h-4 w-4" />}
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
        </div>
    );
};
