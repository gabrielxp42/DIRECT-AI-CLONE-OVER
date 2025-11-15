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
import { useEffect, useState, useRef } from "react";
import { Trash2, Plus, Search, Edit3, X, User, Package, Wrench, Save, Zap, CalendarIcon, Ruler, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QuickClientForm } from './QuickClientForm';
import { useSession } from '@/contexts/SessionProvider';
import { showSuccess, showError } from '@/utils/toast';
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

const formSchema = z.object({
  cliente_id: z.string().min(1, { message: "Cliente é obrigatório." }),
  observacoes: z.string().optional(),
  desconto_valor: z.coerce.number().min(0).optional(),
  desconto_percentual: z.coerce.number().min(0).max(100).optional(),
  created_at: z.date({
    required_error: "A data do pedido é obrigatória.",
  }),
  items: z.array(z.object({
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
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [selectedClienteName, setSelectedClienteName] = useState('');
  const [isQuickClientFormOpen, setIsQuickClientFormOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  
  const [accordionItemValue, setAccordionItemValue] = useState<string | undefined>(undefined);
  const [accordionServiceValue, setAccordionServiceValue] = useState<string | undefined>(undefined);

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
        
      } else {
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
      
      setClienteSearch('');
      setAccordionItemValue(undefined);
      setAccordionServiceValue(undefined);
      
      hasInitializedRef.current = true;
    }
    
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, isEditing, initialData, form, clientes]);

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
      items: items.map(item => ({
        produto_id: item.produto_id || null,
        produto_nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        preco_unitario: Number(item.preco_unitario),
        observacao: item.observacao,
      })),
      servicos: servicos.map(servico => ({
        ...servico,
        quantidade: Number(servico.quantidade),
        valor_unitario: Number(servico.valor_unitario),
      })),
    };

    onSubmit(formattedData, initialData?.id);
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
    if (!session || !supabase) return;
    
    setIsCreatingClient(true);
    try {
      const { data: result, error } = await supabase
        .from('clientes')
        .insert([{ 
          ...clientData, 
          telefone: clientData.telefone || null,
          email: clientData.email || null,
          endereco: clientData.endereco || null,
          valor_metro: clientData.valor_metro || null,
          user_id: session.user.id,
          status: 'ativo'
        }])
        .select()
        .single();

      if (error) throw error;

      form.setValue('cliente_id', result.id);
      setSelectedClienteName(result.nome);
      setClienteOpen(false);
      setIsQuickClientFormOpen(false);
      
      showSuccess("Cliente criado e selecionado com sucesso!");
    } catch (error: any) {
      showError(`Erro ao criar cliente: ${error.message}`);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const addItem = () => {
    const currentItems = form.getValues('items') || [];
    const newItemIndex = currentItems.length;
    form.setValue('items', [{ produto_id: null, produto_nome: "", quantidade: 1, preco_unitario: 0, observacao: "" }, ...currentItems]);
    // Abre o novo item (que agora está no índice 0)
    setAccordionItemValue(`item-${0}`);
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues('items');
    form.setValue('items', currentItems.filter((_, i) => i !== index));
    // Fecha o accordion se o item removido estava aberto
    if (accordionItemValue === `item-${index}`) {
      setAccordionItemValue(undefined);
    }
  };

  const addServico = () => {
    const currentServicos = form.getValues('servicos') || [];
    const newServiceIndex = currentServicos.length;
    form.setValue('servicos', [...currentServicos, { nome: "", quantidade: 1, valor_unitario: 0 }]);
    // Abre o novo serviço
    setAccordionServiceValue(`servico-${newServiceIndex}`);
  };

  const addShortcutServico = (nome: string, valor: number) => {
    const currentServicos = form.getValues('servicos') || [];
    const newServiceIndex = currentServicos.length;
    form.setValue('servicos', [...currentServicos, { nome: nome, quantidade: 1, valor_unitario: valor }]);
    // Abre o novo serviço
    setAccordionServiceValue(`servico-${newServiceIndex}`);
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
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {isEditing ? "Editar Pedido" : "Criar Novo Pedido"}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? "Atualize as informações do pedido." : "Preencha as informações do novo pedido."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente *
                      </FormLabel>
                      <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={clienteOpen}
                              className="w-full justify-between transition-all duration-300 hover:bg-accent/50"
                            >
                              {selectedClienteName || "Selecione um cliente..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Buscar cliente..." 
                              value={clienteSearch}
                              onValueChange={setClienteSearch}
                            />
                            <div className="max-h-[300px] overflow-y-auto">
                              <CommandList>
                                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {filteredClientes.map((cliente) => (
                                    <CommandItem
                                      key={cliente.id}
                                      value={cliente.nome}
                                      onSelect={() => handleClienteSelect(cliente.id, cliente.nome)}
                                      className="cursor-pointer py-2 transition-all duration-200 hover:bg-accent/50"
                                    >
                                      <User className="mr-2 h-4 w-4" />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{cliente.nome}</span>
                                        {cliente.telefone && (
                                          <span className="text-xs text-muted-foreground">{cliente.telefone}</span>
                                        )}
                                        {cliente.endereco && (
                                          <span className="text-xs text-muted-foreground truncate max-w-xs">{cliente.endereco}</span>
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
                                className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200"
                                onClick={() => {
                                  setClienteOpen(false);
                                  setIsQuickClientFormOpen(true);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Novo Cliente
                              </Button>
                            </div>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="created_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal h-10 transition-all duration-300 hover:bg-accent/50",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Hoje</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Produtos
                      </h3>
                      <Button 
                        type="button" 
                        onClick={addItem} 
                        size="sm"
                        className="transition-all duration-300 hover:scale-[1.05] shadow-md hover:shadow-lg"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Item
                      </Button>
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
                        <Accordion 
                          type="single" 
                          collapsible 
                          value={accordionItemValue} 
                          onValueChange={setAccordionItemValue}
                          className="w-full"
                        >
                          {form.watch('items')?.map((item, index) => (
                            <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-4 mb-2 transition-all duration-300 hover:shadow-md">
                              <AccordionTrigger className="py-3 hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="font-medium text-sm truncate">
                                      {item.produto_nome || `Item #${index + 1} (Sem nome)`}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Qtd: {item.quantidade} | Total: {formatCurrency(Number(item.quantidade) * Number(item.preco_unitario))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 hover:text-destructive transition-all duration-200 hover:scale-110"
                                      onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-2 pb-4">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.produto_nome`}
                                      render={({ field }) => (
                                        <FormItem className="md:col-span-3">
                                          <FormLabel>Produto</FormLabel>
                                          <FormControl>
                                            <Input {...field} placeholder="Nome do produto" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.quantidade`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Quantidade (ML)</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01" 
                                              placeholder="1.00"
                                              {...field} 
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
                                        <FormItem>
                                          <FormLabel>Preço Unitário</FormLabel>
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
                                      name={`items.${index}.observacao`}
                                      render={({ field }) => (
                                        <FormItem className="md:col-span-3">
                                          <FormLabel>Observação do Item</FormLabel>
                                          <FormControl>
                                            <Textarea {...field} placeholder="Detalhes específicos deste item..." />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Serviços
                  </h3>
                  <Button 
                    type="button" 
                    onClick={addServico} 
                    size="sm" 
                    variant="outline"
                    className="transition-all duration-300 hover:scale-[1.05] shadow-sm hover:shadow-md"
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
                    <Accordion 
                      type="single" 
                      collapsible 
                      value={accordionServiceValue} 
                      onValueChange={setAccordionServiceValue}
                      className="w-full"
                    >
                      {form.watch('servicos')?.map((servico, index) => (
                        <AccordionItem key={index} value={`servico-${index}`} className="border rounded-lg px-4 mb-2 transition-all duration-300 hover:shadow-md">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex-1 min-w-0 text-left">
                                <div className="font-medium text-sm truncate">
                                  {servico.nome || `Serviço #${index + 1} (Sem nome)`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Qtd: {servico.quantidade} | Total: {formatCurrency(Number(servico.quantidade) * Number(servico.valor_unitario))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:text-destructive transition-all duration-200 hover:scale-110"
                                  onClick={(e) => { e.stopPropagation(); removeServico(index); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
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
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
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
                    <FormLabel>Observações Gerais do Pedido</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Observações gerais do pedido..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="text-lg font-medium">Total: {formatCurrency(valorTotal)}</span>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="transition-all duration-300 hover:scale-[1.02]">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="transition-all duration-300 hover:scale-[1.02]">
                  {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Pedido"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <QuickClientForm
        isOpen={isQuickClientFormOpen}
        onOpenChange={setIsQuickClientFormOpen}
        onSubmit={handleQuickClientSubmit}
        isSubmitting={isCreatingClient}
      />
    </>
  );
};