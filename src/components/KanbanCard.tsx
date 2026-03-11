import React, { memo, useMemo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Pedido } from '@/types/pedido';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { Ruler, Package, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanCardProps {
    pedido: Pedido;
    index: number;
}

const InnerCardContent = memo(function InnerCardContent({ pedido, isDragging, timeAgo }: { pedido: Pedido, isDragging: boolean, timeAgo: string }) {
    return (
        <Card
            className={cn(
                "select-none border-2",
                isDragging ? "border-primary bg-background rotate-1 scale-105 z-[9999] cursor-grabbing transform-gpu" : "border-transparent border-b-border hover:border-primary/30 cursor-grab transition-transform"
            )}
            style={{ boxShadow: 'none' }}
        >
            <CardContent className={cn("p-4 flex flex-col gap-3 h-full")}>
                <div className="flex justify-between items-start">
                    <span className="text-sm font-black text-primary">#{pedido.order_number}</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                        <Clock className="h-3 w-3" />
                        {timeAgo}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold truncate">{pedido.clientes?.nome || 'Cliente não identificado'}</span>
                </div>

                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20">
                    <Ruler className="h-5 w-5" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase leading-none">Total Metros</span>
                        <span className="text-lg font-black italic">{pedido.total_metros?.toFixed(2) || '0.00'}m</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-black">
                        <Package className="h-3 w-3" />
                        Itens para Produção
                    </div>
                    <div className="space-y-1">
                        {pedido.pedido_items?.map((item) => (
                            <div key={item.id || `${pedido.id}-${item.produto_id}`} className="bg-muted p-2 rounded text-xs flex justify-between items-center group">
                                <div className="flex flex-col">
                                    <span className="font-bold line-clamp-1">{item.produto_nome}</span>
                                    {item.observacao && <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{item.observacao}</span>}
                                </div>
                                <span className="bg-background px-2 py-0.5 rounded font-black border">{item.quantidade}x</span>
                            </div>
                        ))}
                        {pedido.servicos?.map((serv) => (
                            <div key={serv.id || `s-${pedido.id}-${serv.nome}`} className="bg-muted p-2 rounded text-xs flex justify-between items-center">
                                <span className="font-bold">{serv.nome}</span>
                                <span className="bg-background px-2 py-0.5 rounded font-black border">{serv.quantidade}x</span>
                            </div>
                        ))}
                    </div>
                </div>

                {pedido.observacoes && (
                    <div className="text-[10px] bg-amber-500/5 text-amber-700 p-2 rounded border border-amber-500/20 italic">
                        "{pedido.observacoes}"
                    </div>
                )}
            </CardContent>
        </Card>
    );
});


export const KanbanCard = memo(function KanbanCard({ pedido, index }: KanbanCardProps) {
    const timeAgo = useMemo(() => {
        try {
            return formatDistanceToNow(new Date(pedido.created_at), { addSuffix: true, locale: ptBR });
        } catch {
            return 'recentemente';
        }
    }, [pedido.created_at]);

    return (
        <Draggable draggableId={pedido.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                        ...provided.draggableProps.style,
                        // Fix for Windows touch drag delay / lag
                        touchAction: 'none',
                        // Force hardware acceleration profile on iGPUs when dragging
                        willChange: snapshot.isDragging ? 'transform' : 'auto',
                        transform: snapshot.isDragging ? provided.draggableProps.style?.transform + ' translateZ(0)' : provided.draggableProps.style?.transform
                    }}
                >
                    <InnerCardContent pedido={pedido} isDragging={snapshot.isDragging} timeAgo={timeAgo} />
                </div>
            )}
        </Draggable>
    );
});
