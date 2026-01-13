import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { cn } from "@/lib/utils";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewProduto, Produto } from "@/types/produto";
import { useEffect, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionProvider";
import { useTiposProducao } from "@/hooks/useDataFetch";
import { Package, Plus, Trash2, Loader2, Printer, Scissors, Boxes } from "lucide-react";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  descricao: z.string().optional(),
  preco: z.coerce.number().min(0, { message: "O preço não pode ser negativo." }),
  estoque: z.coerce.number().min(0, { message: "O estoque não pode ser negativo." }).optional(),
  tipo: z.string().min(1, { message: "Selecione o tipo do produto." }),
  insumos_vinculados: z.array(z.object({
    insumo_id: z.string().min(1, { message: "Selecione um insumo." }),
    consumo: z.coerce.number().min(0.0001, { message: "Consumo deve ser maior que 0." }),
  })),
});

type ProdutoFormValues = z.infer<typeof formSchema>;

interface ProdutoFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: any, id?: string) => void;
  isSubmitting: boolean;
  initialData?: Produto | null;
}

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
}

export const ProdutoForm = ({ isOpen, onOpenChange, onSubmit, isSubmitting, initialData }: ProdutoFormProps) => {
  const { session } = useSession();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const { data: tiposProducao } = useTiposProducao();

  const form = useForm<ProdutoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      preco: 0,
      estoque: 0,
      tipo: "unidade",
      insumos_vinculados: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "insumos_vinculados" as const,
  });

  const isEditing = !!initialData;
  const isFirstOpenForNewRef = useRef(true);

  // Buscar insumos
  useEffect(() => {
    const fetchInsumos = async () => {
      if (!session?.access_token) return;
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/insumos?select=id,nome,unidade`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setInsumos(data);
        }
      } catch (error) {
        console.error("Erro ao buscar insumos:", error);
      }
    };

    if (isOpen) {
      fetchInsumos();
    }
  }, [isOpen, session]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          nome: initialData.nome,
          descricao: initialData.descricao || "",
          preco: initialData.preco,
          estoque: initialData.estoque || 0,
          tipo: initialData.tipo || "unidade",
          insumos_vinculados: initialData.produto_insumos?.map(pi => ({
            insumo_id: pi.insumo_id,
            consumo: pi.consumo
          })) || [],
        });
        isFirstOpenForNewRef.current = true;
      } else {
        if (isFirstOpenForNewRef.current) {
          form.reset({
            nome: "",
            descricao: "",
            preco: 0,
            estoque: 0,
            tipo: "unidade",
            insumos_vinculados: [],
          });
          isFirstOpenForNewRef.current = false;
        }
      }
    } else {
      isFirstOpenForNewRef.current = true;
      if (!isEditing) {
        form.reset();
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const selectedTipo = form.watch("tipo");
  const currentTipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === selectedTipo.toLowerCase());
  const isMetro = currentTipoInfo?.unidade_medida === 'metro';
  const isVinil = selectedTipo.toLowerCase().includes('vinil');
  const isDTF = selectedTipo.toLowerCase().includes('dtf');

  const handleSubmit = (data: ProdutoFormValues) => {
    onSubmit(data, initialData?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do produto." : "Preencha as informações do novo produto."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Produto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Camiseta DTF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Produto</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(
                          "transition-all",
                          isVinil && "border-orange-500/50 bg-orange-500/5 text-orange-600 focus:ring-orange-500",
                          isDTF && "border-blue-500/50 bg-blue-500/5 text-blue-600 focus:ring-blue-500"
                        )}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposProducao?.map((t) => {
                          const nomeLow = t.nome.toLowerCase();
                          const itIsVinil = nomeLow.includes('vinil');
                          const itIsDTF = nomeLow.includes('dtf');
                          return (
                            <SelectItem key={t.id} value={nomeLow}>
                              <div className="flex items-center gap-2">
                                {itIsVinil ? <Scissors className="w-4 h-4" /> :
                                  itIsDTF ? <Printer className="w-4 h-4" /> :
                                    <Package className="w-4 h-4" />}
                                <span>{t.nome}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Venda (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="99.90" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estoque"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Inicial ({isMetro ? "Metros" : "UND"})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o produto..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Insumos Vinculados (Composição)
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ insumo_id: "", consumo: 0 })}
                  className="h-8"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Insumo
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum insumo vinculado a este produto.
                </p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const selectedInsumoId = form.watch(`insumos_vinculados.${index}.insumo_id`);
                  const selectedInsumo = insumos.find(i => i.id === selectedInsumoId);

                  return (
                    <div key={field.id} className="flex gap-3 items-end border-b pb-3 last:border-0 last:pb-0">
                      <FormField
                        control={form.control}
                        name={`insumos_vinculados.${index}.insumo_id`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Insumo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {insumos.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.nome} ({i.unidade})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`insumos_vinculados.${index}.consumo`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                              Consumo {selectedInsumo ? `(${selectedInsumo.unidade})` : ''}
                            </FormLabel>
                            <FormControl>
                              <Input type="number" step="0.0001" placeholder="0.5" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-background pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : isEditing ? "Salvar Alterações" : "Criar Produto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};