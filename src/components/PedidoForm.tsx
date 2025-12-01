"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewPedido, Pedido } from "@/types/pedido";
import { Cliente } from "@/types/cliente";
import { Produto } from "@/types/produto";
import { useEffect, useState, useRef, useMemo } from "react";
import { Trash2, Plus, Search, Edit3, X, User, Package, Wrench, Save, Zap, CalendarIcon, Ruler, ChevronDown, Loader2, FileText, Copy, GripVertical, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem, SortableDragHandle } from '@/components/ui/sortable';
import { MagicPasteModal } from './MagicPasteModal';
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QuickClientForm } from './QuickClientForm';
import { useSession } from '@/contexts/SessionProvider';
import { showSuccess, showError } from '@/utils/toast';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyInput } from './CurrencyInput';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { removeAccents } from "@/utils/string";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { hapticTap, hapticImpact, hapticSelect } from "@/utils/haptic";

const DRAFT_STORAGE_KEY = "pedido_form_draft";

const formSchema = z.object({
  cliente_id: z.string().min(1, { message: "Cliente é obrigatório." }),
  observacoes: z.string().optional(),
  desconto_valor: z.coerce.number().min(0).optional(),
  desconto_percentual: z.coerce.number().min(0).max(100).optional(),
  created_at: z.date({
    required_error: "A data do pedido é obrigatória.",
  }),
  items: z.array(z.object({
    tempId: z.string().optional(), // ID temporário para controle de UI (React keys)
    produto_id: z.string().optional().nullable(),
    produto_nome: z.string().min(1, { message: "Nome do produto é obrigatório." }),
    quantidade: z.coerce.number().min(0.01, { message: "Quantidade deve ser maior que 0." }),
    preco_unitario: z.coerce.number().min(0, { message: "Preço deve ser maior ou igual a 0." }),
    observacao: z.string().optional(),
  })).min(1, { message: "Pelo menos um item é obrigatório para o pedido." }),
  servicos: z.array(z.object({
    nome: z.string().min(1, { message: "Nome do serviço é obrigatório." }),
    quantidade: z.coerce.number().min(1, { message: "Quantidade deve ser maior que 0." }),
    valor_unitario: z.coerce.number().min(0, { message: "Valor deve ser maior ou igual a 0." }),
  })).optional(),
});

export type PedidoFormValues = z.infer<typeof formSchema>;

interface PedidoFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Omit<NewPedido, 'user_id' | 'status'>, pedidoId?: string) => void;
  isSubmitting: boolean;
  clientes: Cliente[];
  produtos: Produto[];
  initialData?: Pedido | null;
}

const servicosRapidos = [
  { nome: "Montagem de Arquivo", valor: 10 },
  { nome: "N° com Foto", valor: 20 },
  { nome: "Montagem +3 Arquivos", valor: 15 },
  { nome: "Ajuste de Cor", valor: 5 },
];

export const PedidoForm = ({ isOpen, onOpenChange, onSubmit, isSubmitting, clientes, produtos, initialData }: PedidoFormProps) => {
  const { supabase, session } = useSession();
  const queryClient = useQueryClient();
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [selectedClienteName, setSelectedClienteName] = useState('');
  const [isQuickClientFormOpen, setIsQuickClientFormOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [selectedClientValorMetro, setSelectedClientValorMetro] = useState<number | null>(null);
  const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);

  const [accordionItemValue, setAccordionItemValue] = useState<string | undefined>(undefined);
  const [accordionServiceValue, setAccordionServiceValue] = useState<string | undefined>(undefined);

  // Snapshots para permitir cancelar alterações
  const [itemSnapshot, setItemSnapshot] = useState<any>(null);
  const [servicoSnapshot, setServicoSnapshot] = useState<any>(null);

  const form = useForm<PedidoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cliente_id: "",
      observacoes: "",
      desconto_valor: 0,
      desconto_percentual: 0,
      created_at: new Date(),
      items: [],
      servicos: [],
    },
  });

  const isEditing = !!initialData;
  const hasInitializedRef = useRef(false);
  const isSubmitInProgress = useRef(false);

  // Efeito para filtrar clientes
  useEffect(() => {
    if (clienteSearch.trim() === '') {
      setFilteredClientes(clientes);
    } else {
      const normalizedSearch = removeAccents(clienteSearch.toLowerCase());

      const results = clientes.filter(cliente => {
        const normalizedClientName = removeAccents(cliente.nome.toLowerCase());

        const nameMatch = normalizedClientName.includes(normalizedSearch);
        const phoneMatch = cliente.telefone && cliente.telefone.includes(clienteSearch.trim());

        return nameMatch || phoneMatch;
      });

      setFilteredClientes(results);
    }
  }, [clientes, clienteSearch]);

  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      if (isEditing && initialData) {
        const itemsData = initialData.pedido_items?.map((item: any) => ({
          tempId: Math.random().toString(36).substr(2, 9),
          produto_id: item.produto_id,
          produto_nome: item.produto_nome || item.produtos?.nome || '',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          observacao: item.observacao || '',
        })) || [];

        const servicosData = initialData.servicos?.map((servico: any) => ({
          nome: servico.nome,
          quantidade: servico.quantidade,
          valor_unitario: servico.valor_unitario,
        })) || [];

        form.reset({
          cliente_id: initialData.cliente_id || "",
          observacoes: initialData.observacoes || "",
          desconto_valor: initialData.desconto_valor || 0,
          desconto_percentual: initialData.desconto_percentual || 0,
          created_at: new Date(initialData.created_at),
          items: itemsData,
          servicos: servicosData,
        });
        const selectedClient = clientes.find(c => c.id === initialData.cliente_id);
        setSelectedClienteName(selectedClient ? selectedClient.nome : '');

        // CORREÇÃO: Carregar o valor_metro do cliente ao editar
        const valorMetro = selectedClient?.valor_metro || null;
        setSelectedClientValorMetro(valorMetro);

      } else {
        // Tentar recuperar rascunho
        const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
        let loadedFromDraft = false;

        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            // Recuperar datas corretamente
            if (parsed.created_at) parsed.created_at = new Date(parsed.created_at);

            form.reset(parsed);

            if (parsed.cliente_id) {
              const selectedClient = clientes.find(c => c.id === parsed.cliente_id);
              setSelectedClienteName(selectedClient ? selectedClient.nome : '');
            }

            toast.info("Rascunho recuperado automaticamente", {
              description: "Seus dados não salvos foram restaurados.",
              icon: <FileText className="h-4 w-4" />,
            });
            loadedFromDraft = true;
          } catch (e) {
            console.error("Erro ao recuperar rascunho:", e);
          }
        }

        if (!loadedFromDraft) {
          form.reset({
            cliente_id: "",
            observacoes: "",
            desconto_valor: 0,
            desconto_percentual: 0,
            created_at: new Date(),
            items: [],
            servicos: [],
          });
          setSelectedClienteName('');
        }
      }

      setClienteSearch('');
      setAccordionItemValue(undefined);
      setAccordionServiceValue(undefined);

      setAccordionServiceValue(undefined);

      hasInitializedRef.current = true;
      isSubmitInProgress.current = false; // Resetar flag de submit
    }

    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, isEditing, initialData, form, clientes]);

  // Auto-save do rascunho
  const formValues = form.watch();
  useEffect(() => {
    if (isOpen && !isEditing && !isSubmitting) {
      const timer = setTimeout(() => {
        // Só salvar se não estiver submetendo
        if (!isSubmitInProgress.current) {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formValues));
        }
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timer);
    }
  }, [formValues, isOpen, isEditing, isSubmitting]);

  const handleValidSubmit = (data: PedidoFormValues) => {
    const items = data.items || [];
    const servicos = data.servicos || [];
    const descontoValor = data.desconto_valor || 0;
    const descontoPercentual = data.desconto_percentual || 0;

    const subtotalProdutos = items.reduce((sum, item) => sum + (Number(item.quantidade) * Number(item.preco_unitario)), 0);
    const subtotalServicos = servicos.reduce((sum, servico) => sum + (Number(servico.quantidade) * Number(servico.valor_unitario)), 0);
    const subtotal = subtotalProdutos + subtotalServicos;

    const descontoPercentualValor = subtotal * (descontoPercentual / 100);
    const valorTotal = Math.max(0, subtotal - descontoValor - descontoPercentualValor);

    const totalMetros = items.reduce((sum, item) => sum + Number(item.quantidade || 0), 0); // NOVO CÁLCULO

    const formattedData = {
      cliente_id: data.cliente_id,
      valor_total: valorTotal,
      subtotal_produtos: subtotalProdutos,
      subtotal_servicos: subtotalServicos,
      desconto_valor: descontoValor,
      desconto_percentual: descontoPercentual,
      total_metros: totalMetros, // NOVO CAMPO
      observacoes: data.observacoes,
      created_at: data.created_at.toISOString(),
      items: items.map((item, index) => ({
        produto_id: item.produto_id || null,
        produto_nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        preco_unitario: Number(item.preco_unitario),
        observacao: item.observacao,
        ordem: index, // Garantir a ordem correta
      })),
      servicos: servicos.map(servico => ({
        nome: servico.nome, // Garantir que o nome está presente
        quantidade: Number(servico.quantidade),
        valor_unitario: Number(servico.valor_unitario),
      })),
    };

    // Bloquear novos salvamentos automáticos
    isSubmitInProgress.current = true;

    // Limpar rascunho IMEDIATAMENTE antes de enviar
    localStorage.removeItem(DRAFT_STORAGE_KEY);

    // Casting explícito para garantir que o TS saiba que os campos obrigatórios estão presentes
    onSubmit(formattedData as Omit<NewPedido, 'user_id' | 'status'>, initialData?.id);
  };

  const handleInvalidSubmit = (errors: any) => {
    console.error("Erros de validação do formulário:", errors);
    showError("Por favor, corrija os erros no formulário antes de enviar.");

    // --- Lógica de Scroll Automático ---
    const firstError = Object.keys(errors).reduce((acc, key) => {
      if (acc) return acc;
      if (errors[key]) return key;
      return acc;
    }, null);

    if (firstError) {
      // Tenta focar no campo. Se for um campo aninhado (como items.0.quantidade),
      // o setFocus pode não funcionar diretamente, mas o scrollIntoView deve funcionar.
      form.setFocus(firstError as keyof PedidoFormValues);

      // Encontra o elemento DOM correspondente ao primeiro erro e rola até ele
      const element = document.querySelector(`[name="${firstError}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Se for um erro de lista (ex: items), tenta rolar para o cabeçalho da seção
        const sectionElement = document.getElementById('section-items');
        if (sectionElement) {
          sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
    // --- Fim Lógica de Scroll Automático ---
  };

  const handleQuickClientSubmit = async (clientData: { nome: string; telefone?: string; email?: string; endereco?: string; valor_metro?: number }) => {
    if (!session) {
      showError("Sessão não encontrada. Por favor, recarregue a página.");
      return;
    }

    setIsCreatingClient(true);
    try {
      // CRÍTICO: Obter token válido ANTES da requisição
      const validToken = await getValidToken();
      const effectiveToken = validToken || session.access_token;

      if (!effectiveToken) {
        showError("Sessão inválida. Por favor, faça login novamente.");
        return;
      }

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      const clienteData = {
        ...clientData,
        telefone: clientData.telefone || null,
        email: clientData.email || null,
        endereco: clientData.endereco || null,
        valor_metro: clientData.valor_metro || null,
        user_id: session.user.id,
        status: 'ativo'
      };

      const url = `${SUPABASE_URL}/rest/v1/clientes`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify([clienteData])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar cliente: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Fazer parse seguro do JSON
      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (!text || !text.trim()) {
        throw new Error("Resposta vazia ao criar cliente.");
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ [handleQuickClientSubmit] Erro ao fazer parse JSON:', parseError, 'Texto:', text.substring(0, 100));
        throw new Error("Resposta inválida do servidor ao criar cliente.");
      }

      // PostgREST retorna array mesmo com single, pegar o primeiro elemento
      const newCliente = Array.isArray(result) ? (result.length > 0 ? result[0] : null) : result;

      if (!newCliente || !newCliente.id) {
        throw new Error("Resposta inválida ao criar cliente. Cliente não foi retornado corretamente.");
      }

      form.setValue('cliente_id', newCliente.id);
      setSelectedClienteName(newCliente.nome);
      setClienteOpen(false);
      setIsQuickClientFormOpen(false);

      // Invalidar queries para atualizar a lista de clientes
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

      showSuccess("Cliente criado e selecionado com sucesso!");
    } catch (error: any) {
      console.error('❌ [handleQuickClientSubmit] Erro:', error);
      showError(`Erro ao criar cliente: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const addItem = () => {
    hapticTap(); // Feedback ao adicionar
    // SEMPRE criar um item VAZIO, sem copiar dados anteriores
    const newItem = {
      tempId: Math.random().toString(36).substr(2, 9), // ID único
      produto_id: null,
      produto_nome: "",
      quantidade: 1,
      preco_unitario: selectedClientValorMetro || 0, // Usa o valor do metro do cliente se disponível
      observacao: ""
    };

    const currentItems = form.getValues('items') || [];
    // Adicionar ao FINAL da lista para evitar problemas de UI e ser mais intuitivo
    const newItems = [...currentItems, newItem];
    form.setValue('items', newItems);

    // Limpar snapshot anterior
    setItemSnapshot(null);

    // Abrir o novo item (que agora é o último)
    setTimeout(() => {
      setAccordionItemValue(`item-${newItems.length - 1}`);
      // Scroll para o novo item
      const newItemElement = document.getElementById(`item-card-${newItems.length - 1}`);
      if (newItemElement) {
        newItemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const duplicateItem = (index: number) => {
    hapticTap(); // Feedback ao duplicar
    const currentItems = form.getValues('items') || [];
    const itemToDuplicate = currentItems[index];

    // Criar cópia do item com NOVO ID
    const duplicatedItem = {
      ...itemToDuplicate,
      tempId: Math.random().toString(36).substr(2, 9), // ID único
      produto_id: itemToDuplicate.produto_id,
      produto_nome: itemToDuplicate.produto_nome,
      quantidade: itemToDuplicate.quantidade,
      preco_unitario: itemToDuplicate.preco_unitario,
      observacao: itemToDuplicate.observacao
    };

    // Inserir logo após o item original
    const newItems = [
      ...currentItems.slice(0, index + 1),
      duplicatedItem,
      ...currentItems.slice(index + 1)
    ];

    form.setValue('items', newItems);

    // Abrir o item duplicado
    setTimeout(() => {
      setAccordionItemValue(`item-${index + 1}`);
    }, 0);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const currentItems = form.getValues('items') || [];
    const newItems = [...currentItems];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    form.setValue('items', newItems);

    // Se o item movido estava aberto, atualizar o índice do accordion
    if (accordionItemValue === `item-${fromIndex}`) {
      setAccordionItemValue(`item-${toIndex}`);
    }
  };

  const handleImportItems = (importedItems: any[]) => {
    const currentItems = form.getValues('items') || [];

    const newItems = importedItems.map(item => ({
      tempId: item.tempId,
      produto_id: "",
      produto_nome: item.customName || "Produto Importado", // Nome temporário
      quantidade: item.quantidade,
      preco_unitario: selectedClientValorMetro || 0, // Usa o valor do metro do cliente se disponível
      observacao: item.observacao,
    }));

    form.setValue('items', [...currentItems, ...newItems]);

    toast.success(`${importedItems.length} itens importados com sucesso!`);
  };

  const removeItem = (index: number) => {
    hapticImpact(); // Feedback forte ao remover
    const currentItems = form.getValues('items') || [];
    form.setValue('items', currentItems.filter((_, i) => i !== index));
    // Fecha o accordion se o item removido estava aberto
    if (accordionItemValue === `item-${index}`) {
      setAccordionItemValue(undefined);
    }
  };

  const addServico = () => {
    const currentServicos = form.getValues('servicos') || [];
    const newServico = {
      nome: "",
      quantidade: 1,
      valor_unitario: 0
    };
    const newServiceIndex = currentServicos.length;

    form.setValue('servicos', [...currentServicos, newServico]);

    // Limpar snapshot anterior
    setServicoSnapshot(null);

    // Aguardar um tick para garantir que o formulário atualizou
    setTimeout(() => {
      setAccordionServiceValue(`servico-${newServiceIndex}`);
    }, 0);
  };

  const addShortcutServico = (nome: string, valor: number) => {
    const currentServicos = form.getValues('servicos') || [];
    form.setValue('servicos', [...currentServicos, { nome: nome, quantidade: 1, valor_unitario: valor }]);
    // NÃO expande automaticamente - o usuário pode expandir se quiser editar
    // setAccordionServiceValue(`servico-${newServiceIndex}`);
  };

  const removeServico = (index: number) => {
    const currentServicos = form.getValues('servicos') || [];
    form.setValue('servicos', currentServicos.filter((_, i) => i !== index));
    // Fecha o accordion se o serviço removido estava aberto
    if (accordionServiceValue === `servico-${index}`) {
      setAccordionServiceValue(undefined);
    }
  };

  const calculateTotal = () => {
    const items = form.watch('items') || [];
    const servicos = form.watch('servicos') || [];
    const descontoValor = form.watch('desconto_valor') || 0;
    const descontoPercentual = form.watch('desconto_percentual') || 0;

    const subtotalProdutos = items.reduce((sum, item) => sum + (Number(item.quantidade) * Number(item.preco_unitario)), 0);
    const subtotalServicos = servicos.reduce((sum, servico) => sum + (Number(servico.quantidade) * Number(servico.valor_unitario)), 0);
    const subtotal = subtotalProdutos + subtotalServicos;

    const descontoPercentualValor = subtotal * (descontoPercentual / 100);
    const valorTotal = Math.max(0, subtotal - descontoValor - descontoPercentualValor);

    const totalMetros = items.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

    return {
      subtotalProdutos,
      subtotalServicos,
      subtotal,
      valorTotal,
      totalMetros: totalMetros
    };
  };

  const { valorTotal, totalMetros } = calculateTotal();

  const handleClienteSelect = (clienteId: string, clienteNome: string) => {
    form.setValue('cliente_id', clienteId);
    setSelectedClienteName(clienteNome);
    setClienteOpen(false);
    setClienteSearch('');

    // Buscar o cliente completo para obter o valor do metro
    const cliente = clientes.find(c => c.id === clienteId);
    const valorMetro = cliente?.valor_metro || null;

    setSelectedClientValorMetro(valorMetro);

    if (valorMetro && valorMetro > 0) {
      // Atualizar itens existentes que tenham preço 0
      const currentItems = form.getValues('items') || [];
      const updatedItems = currentItems.map(item => {
        if (item.preco_unitario === 0) {
          return { ...item, preco_unitario: valorMetro };
        }
        return item;
      });

      // Só atualiza se houver mudança
      if (JSON.stringify(currentItems) !== JSON.stringify(updatedItems)) {
        form.setValue('items', updatedItems);
        toast.info(`Preços atualizados para R$ ${valorMetro.toFixed(2)} (Valor do Metro do Cliente)`);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentItems = form.getValues('items') || [];
      const oldIndex = currentItems.findIndex((item) => (item.tempId) === active.id);
      const newIndex = currentItems.findIndex((item) => (item.tempId) === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        hapticSelect(); // Feedback ao reordenar
        const newItems = arrayMove(currentItems, oldIndex, newIndex);
        form.setValue('items', newItems);
        // Fechar accordion para evitar confusão visual
        setAccordionItemValue(undefined);
      }
    }
  };

  const items = form.watch('items') || [];
  const itemIds = useMemo(() => items.map((item) => item.tempId || ''), [items]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2 sm:space-y-3">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">{isEditing ? "Editar Pedido" : "Criar Novo Pedido"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEditing ? "Atualize as informações do pedido." : "Preencha as informações do novo pedido."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)} className="space-y-4 sm:space-y-6">

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        Cliente *
                      </FormLabel>
                      <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={clienteOpen}
                              className="w-full justify-between transition-all duration-300 hover:bg-accent/50 h-9 sm:h-10 text-sm"
                            >
                              <span className="truncate">{selectedClienteName || "Selecione um cliente..."}</span>
                              <Search className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[90vw] sm:w-full p-0"
                          align="start"
                          sideOffset={4}
                        >
                          <Command>
                            <CommandInput
                              placeholder="Buscar cliente..."
                              value={clienteSearch}
                              onValueChange={setClienteSearch}
                              className="text-sm"
                            />
                            <div className="max-h-[200px] sm:max-h-[300px] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                              <CommandList>
                                <CommandEmpty className="text-sm py-4">Nenhum cliente encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {filteredClientes.map((cliente) => (
                                    <CommandItem
                                      key={cliente.id}
                                      value={cliente.nome}
                                      onSelect={() => handleClienteSelect(cliente.id, cliente.nome)}
                                      className="cursor-pointer py-2 transition-all duration-200 hover:bg-accent/50"
                                    >
                                      <User className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-medium text-sm truncate">{cliente.nome}</span>
                                        {cliente.telefone && (
                                          <span className="text-xs text-muted-foreground truncate">{cliente.telefone}</span>
                                        )}
                                        {cliente.endereco && (
                                          <span className="text-xs text-muted-foreground truncate">{cliente.endereco}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </div>
                            <div className="border-t p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 h-9 text-sm"
                                onClick={() => {
                                  setClienteOpen(false);
                                  setIsQuickClientFormOpen(true);
                                }}
                              >
                                <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                Adicionar Novo Cliente
                              </Button>
                            </div>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="created_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                        <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        Data *
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal h-9 sm:h-10 transition-all duration-300 hover:bg-accent/50 text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Hoje</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="items"
                render={({ field }) => (
                  <FormItem id="section-items"> {/* Adicionado ID para scroll */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Produtos
                      </h3>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          type="button"
                          onClick={addItem}
                          size="sm"
                          className="transition-all duration-300 hover:scale-[1.05] shadow-md hover:shadow-lg w-full sm:w-auto"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Item
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsMagicModalOpen(true)}
                          className="flex items-center gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all duration-300 hover:scale-[1.05] shadow-md hover:shadow-lg w-full sm:w-auto"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Importar do Zap
                        </Button>
                      </div>
                    </div>

                    {totalMetros > 0 && (
                      <div className="mt-2 p-2 bg-primary/20 rounded-md text-sm font-semibold flex justify-between items-center">
                        <span className="text-primary-foreground flex items-center gap-1">
                          <Ruler className="h-4 w-4" />
                          Total de Metros Lineares (ML):
                        </span>
                        <span className="text-primary-foreground">{Number(totalMetros).toFixed(2)} ML</span>
                      </div>
                    )}

                    <div className="space-y-3 mt-4">
                      {form.watch('items')?.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Nenhum produto adicionado. Clique em "Adicionar Item" para começar.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={itemIds}
                              strategy={verticalListSortingStrategy}
                            >
                              {items.map((item, index) => {
                                const isOpen = accordionItemValue === `item-${index}`;
                                // Garantir que tempId existe
                                if (!item.tempId) {
                                  item.tempId = Math.random().toString(36).substr(2, 9);
                                }
                                const itemKey = item.tempId;

                                return (
                                  <SortableItem key={itemKey} id={itemKey}>
                                    <Card
                                      id={`item-card-${index}`}
                                      className={`overflow-hidden transition-all duration-200 ${isOpen ? 'ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                                    >
                                      {/* Cabeçalho clicável */}
                                      <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                                        onClick={() => {
                                          if (isOpen) {
                                            setAccordionItemValue(undefined);
                                            setItemSnapshot(null);
                                          } else {
                                            // Salvar snapshot dos valores atuais
                                            const currentItem = form.getValues(`items.${index}`);
                                            setItemSnapshot({ index, data: { ...currentItem } });
                                            setAccordionItemValue(`item-${index}`);
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          {/* Handle de Drag & Drop */}
                                          {!isOpen && (
                                            <SortableDragHandle className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                                              <GripVertical className="h-5 w-5" />
                                            </SortableDragHandle>
                                          )}

                                          <div className="flex-1">
                                            <div className="font-medium text-sm flex items-center gap-2">
                                              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                              {item.produto_nome || <span className="text-muted-foreground italic">Novo Item</span>}
                                            </div>
                                            <div className="text-xs text-muted-foreground ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                              <span className="flex items-center gap-1">
                                                <Ruler className="h-3 w-3" />
                                                {Number(item.quantidade).toFixed(2)} ML
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {formatCurrency(Number(item.quantidade) * Number(item.preco_unitario))}
                                              </span>
                                            </div>
                                            {item.observacao && (
                                              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium border-l-2 border-amber-500 pl-2 bg-amber-50 dark:bg-amber-900/10 py-1 rounded-r">
                                                {item.observacao}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {/* Botão Duplicar */}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:text-primary hover:bg-primary/10"
                                            title="Duplicar item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              duplicateItem(index);
                                            }}
                                          >
                                            <Copy className="h-4 w-4" />
                                          </Button>

                                          {/* Botão Remover */}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10"
                                            title="Remover item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeItem(index);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Conteúdo expansível */}
                                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                                          <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                              <FormField
                                                control={form.control}
                                                name={`items.${index}.produto_nome`}
                                                render={({ field }) => (
                                                  <FormItem className="md:col-span-6">
                                                    <FormLabel>Produto</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="Nome do produto" className="bg-background" />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`items.${index}.quantidade`}
                                                render={({ field }) => (
                                                  <FormItem className="md:col-span-3">
                                                    <FormLabel>Qtd (ML)</FormLabel>
                                                    <FormControl>
                                                      <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="1.00"
                                                        {...field}
                                                        className="bg-background"
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`items.${index}.preco_unitario`}
                                                render={({ field }) => (
                                                  <FormItem className="md:col-span-3">
                                                    <FormLabel>Preço Unit.</FormLabel>
                                                    <FormControl>
                                                      <CurrencyInput
                                                        value={field.value}
                                                        onChange={(value) => field.onChange(value)}
                                                        placeholder="0,00"
                                                        className="bg-background"
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`items.${index}.observacao`}
                                                render={({ field }) => (
                                                  <FormItem className="md:col-span-12">
                                                    <FormLabel>Observação</FormLabel>
                                                    <FormControl>
                                                      <Textarea
                                                        {...field}
                                                        placeholder="Detalhes específicos deste item..."
                                                        className="bg-background min-h-[80px]"
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />
                                            </div>

                                            {/* Botões Salvar e Cancelar */}
                                            <div className="flex justify-end gap-2 pt-2 border-t">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Restaurar valores do snapshot
                                                  if (itemSnapshot && itemSnapshot.index === index) {
                                                    form.setValue(`items.${index}`, itemSnapshot.data);
                                                  }
                                                  setAccordionItemValue(undefined);
                                                  setItemSnapshot(null);
                                                }}
                                              >
                                                <X className="h-4 w-4 mr-2" />
                                                Cancelar
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                  setAccordionItemValue(undefined);
                                                  setItemSnapshot(null);
                                                }}
                                              >
                                                <Save className="h-4 w-4 mr-2" />
                                                Confirmar
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  </SortableItem>
                                );
                              })}
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                    {/* Exibe a mensagem de erro da lista de itens */}
                    {form.formState.errors.items && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.items.message || "Pelo menos um item é obrigatório para o pedido."}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <Separator className="my-6" />

              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Serviços
                  </h3>
                  <Button
                    type="button"
                    onClick={addServico}
                    size="sm"
                    variant="outline"
                    className="transition-all duration-300 hover:scale-[1.05] shadow-sm hover:shadow-md w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Serviço
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  {servicosRapidos.map((servico, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full h-auto py-1 px-3 text-xs transition-all duration-200 hover:bg-primary/10 hover:border-primary"
                      onClick={() => addShortcutServico(servico.nome, servico.valor)}
                    >
                      {servico.nome} - {formatCurrency(servico.valor)}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  {form.watch('servicos')?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum serviço adicionado. Clique em "Adicionar Serviço" para começar.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.watch('servicos')?.map((servico, index) => {
                        const isOpen = accordionServiceValue === `servico-${index}`;

                        return (
                          <Card key={index} className="overflow-hidden">
                            {/* Cabeçalho clicável */}
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => {
                                if (isOpen) {
                                  setAccordionServiceValue(undefined);
                                  setServicoSnapshot(null);
                                } else {
                                  // Salvar snapshot dos valores atuais
                                  const currentServico = form.getValues(`servicos.${index}`);
                                  setServicoSnapshot({ index, data: { ...currentServico } });
                                  setAccordionServiceValue(`servico-${index}`);
                                }
                              }}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm flex items-center gap-2">
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                  {servico.nome || `Serviço #${index + 1} (Sem nome)`}
                                </div>
                                <div className="text-xs text-muted-foreground ml-6">
                                  Qtd: {servico.quantidade} | Total: {formatCurrency(Number(servico.quantidade) * Number(servico.valor_unitario))}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeServico(index);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Conteúdo expansível */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                              <div className="px-4 pb-4 pt-2 border-t">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`servicos.${index}.nome`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Serviço</FormLabel>
                                          <FormControl>
                                            <Input {...field} placeholder="Ex: Montagem de Arq" />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name={`servicos.${index}.quantidade`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Quantidade</FormLabel>
                                          <FormControl>
                                            <Input type="number" {...field} />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name={`servicos.${index}.valor_unitario`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Valor Unitário</FormLabel>
                                          <FormControl>
                                            <CurrencyInput
                                              value={field.value}
                                              onChange={(value) => field.onChange(value)}
                                              placeholder="0,00"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  {/* Botões Salvar e Cancelar */}
                                  <div className="flex justify-end gap-2 pt-2 border-t">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // Restaurar valores do snapshot
                                        if (servicoSnapshot && servicoSnapshot.index === index) {
                                          form.setValue(`servicos.${index}`, servicoSnapshot.data);
                                        }
                                        setAccordionServiceValue(undefined);
                                        setServicoSnapshot(null);
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        setAccordionServiceValue(undefined);
                                        setServicoSnapshot(null);
                                      }}
                                    >
                                      <Save className="h-4 w-4 mr-2" />
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="desconto_valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (R$)</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="desconto_percentual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" max="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">Observações Gerais do Pedido</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Observações gerais do pedido..."
                        className="min-h-[80px] sm:min-h-[100px] text-sm resize-none"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between p-3 sm:p-4 bg-muted rounded-lg">
                <span className="text-base sm:text-lg font-medium">Total: {formatCurrency(valorTotal)}</span>
              </div>

              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto transition-all duration-300 hover:scale-[1.02] h-9 sm:h-10 text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto transition-all duration-300 hover:scale-[1.02] h-9 sm:h-10 text-sm"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />}
                  {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Pedido"}
                </Button>
              </DialogFooter>
              <MagicPasteModal
                isOpen={isMagicModalOpen}
                onOpenChange={setIsMagicModalOpen}
                onImportItems={handleImportItems}
              />
            </form>
          </Form>
        </DialogContent>
      </Dialog >

      <QuickClientForm
        isOpen={isQuickClientFormOpen}
        onOpenChange={setIsQuickClientFormOpen}
        onSubmit={handleQuickClientSubmit}
        isSubmitting={isCreatingClient}
      />
    </>
  );
};