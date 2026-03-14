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
import { PedidoDetails } from '@/components/PedidoDetails';
import { useClientes, useProdutos } from '@/hooks/useDataFetch';
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { printThermalReceipt } from '@/utils/thermalPrinter';
import { getCompanyInfoForPDF, useCompanyProfile } from '@/hooks/useCompanyProfile';
import { generateOrderSummary } from '@/utils/orderSummary';
import { useIsPlusMode } from '@/hooks/useIsPlusMode';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { WhatsAppActionDialog } from '@/components/WhatsAppActionDialog';
import { OperatorChatModal } from '@/components/OperatorChatModal';
import { generateOrderPDFBase64 } from '@/utils/pdfGenerator';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

const COLUMNS: { id: ProductionStatus; title: string; color: string }[] = [
    { id: 'design', title: '🎨 Design / Pasta', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { id: 'queued', title: '📥 Fila de Espera', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { id: 'printing', title: '🖨️ Em Impressão', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    { id: 'finishing', title: '✂️ Acabamento', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
    { id: 'ready', title: '✅ Pronto', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
];

export default function ProductionKanban() {
    const { session, profile, activeSubProfile, hasPermission } = useSession();

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
    const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const navigate = useNavigate();
    const { data: clientes = [] } = useClientes();
    const { data: produtos = [] } = useProdutos();
    const { companyProfile } = useCompanyProfile();
    const plusModeInfo = useIsPlusMode();
    const isPlusMode = plusModeInfo.canSendDirectly;
    const { addTask, updateTask, updateStep } = useBackgroundTasks();

    const [whatsAppDialog, setWhatsAppDialog] = useState<{
        open: boolean;
        loading: boolean;
        pedido: Pedido | null;
        summary: string;
        error?: string | null;
    }>({
        open: false,
        pedido: null,
        summary: '',
        error: null,
        loading: false
    });

    // Chat Modal State
    const [chatModal, setChatModal] = useState<{
        open: boolean;
        pedido: Pedido | null;
    }>({ open: false, pedido: null });

    // Unread messages tracking: phone -> count
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        setEnabled(true);
    }, []);

    const fetchPedidos = React.useCallback(async () => {
        if (!session?.user?.id) return;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let query = supabase
            .from('pedidos')
            .select('*, clientes(id, nome, telefone, email, endereco, cep), pedido_items(*), servicos:pedido_servicos(*)')
            .in('status', ['pago', 'processando', 'aguardando retirada'])
            .gte('created_at', thirtyDaysAgo.toISOString())
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

    // Realtime subscription for incoming WhatsApp messages (unread alerts)
    useEffect(() => {
        if (!session?.user?.id) return;

        const msgChannel = supabase
            .channel('kanban_unread_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages',
                filter: `user_id=eq.${session.user.id}`,
            }, (payload) => {
                const msg = payload.new as any;
                // Only count received messages (from clients)
                if (msg.direction === 'received' && msg.phone) {
                    const phoneEnd = msg.phone.replace(/\D/g, '').slice(-8);
                    // Don't count if the chat modal is open for this phone
                    const chatPhone = chatModal.pedido?.clientes?.telefone?.replace(/\D/g, '').slice(-8);
                    if (chatModal.open && chatPhone && phoneEnd === chatPhone) return;

                    setUnreadCounts(prev => ({
                        ...prev,
                        [phoneEnd]: (prev[phoneEnd] || 0) + 1
                    }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
        };
    }, [session?.user?.id, chatModal.open, chatModal.pedido]);

    const onDragEnd = React.useCallback(async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;

        if (!hasPermission('edit_kanban')) {
            toast.error('Você não tem permissão para mover pedidos na produção.');
            return;
        }

        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return;
        }

        const sourceCol = source.droppableId as ProductionStatus;
        const destCol = destination.droppableId as ProductionStatus;

        // Função interna para notificar operadores
        const notifyOperators = async (pedido: Pedido) => {
            try {
                // 1. Buscar números dos operadores
                const { data: operators, error: opError } = await supabase
                    .from('sub_profiles')
                    .select('whatsapp_number, name')
                    .eq('organization_id', profile?.organization_id)
                    .eq('role', 'operador')
                    .eq('is_active', true);

                if (opError || !operators || operators.length === 0) {
                    console.log("[Gabi] Nenhum operador encontrado para notificar.");
                    return;
                }

                // 2. Enviar mensagem para cada um
                const message = `🚀 *NOVO ARQUIVO PARA IMPRESSÃO*\n\nO designer *${activeSubProfile?.name || "da equipe"}* acabou de liberar um pedido para você!\n\n📦 *Pedido:* #${pedido.order_number}\n👤 *Cliente:* ${pedido.clientes?.nome || "Não informado"}\n🛠️ *Status:* ${destCol.toUpperCase()}\n\nFavor verificar a fila de produção no Direct AI.`;

                for (const op of operators) {
                    if (op.whatsapp_number) {
                        console.log(`[Gabi] Notificando operador ${op.name} (${op.whatsapp_number})...`);
                        await supabase.functions.invoke('whatsapp-proxy', {
                            body: {
                                action: 'send-text',
                                phone: op.whatsapp_number,
                                message: message
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("[Gabi] Erro ao notificar operadores:", err);
            }
        };

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

                    // Gatilho Gabi: Notificar operadores se saiu do design para fila/impressão
                    if (sourceCol === 'design' && (destCol === 'queued' || destCol === 'printing')) {
                        notifyOperators(item);
                    }
                }
            } catch (err) {
                console.error('Erro ao atualizar status:', err);
                toast.error('Erro ao salvar alteração. Sincronizando...');
                fetchPedidos(); // Reverte para o estado do banco em caso de erro real
            }
        }
    }, [supabase, fetchPedidos, hasPermission, profile?.organization_id, activeSubProfile?.name, session?.user?.id]); // Removido 'columns' para evitar recriações infinitas e adicionado 'fetchPedidos'

    const handleMovePedido = async (pedido: Pedido, newProductionStatus: ProductionStatus) => {
        if (!hasPermission('edit_kanban')) {
            toast.error('Sem permissão para mover pedidos.');
            return;
        }

        const oldStatus = pedido.production_status;
        if (oldStatus === newProductionStatus) return;

        // Atualização optimística
        setColumns(prev => {
            const newCols = { ...prev };
            newCols[oldStatus] = newCols[oldStatus]?.filter(p => p.id !== pedido.id) || [];
            newCols[newProductionStatus] = [{ ...pedido, production_status: newProductionStatus }, ...(newCols[newProductionStatus] || [])];
            return newCols;
        });

        try {
            const updateData: any = { production_status: newProductionStatus };
            if (pedido.status === 'pendente') {
                updateData.status = 'processando';
                await deductInsumosFromPedido(pedido);
            }

            const { error } = await supabase
                .from('pedidos')
                .update(updateData)
                .eq('id', pedido.id);

            if (error) throw error;
            toast.success(`Pedido #${pedido.order_number} movido para ${newProductionStatus}`);
        } catch (err) {
            console.error('Erro ao mover pedido:', err);
            toast.error('Erro ao mover pedido.');
            fetchPedidos();
        }
    };

    const handleArchivePedido = async (pedido: Pedido) => {
        try {
            const { error } = await supabase
                .from('pedidos')
                .update({ status: 'entregue' })
                .eq('id', pedido.id);

            if (error) throw error;
            
            setColumns(prev => {
                const newCols = { ...prev };
                newCols[pedido.production_status] = newCols[pedido.production_status]?.filter(p => p.id !== pedido.id) || [];
                return newCols;
            });

            toast.success(`Pedido #${pedido.order_number} arquivado.`);
        } catch (err) {
            console.error('Erro ao arquivar:', err);
            toast.error('Erro ao arquivar pedido.');
        }
    };

    const handlePrintA4 = async (pedido: Pedido) => {
        try {
            const companyInfo = getCompanyInfoForPDF(companyProfile);
            await generateOrderPDF(pedido, 'print', [], companyInfo);
        } catch (err) {
            toast.error('Erro ao gerar impressão A4');
        }
    };

    const handlePrintThermal = (pedido: Pedido) => {
        try {
            printThermalReceipt(pedido);
        } catch (err) {
            toast.error('Erro na impressão térmica');
        }
    };

    const handleWhatsApp = (pedido: Pedido) => {
        const summary = generateOrderSummary(
            pedido,
            companyProfile?.gabi_templates?.['resumo-padrao'],
            companyProfile?.company_pix_key
        );
        const phone = pedido.clientes?.telefone?.replace(/\D/g, '');
        const { isWhatsAppReady } = plusModeInfo;

        if (isWhatsAppReady) {
            setWhatsAppDialog({ open: true, loading: false, pedido, summary, error: null });
        } else {
            if (phone) {
                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(summary)}`, '_blank');
            } else {
                toast.error('Cliente sem telefone cadastrado.');
            }
        }
    };

    const handleConfirmWhatsAppSend = async (data: { phone?: string; attachPdf?: boolean; includeText?: boolean; includePix?: boolean } = {}) => {
        if (!whatsAppDialog.pedido) return;

        const pedido = whatsAppDialog.pedido;
        const summary = whatsAppDialog.summary;
        const phone = (data.phone || pedido.clientes?.telefone || '').replace(/\D/g, '');
        const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

        setWhatsAppDialog(prev => ({ ...prev, open: false }));

        const steps = [];
        if (data.attachPdf) {
            steps.push({ id: 'pdf-gen', label: 'Gerar PDF', status: 'pending' as const });
            steps.push({ id: 'pdf-send', label: 'Enviar PDF', status: 'pending' as const });
        }
        if (data.includeText) {
            steps.push({ id: 'text-send', label: 'Enviar Resumo', status: 'pending' as const });
        }

        const taskId = addTask({
            title: `Pedido #${pedido.order_number}`,
            description: `Enviando para ${pedido.clientes?.nome || 'Cliente'}`,
            status: 'processing',
            progress: 0,
            steps
        });

        const processEnvio = async () => {
            try {
                if (data.attachPdf) {
                    updateTask(taskId, { progress: 10 });
                    updateStep(taskId, 'pdf-gen', 'loading');

                    const companyInfo = getCompanyInfoForPDF(companyProfile);
                    const pdfBase64 = await generateOrderPDFBase64(pedido, [], companyInfo);
                    const fileName = `pedido_${pedido.id}_${Date.now()}.pdf`;

                    updateStep(taskId, 'pdf-gen', 'completed');
                    updateStep(taskId, 'pdf-send', 'loading');
                    updateTask(taskId, { progress: 40 });

                    const binaryString = window.atob(pdfBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    const { error: uploadError } = await supabase.storage.from('order-pdfs').upload(fileName, bytes, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                    let fileUrlToUse = '';
                    if (!uploadError) {
                        const { data: signedData } = await supabase.storage.from('order-pdfs').createSignedUrl(fileName, 3600);
                        if (signedData?.signedUrl) fileUrlToUse = signedData.signedUrl;
                    }

                    const sessionResp = await supabase.auth.getSession();
                    const textSession = sessionResp.data.session;

                    const pdfResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-proxy`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${textSession?.access_token}`,
                            'apikey': SUPABASE_ANON_KEY
                        },
                        body: JSON.stringify({
                            action: 'send-media',
                            phone: formattedPhone,
                            mediaUrl: fileUrlToUse,
                            mediaBase64: pdfBase64,
                            mediaName: `Pedido_${pedido.order_number}.pdf`,
                            mediaType: 'document',
                            message: ''
                        })
                    });

                    const pdfResult = await pdfResp.json();
                    if (!pdfResp.ok || pdfResult?.error) {
                        throw new Error(pdfResult?.message || 'Falha ao enviar PDF');
                    }

                    updateStep(taskId, 'pdf-send', 'completed');
                    updateTask(taskId, { progress: 70 });

                    supabase.storage.from('order-pdfs').remove([fileName]).catch(err => {
                        console.warn("[Storage] Erro ao limpar arquivo temporário:", err);
                    });
                }

                if (data.includeText) {
                    updateStep(taskId, 'text-send', 'loading');
                    if (data.attachPdf) await new Promise(r => setTimeout(r, 1000));

                    const sessionResp = await supabase.auth.getSession();
                    const textSession = sessionResp.data.session;

                    const textResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-proxy`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${textSession?.access_token}`,
                            'apikey': SUPABASE_ANON_KEY
                        },
                        body: JSON.stringify({
                            action: 'send-text',
                            phone: formattedPhone,
                            message: (data.includePix && companyProfile?.company_pix_key)
                                ? `${summary.trim()}\n\n💰 *DADOS PARA PAGAMENTO*\nChave Pix: ${companyProfile.company_pix_key}`
                                : summary.trim()
                        })
                    });

                    const textResult = await textResp.json();
                    if (!textResp.ok || textResult?.error) {
                        throw new Error(textResult?.message || 'Erro ao enviar texto');
                    }

                    updateStep(taskId, 'text-send', 'completed');
                }

                updateTask(taskId, { status: 'completed', progress: 100 });
                toast.success(`Pedido #${pedido.order_number} enviado com sucesso!`);

            } catch (err: any) {
                console.error('Erro no envio em background:', err);
                updateTask(taskId, {
                    status: 'error',
                    error: err.message || 'Erro desconhecido',
                    progress: 100
                });
                toast.error(`Falha ao enviar Pedido #${pedido.order_number}`);
            }
        };

        processEnvio();
    };

    if (!hasPermission('view_kanban')) {
        return (
            <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
                <div className="p-4 rounded-full bg-red-500/10 text-red-500">
                    <SettingsIcon className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Acesso Negado</h2>
                <p className="text-muted-foreground text-center max-w-md">Você não tem permissão para visualizar o fluxo de produção. Solicite acesso ao Chefe.</p>
            </div>
        );
    }

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
                        {COLUMNS.map(column => {
                            const allItems = columns[column.id] || [];
                            const displayedItems = allItems.slice(0, 30);
                            
                            return (
                                <KanbanColumn
                                    key={column.id}
                                    id={column.id}
                                    title={column.title}
                                    color={column.color}
                                    count={allItems.length}
                                >
                                    <div className="flex flex-col gap-3">
                                        {displayedItems.map((pedido, index) => (
                                            <KanbanCard 
                                                key={pedido.id} 
                                                pedido={pedido} 
                                                index={index} 
                                                onViewDetails={() => {
                                                    setSelectedPedidoId(pedido.id);
                                                    setIsDetailsOpen(true);
                                                }}
                                                onMoveTo={(status) => handleMovePedido(pedido, status)}
                                                onArchive={() => handleArchivePedido(pedido)}
                                                onPrintA4={() => handlePrintA4(pedido)}
                                                onPrintThermal={() => handlePrintThermal(pedido)}
                                                onWhatsApp={() => handleWhatsApp(pedido)}
                                                onChat={() => setChatModal({ open: true, pedido })}
                                                unreadCount={(() => {
                                                    const phone = pedido.clientes?.telefone?.replace(/\D/g, '').slice(-8);
                                                    return phone ? (unreadCounts[phone] || 0) : 0;
                                                })()}
                                            />
                                        ))}
                                        {allItems.length > 30 && (
                                            <div className="text-center p-4 bg-muted/40 rounded-lg border border-dashed text-xs text-muted-foreground font-black uppercase italic">
                                                + {allItems.length - 30} pedidos ocultos para performance
                                                <br />
                                                <span className="font-normal opacity-70">Mostrando os 30 mais recentes</span>
                                            </div>
                                        )}
                                    </div>
                                </KanbanColumn>
                            );
                        })}
                    </div>
                </DragDropContext>
            )}

            {selectedPedidoId && (
                <PedidoDetails
                    isOpen={isDetailsOpen}
                    onOpenChange={setIsDetailsOpen}
                    pedidoId={selectedPedidoId}
                    clientes={clientes}
                    produtos={produtos}
                    onEdit={() => {}} // Not needed here as it's separate flow
                    onDelete={() => {}}
                />
            )}

            <WhatsAppActionDialog
                isOpen={whatsAppDialog.open}
                onOpenChange={(open) => setWhatsAppDialog(prev => ({ ...prev, open }))}
                customerName={whatsAppDialog.pedido?.clientes?.nome || 'Cliente'}
                phone={whatsAppDialog.pedido?.clientes?.telefone || ''}
                messagePreview={whatsAppDialog.summary}
                pixKey={companyProfile?.company_pix_key}
                onConfirm={handleConfirmWhatsAppSend}
                isLoading={whatsAppDialog.loading}
                errorMessage={whatsAppDialog.error}
            />

            {/* Operator Chat Modal */}
            <OperatorChatModal
                isOpen={chatModal.open}
                onOpenChange={(open) => {
                    setChatModal(prev => ({ ...prev, open }));
                    // Clear unread count for this phone when chat is opened/closed
                    if (!open && chatModal.pedido?.clientes?.telefone) {
                        const phoneEnd = chatModal.pedido.clientes.telefone.replace(/\D/g, '').slice(-8);
                        setUnreadCounts(prev => ({ ...prev, [phoneEnd]: 0 }));
                    }
                }}
                customerName={chatModal.pedido?.clientes?.nome || 'Cliente'}
                phone={chatModal.pedido?.clientes?.telefone || ''}
                orderId={chatModal.pedido?.id}
                orderNumber={chatModal.pedido?.order_number}
                onMessageSent={() => {
                    // Clear unread for this phone after sending
                    const phoneEnd = chatModal.pedido?.clientes?.telefone?.replace(/\D/g, '').slice(-8);
                    if (phoneEnd) {
                        setUnreadCounts(prev => ({ ...prev, [phoneEnd]: 0 }));
                    }
                }}
            />
        </div>
    );
}

