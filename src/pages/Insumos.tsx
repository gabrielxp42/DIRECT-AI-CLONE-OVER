import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, AlertTriangle, Search } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';

interface Insumo {
    id: string;
    nome: string;
    quantidade_atual: number;
    unidade: string;
    quantidade_minima: number;
    custo_unitario: number;
}

const Insumos = () => {
    const { session } = useSession();
    const location = useLocation();
    const navigate = useNavigate();
    const accessToken = session?.access_token;
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        nome: '',
        quantidade_atual: '',
        unidade: 'un',
        quantidade_minima: '10',
        custo_unitario: '0'
    });

    // Abrir modal se vier do Dashboard
    useEffect(() => {
        if (location.state?.openForm) {
            setIsDialogOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    const fetchInsumos = async () => {
        if (!accessToken) return;
        try {
            setLoading(true);
            const headers = {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/insumos?select=*&order=nome.asc`, { headers });
            if (!response.ok) throw new Error('Erro ao buscar insumos');

            const data = await response.json();
            setInsumos(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível carregar os insumos.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsumos();
    }, [accessToken]);

    const handleSave = async () => {
        if (!accessToken) return;
        try {
            const headers = {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            const payload = {
                nome: formData.nome,
                quantidade_atual: parseFloat(formData.quantidade_atual) || 0,
                unidade: formData.unidade,
                quantidade_minima: parseFloat(formData.quantidade_minima) || 0,
                custo_unitario: parseFloat(formData.custo_unitario) || 0
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/insumos`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Erro ao salvar');

            toast({ title: "Sucesso", description: "Insumo adicionado com sucesso!" });
            setIsDialogOpen(false);
            setFormData({ nome: '', quantidade_atual: '', unidade: 'un', quantidade_minima: '10', custo_unitario: '0' });
            fetchInsumos();
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao salvar insumo.", variant: "destructive" });
        }
    };

    const filteredInsumos = insumos.filter(i =>
        i.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Novo Insumo
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Insumo</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="nome">Nome do Material</Label>
                                <Input id="nome" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Tinta DTF Branca" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="qtd">Quantidade Atual</Label>
                                    <Input id="qtd" type="number" value={formData.quantidade_atual} onChange={e => setFormData({ ...formData, quantidade_atual: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="unidade">Unidade</Label>
                                    <Input id="unidade" value={formData.unidade} onChange={e => setFormData({ ...formData, unidade: e.target.value })} placeholder="l, kg, m, un" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="min">Estoque Mínimo</Label>
                                    <Input id="min" type="number" value={formData.quantidade_minima} onChange={e => setFormData({ ...formData, quantidade_minima: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="custo">Custo Unitário (R$)</Label>
                                    <Input id="custo" type="number" value={formData.custo_unitario} onChange={e => setFormData({ ...formData, custo_unitario: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSave}>Salvar Insumo</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2 bg-background/95 p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Buscar insumos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 focus-visible:ring-0"
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
                        <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="mt-4">
                            Adicionar Primeiro Insumo
                        </Button>
                    ) : undefined}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredInsumos.map(insumo => {
                        const isLowStock = insumo.quantidade_atual <= insumo.quantidade_minima;
                        return (
                            <Card key={insumo.id} className={`hover:shadow-md transition-shadow ${isLowStock ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-semibold truncate" title={insumo.nome}>
                                            {insumo.nome}
                                        </CardTitle>
                                        {isLowStock && (
                                            <Badge variant="destructive" className="flex gap-1 items-center text-[10px] px-1.5">
                                                <AlertTriangle className="h-3 w-3" /> Baixo
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        <div className="text-3xl font-bold text-primary">
                                            {insumo.quantidade_atual} <span className="text-sm font-normal text-muted-foreground">{insumo.unidade}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Mínimo: {insumo.quantidade_minima} {insumo.unidade}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Custo: R$ {insumo.custo_unitario.toFixed(2)} / {insumo.unidade}
                                        </p>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <Button variant="outline" size="sm" className="w-full h-8 text-xs">Ajustar</Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Plus className="h-4 w-4" /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Insumos;
