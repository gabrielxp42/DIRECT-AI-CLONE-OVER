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
import { Label } from "@/components/ui/label";
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
      tipo: "",
      insumos_vinculados: [],
    },
  });

  const [newInsumoId, setNewInsumoId] = useState("");
  const [newInsumoConsumo, setNewInsumoConsumo] = useState("1");

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

            <div className="space-y-4 border rounded-xl p-5 bg-muted/20 border-primary/10 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-primary" />
                    Composição do Produto
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Insumos que serão consumidos na produção de 1 unidade.</p>
                </div>
              </div>

              {/* Add New Link UI */}
              <div className="grid grid-cols-12 gap-2 bg-background/50 p-3 rounded-lg border border-dashed border-primary/20">
                <div className="col-span-6">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Escolher Insumo</Label>
                  <Select value={newInsumoId} onValueChange={setNewInsumoId}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.filter(i => !fields.some(f => f.insumo_id === i.id)).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nome} ({i.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Consumo</Label>
                  <div className="relative">
                    <Input
                      className="h-9 pr-8"
                      type="text"
                      placeholder="0.00"
                      value={newInsumoConsumo}
                      onChange={e => setNewInsumoConsumo(e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold">
                      {insumos.find(i => i.id === newInsumoId)?.unidade || ''}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 flex items-end">
                  <Button
                    type="button"
                    className="w-full h-9 shadow-md shadow-primary/5"
                    disabled={!newInsumoId || !newInsumoConsumo}
                    onClick={() => {
                      append({ insumo_id: newInsumoId, consumo: Number(newInsumoConsumo.replace(',', '.')) });
                      setNewInsumoId("");
                      setNewInsumoConsumo("1");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {fields.length === 0 ? (
                  <div className="text-center py-6 border rounded-lg bg-background/30 border-dashed">
                    <p className="text-xs text-muted-foreground">Adicione insumos para calcular o custo automático.</p>
                  </div>
                ) : (
                  fields.map((field, index) => {
                    const selectedInsumo = insumos.find(i => i.id === field.insumo_id);
                    return (
                      <div key={field.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-background group animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{selectedInsumo?.nome || 'Insumo'}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            Consumo: <span className="text-primary">{field.consumo} {selectedInsumo?.unidade}</span>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
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