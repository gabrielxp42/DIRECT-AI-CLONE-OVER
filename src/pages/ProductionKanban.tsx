import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, ProductionStatus } from '@/types/pedido';
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult
} from '@hello-pangea/dnd';
import { KanbanColumn } from '@/components/KanbanColumn';
import { KanbanCard } from '@/components/KanbanCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Tv, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { deductInsumosFromPedido } from '@/hooks/useDataFetch';

const COLUMNS: { id: ProductionStatus; title: string; color: string }[] = [
    { id: 'design', title: '🎨 Design / Pasta', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { id: 'queued', title: '📥 Fila de Espera', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { id: 'printing', title: '🖨️ Em Impressão', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    { id: 'finishing', title: '✂️ Acabamento', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
    { id: 'ready', title: '✅ Pronto', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
];

export default function ProductionKanban() {
    const { session, profile } = useSession();

    // Matriz de colunas local para re-renders isolados (Performance 60fps)
    const [columns, setColumns] = useState<Record<ProductionStatus, Pedido[]>>({
        design: [],
        queued: [],
        printing: [],
        finishing: [],
        ready: []
    });

    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setEnabled(true);
    }, []);

    const fetchPedidos = React.useCallback(async () => {
        if (!session?.user?.id) return;

        let query = supabase
            .from('pedidos')
            .select('*, clientes(id, nome, telefone, email, endereco, cep), pedido_items(*)')
            .in('status', ['pendente', 'processando'])
            .order('order_number', { ascending: false });

        if (profile?.organization_id) {
            query = query.eq('organization_id', profile.organization_id);
        } else {
            query = query.eq('user_id', session.user.id);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar pedidos para o Kanban:', error);
            toast.error('Erro ao carregar produção');
        } else {
            // Distribui para o dicionário optimizado
            const newCols: Record<ProductionStatus, Pedido[]> = {
                design: [], queued: [], printing: [], finishing: [], ready: []
            };
            (data as Pedido[]).forEach(p => {
                if (newCols[p.production_status]) {
                    newCols[p.production_status].push(p);
                } else {
                    // Fallback
                    newCols.queued.push(p);
                }
            });
            setColumns(newCols);
        }
        setLoading(false);
    }, [session?.user?.id, profile?.organization_id]);

    useEffect(() => {
        fetchPedidos();

        const channel = supabase
            .channel('production_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pedidos',
                },
                async (payload) => {
                    // Se for uma mudança de outro usuário/processo que afete o Kanban
                    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                        const newPedido = payload.new as Pedido;
                        
                        // Verificar se pertence à mesma organização/usuário
                        const isMatch = profile?.organization_id 
                            ? newPedido.organization_id === profile.organization_id
                            : newPedido.user_id === session?.user?.id;

                        if (isMatch) {
                            // Em vez de fetch total, vamos apenas atualizar o estado local se necessário
                            // Para simplificar e garantir consistência com relações (clientes, items), 
                            // ainda faremos um fetch mas apenas se a mudança for externa ou crítica.
                            // Otimização: Só faz fetch se a mudança for de status ou ordem
                            const oldPedido = payload.old as Pedido;
                            if (!oldPedido || oldPedido.production_status !== newPedido.production_status || oldPedido.status !== newPedido.status) {
                                fetchPedidos();
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        fetchPedidos();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id, profile?.organization_id]);

    const onDragEnd = React.useCallback(async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;

        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return;
        }

        const sourceCol = source.droppableId as ProductionStatus;
        const destCol = destination.droppableId as ProductionStatus;
        
        // Atualização optimística imediata para 60fps
        let removed: Pedido | null = null;

        setColumns(prev => {
            const newCols = { ...prev };
            const sourceItems = [...newCols[sourceCol]];
            const [item] = sourceItems.splice(source.index, 1);
            removed = item;

            if (sourceCol === destCol) {
                sourceItems.splice(destination.index, 0, item);
                newCols[sourceCol] = sourceItems;
            } else {
                const destItems = [...newCols[destCol]];
                const updatedItem = { ...item, production_status: destCol };
                if (item.status === 'pendente') {
                    updatedItem.status = 'processando' as any;
                }
                destItems.splice(destination.index, 0, updatedItem);
                newCols[sourceCol] = sourceItems;
                newCols[destCol] = destItems;
            }
            return newCols;
        });

        // Lógica de persistência em background
        if (removed) {
            try {
                const item = removed as Pedido;
                const oldStatus = item.status;
                const updateData: any = { production_status: destCol };
                
                if (sourceCol !== destCol && oldStatus === 'pendente') {
                    updateData.status = 'processando';
                    console.log(`[Kanban] Pedido #${item.order_number} entrou em produção. Deduzindo estoque...`);
                    await deductInsumosFromPedido(item);
                    toast.info(`Pedido #${item.order_number} agora está em produção.`);
                }

                if (sourceCol !== destCol) {
                    const { error } = await supabase
                        .from('pedidos')
                        .update(updateData)
                        .eq('id', draggableId);

                    if (error) throw error;
                }
            } catch (err) {
                console.error('Erro ao atualizar status:', err);
                toast.error('Erro ao salvar alteração. Sincronizando...');
                fetchPedidos(); // Reverte para o estado do banco em caso de erro real
            }
        }
    }, [supabase, fetchPedidos]); // Removido 'columns' para evitar recriações infinitas e adicionado 'fetchPedidos'

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter italic">MODO OPERADOR</h1>
                    <p className="text-muted-foreground">Gerencie o fluxo de produção e estamparia em tempo real.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/producao/tv')} className="gap-2">
                        <Tv className="h-4 w-4" />
                        Modo TV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        Configurar Operador
                    </Button>
                </div>
            </div>

            {enabled && (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full min-h-[70vh]">
                        {COLUMNS.map(column => (
                            <KanbanColumn
                                key={column.id}
                                id={column.id}
                                title={column.title}
                                color={column.color}
                                count={columns[column.id].length}
                            >
                                <div className="flex flex-col gap-3">
                                    {columns[column.id].map((pedido, index) => (
                                        <KanbanCard key={pedido.id} pedido={pedido} index={index} />
                                    ))}
                                </div>
                            </KanbanColumn>
                        ))}
                    </div>
                </DragDropContext>
            )}
        </div>
    );
}

