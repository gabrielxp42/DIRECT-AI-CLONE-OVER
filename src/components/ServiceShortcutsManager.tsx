import { useState } from "react";
import { useServiceShortcuts, useAddServiceShortcut, useUpdateServiceShortcut, useDeleteServiceShortcut } from "@/hooks/useDataFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pin, PinOff, Trash2, Plus, Loader2, DollarSign, Zap, Star } from "lucide-react";
import { CurrencyInput } from "./CurrencyInput";
import { showSuccess, showError } from "@/utils/toast";

export const ServiceShortcutsManager = () => {
    const { data: shortcuts, isLoading } = useServiceShortcuts();
    const addShortcut = useAddServiceShortcut();
    const updateShortcut = useUpdateServiceShortcut();
    const deleteShortcut = useDeleteServiceShortcut();

    const [newName, setNewName] = useState("");
    const [newValue, setNewValue] = useState(0);

    const handleAdd = async () => {
        if (!newName) return;
        try {
            await addShortcut.mutateAsync({ nome: newName, valor: newValue, is_pinned: false });
            setNewName("");
            setNewValue(0);
            showSuccess("Atalho adicionado com sucesso!");
        } catch (e) {
            showError("Erro ao adicionar atalho.");
        }
    };

    const togglePin = async (id: string, currentPin: boolean) => {
        await updateShortcut.mutateAsync({ id, is_pinned: !currentPin });
        showSuccess(currentPin ? "Atalho desfixado" : "Atalho fixado!");
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Excluir o atalho "${name}"?`)) {
            await deleteShortcut.mutateAsync(id);
            showSuccess("Atalho removido.");
        }
    };

    const handleUpdatePrice = async (id: string, value: number) => {
        await updateShortcut.mutateAsync({ id, valor: value });
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    const pinned = shortcuts?.filter(s => s.is_pinned) || [];
    const suggested = shortcuts?.filter(s => !s.is_pinned) || [];

    return (
        <div className="space-y-6">
            <Card id="card-novo-atalho">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Novo Atalho de Serviço
                    </CardTitle>
                    <CardDescription>Crie atalhos manuais para serviços frequentes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium">Nome do Serviço</label>
                            <Input
                                placeholder="Ex: Entrega Expressa"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-40 space-y-2">
                            <label className="text-sm font-medium">Valor Padrão</label>
                            <CurrencyInput
                                value={newValue}
                                onChange={setNewValue}
                            />
                        </div>
                        <Button onClick={handleAdd} disabled={!newName || addShortcut.isPending} className="w-full sm:w-auto">
                            {addShortcut.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Adicionar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                <Card id="card-atalhos-fixados">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Star className="h-5 w-5 text-primary fill-primary" />
                            Atalhos Fixados
                        </CardTitle>
                        <CardDescription>Estes aparecem primeiro no modal de pedidos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pinned.length === 0 ? (
                            <p className="text-center py-4 text-muted-foreground">Nenhum atalho fixado ainda.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Serviço</TableHead>
                                        <TableHead className="w-32">Preço Sugerido</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pinned.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">{s.nome}</TableCell>
                                            <TableCell>
                                                <CurrencyInput
                                                    value={s.valor}
                                                    onChange={(v) => handleUpdatePrice(s.id, v)}
                                                    className="h-8 text-xs"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => togglePin(s.id, s.is_pinned)} title="Desfixar">
                                                        <PinOff className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(s.id, s.nome)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {suggested.length > 0 && (
                    <Card id="card-sugestoes-automaticas">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-500" />
                                Sugestões Automáticas
                            </CardTitle>
                            <CardDescription>Serviços que você usou recentemente. Fixe-os para mantê-los visíveis.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {suggested.map((s) => (
                                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{s.nome}</span>
                                            <span className="text-[10px] text-muted-foreground">{s.usage_count} usos</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(s.id, s.is_pinned)} title="Fixar">
                                            <Pin className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id, s.nome)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
