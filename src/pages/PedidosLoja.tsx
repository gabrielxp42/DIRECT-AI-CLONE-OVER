import React, { useState, useCallback, useEffect } from 'react';
import { usePaginatedPedidos } from '@/hooks/useDataFetch';
import { Pedido } from '@/types/pedido';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, Archive, Search, Filter, ChevronDown, 
  ChevronUp, Image as ImageIcon, DollarSign, CalendarIcon, User, Plus,
  CheckSquare, Trash2, Copy, FolderInput, X, AlertTriangle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { lazy, Suspense } from 'react';
import { useSubmitPedido } from '@/hooks/useSubmitPedido';
import { useClientes, useProdutos, useLojaGrupos } from '@/hooks/useDataFetch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FolderPlus } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { motion, AnimatePresence } from 'framer-motion';

const PedidoForm = lazy(() => import('@/components/PedidoForm').then(m => ({ default: m.PedidoForm })));
import { InlineEdit } from '@/components/ui/inline-edit';
import { ProductImageModal } from '@/components/ProductImageModal';
import { useIsMobile } from '@/hooks/use-mobile';

const LOJA_STATUS_OPTIONS = [
  { label: 'RECEBIDO', color: 'bg-emerald-500' },
  { label: 'FILA DE IMPRESSÃO', color: 'bg-blue-500' },
  { label: 'FALTANDO ETIQUETA', color: 'bg-pink-500' },
  { label: 'EMBALADO', color: 'bg-teal-500' },
  { label: 'ENVIADO', color: 'bg-purple-500' },
  { label: 'ENTREGUE', color: 'bg-green-600' },
  { label: 'FALTOU CAMISETA', color: 'bg-orange-600' },
  { label: 'FALTOU ESTAMPA', color: 'bg-amber-600' },
  { label: 'CANCELADO', color: 'bg-red-500' },
];

const PedidosLoja = () => {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isAddingPedido, setIsAddingPedido] = useState(false);
  const [selectedImageItem, setSelectedImageItem] = useState<any>(null);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null);
  const [isCreatingGrupo, setIsCreatingGrupo] = useState(false);
  const [newGrupoName, setNewGrupoName] = useState('');
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: clientes } = useClientes();
  const { data: produtos } = useProdutos();
  const { data: lojaGrupos, isLoading: isLoadingGrupos } = useLojaGrupos();
  const { session, organizationId } = useSession();
  
  const submitPedidoMutation = useSubmitPedido(null, () => {
    setIsAddingPedido(false);
  });

  const { data: paginatedData, isLoading } = usePaginatedPedidos(
    currentPage,
    100, // retrieve more to allow frontend filtering visually
    showArchived ? 'cancelado' : 'todos',
    undefined,
    null,
    searchTerm,
    'loja',
    selectedGrupoId === 'sem-grupo' ? null : selectedGrupoId
  );

  const filteredLojaPedidos = paginatedData?.pedidos || [];

  // Frontend extra filter since 'sem-grupo' returns null but 'null' on backend ignores filter
  // Wait, in useDataFetch, `grupoId !== undefined && grupoId !== null` means passing null will just NOT filter.
  // We need to enforce group_id is null if 'sem-grupo' is selected. We handles that below visually:
  const ordersToDisplay = selectedGrupoId === 'sem-grupo' 
     ? filteredLojaPedidos.filter(p => p.grupo_id === null)
     : filteredLojaPedidos;

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === ordersToDisplay.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ordersToDisplay.map(p => p.id)));
    }
  }, [ordersToDisplay, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Escape to deselect
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  // Bulk operations
  const bulkUpdateStatus = async (newStatus: string) => {
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('pedidos').update({ loja_status: newStatus }).in('id', ids);
      if (error) throw error;
      showSuccess(`${ids.length} pedido(s) atualizados para ${newStatus}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) { showError(err.message); }
    setIsBulkProcessing(false);
  };

  const bulkMoveToGroup = async (grupoId: string | null) => {
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('pedidos').update({ grupo_id: grupoId }).in('id', ids);
      if (error) throw error;
      showSuccess(`${ids.length} pedido(s) movidos`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) { showError(err.message); }
    setIsBulkProcessing(false);
  };

  const bulkArchive = async () => {
    await bulkUpdateStatus('CANCELADO');
  };

  const bulkDelete = async () => {
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      // Delete items first
      const { error: itemsErr } = await supabase.from('pedido_items').delete().in('pedido_id', ids);
      if (itemsErr) throw itemsErr;
      const { error } = await supabase.from('pedidos').delete().in('id', ids);
      if (error) throw error;
      showSuccess(`${ids.length} pedido(s) excluídos`);
      clearSelection();
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) { showError(err.message); }
    setIsBulkProcessing(false);
  };

  const handleInlineEdit = async (table: string, id: string, field: string, value: string | number) => {
    try {
      const { error } = await supabase.from(table).update({ [field]: value }).eq('id', id);
      if (error) throw error;
      // If editing item qty/price, recalculate order total
      if (table === 'pedido_items' && (field === 'quantidade' || field === 'preco_unitario')) {
        const pedido = ordersToDisplay.find(p => p.pedido_items?.some(i => i.id === id));
        if (pedido?.pedido_items) {
          const updatedItems = pedido.pedido_items.map(i =>
            i.id === id ? { ...i, [field]: Number(value) } : i
          );
          const newSubtotal = updatedItems.reduce((sum, i) => sum + (i.quantidade * (i.preco_unitario || 0)), 0);
          const newTotal = newSubtotal - (pedido.desconto_valor || 0) + (pedido.valor_frete || 0);
          await supabase.from('pedidos').update({ subtotal_produtos: newSubtotal, valor_total: newTotal }).eq('id', pedido.id);
        }
      }
      showSuccess('Atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) {
      showError('Erro ao atualizar: ' + err.message);
      throw err;
    }
  };

  const handleCreateGrupo = async () => {
    if (!newGrupoName.trim()) return;
    try {
      const { error } = await supabase.from('loja_grupos').insert([{
        name: newGrupoName.trim(),
        organization_id: organizationId
      }]);
      if (error) throw error;
      showSuccess('Grupo criado!');
      setNewGrupoName('');
      setIsCreatingGrupo(false);
      queryClient.invalidateQueries({ queryKey: ["loja_grupos"] });
    } catch (err: any) {
      showError('Erro ao criar grupo: ' + err.message);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const toggleAnotado = async (pedido: Pedido, itemId: string, currentStatus: boolean) => {
    try {
      const newAnotadoStatus = !currentStatus;
      const { error } = await supabase
        .from('pedido_items')
        .update({ anotado: newAnotadoStatus })
        .eq('id', itemId);
      
      if (error) throw error;

      // Se estamos marcando como anotado, verificar se todos do pedido estão anotados
      if (newAnotadoStatus && pedido.pedido_items) {
        const allOthersAnotados = pedido.pedido_items.every(i => 
          i.id === itemId ? true : !!i.anotado
        );
        
        if (allOthersAnotados && pedido.loja_status === 'RECEBIDO') {
          // Atualiza o status do pedido para FILA DE IMPRESSÃO
          await updateLojaStatus(pedido.id, 'FILA DE IMPRESSÃO');
          showSuccess('Todos os produtos anotados. Pedido movido para FILA DE IMPRESSÃO!');
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) {
      showError(`Erro ao atualizar item: ${err.message}`);
    }
  };

  const updateLojaStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ loja_status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      showSuccess('Status atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) {
      showError(`Erro ao atualizar: ${err.message}`);
    }
  };

  const getStatusColor = (statusName: string | null | undefined) => {
    if (!statusName) return 'bg-gray-500';
    const found = LOJA_STATUS_OPTIONS.find(s => s.label === statusName);
    return found ? found.color : 'bg-gray-500';
  };

  // Function to guess client type based on their details for tag
  const getClientTag = (pedido: Pedido) => {
    if (pedido.pedido_items?.some(i => i.tipo === 'dtf')) {
      return { label: 'Cliente DTF', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
    if (pedido.observacoes?.toLowerCase().includes('site')) {
      return { label: 'Site', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    }
    return { label: 'Personalizado', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-[1600px] bg-[#0A0C10] min-h-screen text-white">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-2xl border bg-[#12141A] shadow-xl gap-4" style={{ borderColor: 'color-mix(in srgb, var(--primary-custom) 30%, transparent)', boxShadow: '0 0 20px color-mix(in srgb, var(--primary-custom) 15%, transparent)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border" style={{ background: 'color-mix(in srgb, var(--primary-custom) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--primary-custom) 30%, transparent)', boxShadow: '0 0 12px color-mix(in srgb, var(--primary-custom) 25%, transparent)' }}>
            <ShoppingCart className="h-6 w-6" style={{ color: 'var(--primary-custom)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Pedidos Loja
            </h1>
            <p className="text-white/40 text-sm font-medium">
              Gerenciamento de pedidos, status e envios.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input 
              placeholder="Buscar pedidos..." 
              className="pl-9 bg-[#1A1C24] border-white/10 text-white w-full sm:w-[250px] rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white gap-2">
            <Filter className="h-4 w-4" /> Filtrar
          </Button>
          <Button 
            variant={showArchived ? "default" : "outline"} 
            className={cn("gap-2 border-white/10", showArchived ? "bg-primary text-black" : "bg-[#1A1C24] hover:bg-white/5 text-white")}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4" /> 
            {showArchived ? "Ver Ativos" : "Arquivados"}
          </Button>
          <Button 
            onClick={() => setIsAddingPedido(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 border-none"
          >
            <Plus className="h-4 w-4" /> Novo Pedido
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <Button 
          variant={selectedGrupoId === null ? "default" : "outline"}
          size="sm"
          className={cn("whitespace-nowrap h-8", selectedGrupoId === null ? "bg-theme-secondary hover:bg-theme-secondary/90 text-white" : "bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white/70")}
          onClick={() => setSelectedGrupoId(null)}
        >
          Todos
        </Button>
        <Button 
          variant={selectedGrupoId === 'sem-grupo' ? "default" : "outline"}
          size="sm"
          className={cn("whitespace-nowrap h-8", selectedGrupoId === 'sem-grupo' ? "bg-theme-secondary hover:bg-theme-secondary/90 text-white" : "bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white/70")}
          onClick={() => setSelectedGrupoId('sem-grupo')}
        >
          Sem Grupo
        </Button>
        {lojaGrupos?.map(grupo => (
          <Button 
            key={grupo.id}
            variant={selectedGrupoId === grupo.id ? "default" : "outline"}
            size="sm"
            className={cn("whitespace-nowrap h-8", selectedGrupoId === grupo.id ? "bg-theme-secondary hover:bg-theme-secondary/90 text-white" : "bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white/70")}
            onClick={() => setSelectedGrupoId(grupo.id)}
          >
            {grupo.name}
          </Button>
        ))}
        
        {isCreatingGrupo ? (
          <div className="flex items-center gap-1 border border-white/10 rounded-md px-1 bg-[#1A1C24] h-8">
            <Input 
              value={newGrupoName}
              onChange={e => setNewGrupoName(e.target.value)}
              placeholder="Nome do grupo..."
              className="h-6 border-none bg-transparent w-32 focus-visible:ring-0 px-2 text-xs text-white"
              onKeyDown={e => e.key === 'Enter' && handleCreateGrupo()}
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-emerald-400" onClick={handleCreateGrupo}><Plus className="w-3 h-3"/></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400" onClick={() => setIsCreatingGrupo(false)}><span className="text-xs">✕</span></Button>
          </div>
        ) : (
          <Button 
            variant="outline"
            size="sm"
            className="whitespace-nowrap h-8 bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white/40 border-dashed"
            onClick={() => setIsCreatingGrupo(true)}
          >
            <FolderPlus className="w-4 h-4 mr-1" /> Novo Grupo
          </Button>
        )}
      </div>

      {/* Main Table or Mobile View */}
      {isMobile ? (
        <div className="flex flex-col gap-4 pb-20">
          {isLoading ? (
            <div className="p-8 text-center text-white/40 font-medium animate-pulse">Sincronizando loja...</div>
          ) : ordersToDisplay.length === 0 ? (
            <div className="p-8 text-center text-white/40 font-medium">Nenhum pedido encontrado no grupo selecionado.</div>
          ) : (
            ordersToDisplay.map((pedido: Pedido) => {
              const tag = getClientTag(pedido);
              const itemCount = pedido.pedido_items?.length || 0;
              const isExpanded = expandedRow === pedido.id;
              
              return (
          <div key={pedido.id} className={cn("bg-[#12141A] border rounded-xl p-4 flex flex-col gap-3 shadow-lg transition-colors", selectedIds.has(pedido.id) ? 'border-[var(--primary-custom)]/50 bg-[var(--primary-custom)]/5' : 'border-white/10 hover:border-white/20')}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(pedido.id); }}
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center border-2 shrink-0 transition-all",
                          selectedIds.has(pedido.id)
                            ? "border-[var(--primary-custom)] bg-[var(--primary-custom)]/20 text-[var(--primary-custom)]"
                            : "border-white/20 hover:border-white/40"
                        )}
                      >
                        {selectedIds.has(pedido.id) && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm shadow-lg text-white" onClick={() => toggleExpand(pedido.id)}>
                        {pedido.clientes?.nome?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col" onClick={() => toggleExpand(pedido.id)}>
                        <span className="text-sm font-bold truncate max-w-[150px]">{pedido.clientes?.nome}</span>
                        <span className="text-[10px] text-white/40 font-mono">#{pedido.order_number} • {format(new Date(pedido.created_at), 'dd/MM', { locale: ptBR })}</span>
                      </div>
                    </div>
                    
                    <div onClick={(e) => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className={cn(
                              "h-6 px-2 rounded font-bold text-[9px] uppercase tracking-wider text-white border-none",
                              getStatusColor(pedido.loja_status || 'RECEBIDO')
                            )}
                          >
                            {pedido.loja_status || 'RECEBIDO'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-2 bg-[#1A1C24] border-white/10" align="end">
                          <div className="flex flex-col gap-1">
                            {LOJA_STATUS_OPTIONS.map((status) => (
                              <button
                                key={status.label}
                                onClick={() => updateLojaStatus(pedido.id, status.label)}
                                className={cn(
                                  "text-[10px] font-bold uppercase rounded py-2 px-2 text-left text-white hover:opacity-80 transition-opacity",
                                  status.color
                                )}
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-[#1A1C24] p-3 rounded-lg border border-white/5 flex flex-col">
                      <span className="text-[9px] text-white/40 font-bold tracking-wider mb-1 flex items-center gap-1"><ShoppingCart className="w-3 h-3"/> PRODUTOS</span>
                      <span className="text-sm font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
                      {itemCount > 0 && <span className="text-[10px] text-white/40 truncate">{pedido.pedido_items[0].produto_nome}</span>}
                    </div>
                    <div className="bg-[#1A1C24] p-3 rounded-lg border border-white/5 flex flex-col">
                      <span className="text-[9px] text-white/40 font-bold tracking-wider mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> TOTAL</span>
                      <span className="text-sm font-black text-emerald-400">{(pedido.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      <Badge className={cn("mt-1 w-min text-[9px] uppercase border", pedido.status === 'pago' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                        {pedido.status === 'pago' ? 'RECEBIDO' : 'PENDENTE'}
                      </Badge>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-3 border-t border-white/10 flex flex-col gap-3 animate-in slide-in-from-top-2">
                       {/* Mobile Details View */}
                       {pedido.pedido_items?.map((item, idx) => (
                          <div key={idx} className="flex gap-3 bg-[#1A1C24]/50 p-2 rounded-lg border border-white/5">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedImageItem(item); }} className="w-12 h-12 bg-black/50 rounded flex-shrink-0 border border-white/10 flex items-center justify-center overflow-hidden">
                              {item.imagem_principal_url ? (
                                <img src={item.imagem_principal_url} alt="Prod" className="w-full h-full object-cover opacity-80" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-white/20" />
                              )}
                            </button>
                            <div className="flex flex-col flex-1">
                              <span className="text-xs font-medium text-white line-clamp-2">{item.produto_nome}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-white/50">{item.quantidade}x {(item.preco_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleAnotado(pedido, item.id, !!item.anotado); }}
                                  className={cn("w-5 h-5 rounded flex items-center justify-center border cursor-pointer", item.anotado ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-black/40 border-white/20")}
                                >
                                  {item.anotado && <span className="text-xs">✓</span>}
                                </button>
                              </div>
                            </div>
                          </div>
                       ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <div className="rounded-2xl border bg-[#12141A] overflow-x-auto shadow-xl custom-scrollbar" style={{ borderColor: 'color-mix(in srgb, var(--primary-custom) 15%, transparent)' }}>
        <div className="min-w-[1040px] flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-[40px_80px_1fr_180px_1fr_140px_120px_120px_50px] gap-4 p-4 border-b border-white/5 bg-[#1A1C24]/50 text-xs font-bold text-white/40 tracking-wider">
            <div className="flex items-center justify-center">
              <button
                onClick={toggleSelectAll}
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                  selectedIds.size > 0 && selectedIds.size === ordersToDisplay.length
                    ? "border-[var(--primary-custom)] bg-[var(--primary-custom)]/20 text-[var(--primary-custom)]"
                    : "border-white/20 hover:border-white/40"
                )}
              >
                {selectedIds.size > 0 && selectedIds.size === ordersToDisplay.length && <CheckSquare className="w-3 h-3" />}
              </button>
            </div>
            <div>ID</div>
            <div>CLIENTE</div>
            <div>STATUS</div>
            <div>PRODUTOS</div>
            <div>PAGAMENTO</div>
            <div>VALOR</div>
            <div>DATA</div>
            <div></div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-white/40 font-medium animate-pulse">
              Sincronizando loja...
            </div>
          ) : ordersToDisplay.length === 0 ? (
            <div className="p-8 text-center text-white/40 font-medium">
              Nenhum pedido encontrado no grupo selecionado.
            </div>
          ) : (
            <div className="flex flex-col">
            {ordersToDisplay.map((pedido: Pedido) => {
              const isExpanded = expandedRow === pedido.id;
              const tag = getClientTag(pedido);

              return (
                <div key={pedido.id} className={cn("flex flex-col border-b border-white/5 last:border-0 transition-colors", selectedIds.has(pedido.id) ? 'bg-[var(--primary-custom)]/5' : 'hover:bg-white/[0.02]')}>
                  {/* Row */}
                  <div 
                    className="grid grid-cols-[40px_80px_1fr_180px_1fr_140px_120px_120px_50px] gap-4 p-4 items-center cursor-pointer"
                    onClick={() => toggleExpand(pedido.id)}
                  >
                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelect(pedido.id)}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                          selectedIds.has(pedido.id)
                            ? "border-[var(--primary-custom)] bg-[var(--primary-custom)]/20 text-[var(--primary-custom)]"
                            : "border-white/20 hover:border-white/40"
                        )}
                      >
                        {selectedIds.has(pedido.id) && <CheckSquare className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="text-sm font-mono text-white/60">
                      #{pedido.order_number}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs shadow-lg">
                        {pedido.clientes?.nome?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold truncate max-w-[180px]">
                          {pedido.clientes?.nome}
                        </span>
                        <span className="text-xs text-white/40 truncate max-w-[180px]">
                          {pedido.clientes?.email}
                        </span>
                      </div>
                      <div className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold border", tag.bg)}>
                        {tag.label}
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className={cn(
                              "h-8 px-4 w-full rounded font-bold text-[10px] uppercase tracking-wider text-white border-none",
                              getStatusColor(pedido.loja_status || 'RECEBIDO')
                            )}
                          >
                            {pedido.loja_status || 'RECEBIDO'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-2 bg-[#1A1C24] border-white/10" align="start">
                          <div className="grid grid-cols-2 gap-2">
                            {LOJA_STATUS_OPTIONS.map((status) => (
                              <button
                                key={status.label}
                                onClick={() => updateLojaStatus(pedido.id, status.label)}
                                className={cn(
                                  "text-[10px] font-bold uppercase rounded py-2 px-1 text-white hover:opacity-80 transition-opacity",
                                  status.color
                                )}
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex flex-col gap-1">
                      {pedido.pedido_items && pedido.pedido_items.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                            <ImageIcon className="h-3 w-3 text-white/50" />
                          </div>
                          <span className="text-xs text-white/80 line-clamp-1">{pedido.pedido_items[0].produto_nome}</span>
                          {pedido.pedido_items.length > 1 && (
                            <span className="text-[10px] text-white/40 bg-white/10 px-1.5 rounded">+{pedido.pedido_items.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-white/40 italic">Sem produtos</span>
                      )}
                    </div>

                    <div>
                      <Badge className={cn(
                        "font-semibold text-[10px] uppercase border",
                        pedido.status === 'pago' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        $ {pedido.status === 'pago' ? 'RECEBIDO' : 'PENDENTE'}
                      </Badge>
                    </div>

                    <div className="text-sm font-semibold text-white/90">
                      {(pedido.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-white/80">
                        {format(new Date(pedido.created_at), "dd MMM")}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {format(new Date(pedido.created_at), "HH:mm")}
                      </span>
                    </div>

                    <div className="flex justify-end pr-2 text-white/40">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>

                  {/* Expanded Content Area */}
                  {isExpanded && (
                    <div className="p-4 bg-black/40 border-t border-white/5 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                      {/* Column 1: Client & Shipping details */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-white/40 tracking-widest flex items-center gap-2">
                            <User className="h-3 w-3" /> DADOS DO CLIENTE
                          </h3>
                          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/40 mt-1">Nome:</span>
                              <InlineEdit 
                                value={pedido.clientes?.nome || ''} 
                                onSave={(val) => handleInlineEdit('clientes', pedido.cliente_id, 'nome', val)} 
                                className="w-48 text-right font-medium" 
                                textClassName="font-medium"
                              />
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/40 mt-1">Email:</span>
                              <InlineEdit 
                                value={pedido.clientes?.email || ''} 
                                onSave={(val) => handleInlineEdit('clientes', pedido.cliente_id, 'email', val)} 
                                className="w-48 text-right" 
                                textClassName="font-medium text-white/70"
                              />
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/40 mt-1">Telefone:</span>
                              <InlineEdit 
                                value={pedido.clientes?.telefone || ''} 
                                onSave={(val) => handleInlineEdit('clientes', pedido.cliente_id, 'telefone', val)} 
                                className="w-32 text-right" 
                                textClassName="font-medium text-white/70"
                              />
                            </div>
                            <div className="pt-3 mt-3 border-t border-white/5 flex justify-between items-center text-sm">
                              <span className="text-white/40">Total Gasto:</span>
                              <span className="font-bold text-emerald-400">R$ 0,00</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-white/40 tracking-widest">ENVIO</h3>
                          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 space-y-3">
                            {/* Fake data mapping similar to the image */}
                            <div className="flex justify-between text-sm">
                              <span className="text-white/40 mt-1">CEP:</span>
                              <InlineEdit 
                                value={pedido.shipping_cep || ''} 
                                onSave={(val) => handleInlineEdit('pedidos', pedido.id, 'shipping_cep', val)} 
                                className="w-24 text-right" 
                                textClassName="font-medium"
                              />
                            </div>
                            <div className="flex flex-col text-sm mt-2">
                              <span className="text-white/40">Endereço:</span>
                              <InlineEdit 
                                value={pedido.shipping_details?.address || 'Avenida Central do Paraná'} 
                                onSave={(val) => handleInlineEdit('pedidos', pedido.id, 'shipping_details', { ...pedido.shipping_details, address: val })} 
                                className="w-full mt-1" 
                                textClassName="font-medium mt-1 inline-block"
                              />
                            </div>
                            <div className="pt-3 mt-3 border-t border-white/5 flex gap-2">
                              <div className="flex-1">
                                <span className="text-xs text-white/40 block mb-1">Método:</span>
                                <div className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-center font-medium pointer-events-none">
                                  PAC
                                </div>
                              </div>
                              <div className="flex-1">
                                <span className="text-xs text-white/40 block mb-1">Custo:</span>
                                <div className="flex justify-end py-1.5 text-sm font-medium border-b border-white/10">
                                  <InlineEdit 
                                    value={pedido.valor_frete || 0} 
                                    type="number"
                                    onSave={(val) => handleInlineEdit('pedidos', pedido.id, 'valor_frete', Number(val))} 
                                    className="w-24 text-right" 
                                    formatDisplay={(val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-white/5">
                              <span className="text-white/40">Rastreio:</span>
                              <a href="#" className="text-blue-400 hover:underline">Ver rastreio</a>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-white/40 tracking-widest">PAGAMENTO</h3>
                          <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-white/40">Status:</span>
                              <Badge className={cn(
                                "font-semibold text-[10px] uppercase border",
                                pedido.status === 'pago' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              )}>
                                {pedido.status === 'pago' ? 'RECEBIDO' : 'PENDENTE'}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-white/40">Método:</span>
                              <span className="font-medium">Pix</span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-white/5 flex flex-col gap-2">
                              <span className="text-white/40 text-xs">Grupo do Pedido:</span>
                              <Select 
                                value={pedido.grupo_id || 'sem-grupo'} 
                                onValueChange={(val) => handleInlineEdit('pedidos', pedido.id, 'grupo_id', val === 'sem-grupo' ? null : val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-black/40 border-white/10">
                                  <SelectValue placeholder="Selecione um grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sem-grupo">Sem Grupo</SelectItem>
                                  {lojaGrupos?.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 2 & 3: Order Items */}
                      <div className="lg:col-span-2 space-y-3 flex flex-col h-full">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-bold text-white/40 tracking-widest flex items-center gap-2">
                            <ShoppingCart className="h-3 w-3" /> ITENS DO PEDIDO
                          </h3>
                          <Button variant="outline" size="sm" className="bg-[#1A1C24] border-white/10 hover:bg-white/5 text-white h-8 text-xs gap-2">
                            + Adicionar
                          </Button>
                        </div>
                        
                        <div className="bg-[#1A1C24] rounded-xl border border-white/5 flex-1 flex flex-col overflow-hidden">
                          {/* Items Header */}
                          <div className="grid grid-cols-[1fr_80px_60px_80px_100px_60px] gap-4 p-3 border-b border-white/5 text-[10px] font-bold text-white/40 tracking-wider">
                            <div>PRODUTO</div>
                            <div className="text-center">ANOTADA</div>
                            <div className="text-center">QTD</div>
                            <div className="text-right">PREÇO</div>
                            <div className="text-right">TOTAL</div>
                            <div className="text-center">AÇÕES</div>
                          </div>
                          
                          {/* Items List */}
                          <div className="flex-1 p-2 space-y-2">
                            {pedido.pedido_items?.map((item, idx) => (
                              <div key={idx} className="grid grid-cols-[1fr_80px_60px_80px_100px_60px] gap-4 p-2 items-center hover:bg-white/5 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3">
                                  <button onClick={() => setSelectedImageItem(item)} className="w-10 h-10 bg-black/50 rounded flex-shrink-0 border border-white/10 flex items-center justify-center overflow-hidden hover:border-white/30 transition-colors cursor-pointer group-thumbnail relative">
                                    {item.imagem_principal_url ? (
                                      <img src={item.imagem_principal_url} alt="Prod" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                       <span className="text-[9px] font-bold">FOTOS</span>
                                    </div>
                                  </button>
                                  <div className="flex flex-col w-full">
                                    <InlineEdit 
                                      value={item.produto_nome} 
                                      onSave={(val) => handleInlineEdit('pedido_items', item.id, 'produto_nome', val)} 
                                      className="w-full" 
                                      textClassName="text-sm font-medium line-clamp-1"
                                    />
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-white/40 mt-0.5">Variação:</span>
                                      <InlineEdit 
                                        value={item.observacao || 'Padrão'} 
                                        onSave={(val) => handleInlineEdit('pedido_items', item.id, 'observacao', val)} 
                                        className="w-24" 
                                        textClassName="text-xs text-white/40"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-center">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAnotado(pedido, item.id, !!item.anotado);
                                    }}
                                    className={cn(
                                    "w-5 h-5 rounded flex items-center justify-center border cursor-pointer hover:scale-110 transition-transform",
                                    item.anotado ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-black/40 border-white/20 hover:border-white/40"
                                  )}>
                                    {item.anotado && <span className="text-xs">✓</span>}
                                  </button>
                                </div>
                                <div className="flex justify-center mt-1">
                                  <InlineEdit 
                                    value={item.quantidade} 
                                    type="number"
                                    onSave={(val) => handleInlineEdit('pedido_items', item.id, 'quantidade', Number(val))} 
                                    className="w-12 text-center" 
                                    textClassName="text-center text-sm font-medium w-full"
                                  />
                                </div>
                                <div className="flex justify-end mt-1">
                                  <InlineEdit 
                                    value={item.preco_unitario || 0} 
                                    type="number"
                                    onSave={(val) => handleInlineEdit('pedido_items', item.id, 'preco_unitario', Number(val))} 
                                    className="w-16 text-right" 
                                    textClassName="text-right text-sm text-white/70 w-full"
                                    formatDisplay={(val) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                  />
                                </div>
                                <div className="text-right text-sm font-bold flex items-center justify-end">{(item.quantidade * (item.preco_unitario || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                <div className="flex justify-center">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {(!pedido.pedido_items || pedido.pedido_items.length === 0) && (
                              <div className="p-4 text-center text-white/40 text-sm">Nenhum item registrado neste pedido.</div>
                            )}
                          </div>
                          
                          {/* Order Totals Footer */}
                          <div className="border-t border-white/5 p-4 bg-black/20 flex flex-col items-end justify-center min-h-[120px]">
                            <div className="w-[300px] space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-white/40">Subtotal:</span>
                                <span>{(pedido.subtotal_produtos || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-white/40">Desconto:</span>
                                <span className="text-red-400">- {(pedido.desconto_valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-white/40">Frete:</span>
                                <span>{(pedido.valor_frete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                              <div className="pt-2 mt-2 border-t border-white/10 flex justify-between items-center text-lg">
                                <span className="font-bold">Total:</span>
                                <span className="font-black text-white">{(pedido.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
      )}

      <ProductImageModal 
        item={selectedImageItem}
        isOpen={!!selectedImageItem}
        onOpenChange={(open) => !open && setSelectedImageItem(null)}
      />

      <Suspense fallback={<div className="p-8 text-center text-white/40">Carregando formulário...</div>}>
        {isAddingPedido && (
          <PedidoForm 
            isOpen={isAddingPedido}
            onOpenChange={setIsAddingPedido}
            onSubmit={(data) => submitPedidoMutation.mutate({ data, defaultLojaStatus: 'RECEBIDO', origem: 'loja' })}
            isSubmitting={submitPedidoMutation.isPending}
            clientes={clientes || []}
            produtos={produtos || []}
          />
        )}
      </Suspense>

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border bg-[#12141A]/95 backdrop-blur-xl shadow-2xl"
            style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 30px color-mix(in srgb, var(--primary-custom) 30%, transparent), 0 8px 32px rgba(0,0,0,0.5)' }}
          >
            {/* Counter */}
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: 'color-mix(in srgb, var(--primary-custom) 20%, transparent)', color: 'var(--primary-custom)' }}>
                {selectedIds.size}
              </div>
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider whitespace-nowrap">selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            </div>

            {/* Status Change */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white hover:bg-white/10 gap-2" disabled={isBulkProcessing}>
                  <CheckSquare className="w-4 h-4" style={{ color: 'var(--primary-custom)' }} /> Status
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-2 bg-[#1A1C24] border-white/10" side="top" align="center">
                <div className="grid grid-cols-2 gap-1.5">
                  {LOJA_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status.label}
                      onClick={() => bulkUpdateStatus(status.label)}
                      className={cn("text-[10px] font-bold uppercase rounded py-2 px-2 text-white hover:opacity-80 transition-opacity", status.color)}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Move to Group */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white hover:bg-white/10 gap-2" disabled={isBulkProcessing}>
                  <FolderInput className="w-4 h-4" style={{ color: 'var(--primary-custom)' }} /> Mover
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2 bg-[#1A1C24] border-white/10" side="top" align="center">
                <div className="flex flex-col gap-1">
                  <button onClick={() => bulkMoveToGroup(null)} className="text-xs font-bold text-left py-2 px-3 rounded hover:bg-white/10 text-white/70 transition-colors">Sem Grupo</button>
                  {lojaGrupos?.map(g => (
                    <button key={g.id} onClick={() => bulkMoveToGroup(g.id)} className="text-xs font-bold text-left py-2 px-3 rounded hover:bg-white/10 text-white/70 transition-colors">{g.name}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Archive */}
            <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-2" onClick={bulkArchive} disabled={isBulkProcessing}>
              <Archive className="w-4 h-4" /> Arquivar
            </Button>

            {/* Delete */}
            <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2" onClick={() => setShowDeleteConfirm(true)} disabled={isBulkProcessing}>
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>

            {/* Close */}
            <button onClick={clearSelection} className="ml-1 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>

            {isBulkProcessing && <Loader2 className="w-4 h-4 animate-spin text-white/60 ml-1" />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#12141A] border-white/10 text-white max-w-md">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">Confirmar Exclusão</h3>
            <p className="text-sm text-white/60 text-center">
              Tem certeza que deseja excluir <strong className="text-white">{selectedIds.size}</strong> pedido(s)? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 w-full mt-2">
              <Button variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-none gap-2" onClick={bulkDelete} disabled={isBulkProcessing}>
                {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosLoja;
