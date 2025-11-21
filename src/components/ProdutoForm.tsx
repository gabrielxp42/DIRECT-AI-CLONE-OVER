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

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  descricao: z.string().optional(),
  preco: z.coerce.number().min(0, { message: "O preço não pode ser negativo." }),
  estoque: z.coerce.number().min(0, { message: "O estoque não pode ser negativo." }).optional(),
  insumo_id: z.string().optional().nullable(),
  consumo_insumo: z.coerce.number().min(0).optional(),
});

type ProdutoFormValues = z.infer<typeof formSchema>;

interface ProdutoFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Omit<NewProduto, 'user_id'>, id?: string) => void;
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

  const form = useForm<ProdutoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      preco: 0,
      estoque: 0,
      insumo_id: null,
      consumo_insumo: 0,
    },
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
          insumo_id: (initialData as any).insumo_id || null, // Cast temporário até atualizar o tipo
          consumo_insumo: (initialData as any).consumo_insumo || 0,
        });
        isFirstOpenForNewRef.current = true;
      } else {
        if (isFirstOpenForNewRef.current) {
          form.reset({
            nome: "",
            descricao: "",
            preco: 0,
            estoque: 0,
            insumo_id: null,
            consumo_insumo: 0,
          });
          isFirstOpenForNewRef.current = false;
        }
      }
    } else {
      isFirstOpenForNewRef.current = true;
      form.reset({
        nome: "",
        descricao: "",
        preco: 0,
        estoque: 0,
        insumo_id: null,
        consumo_insumo: 0,
      });
    }
  }, [isOpen, isEditing, initialData, form]);

  const handleSubmit = (data: ProdutoFormValues) => {
    // Tratar insumo_id vazio como null
    const payload = {
      ...data,
      insumo_id: data.insumo_id === "none" || data.insumo_id === "" ? null : data.insumo_id
    };
    onSubmit(payload as any, initialData?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do produto." : "Preencha as informações do novo produto."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do produto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="99.90" {...field} />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="estoque"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Atual</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="insumo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insumo Vinculado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || "none"}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {insumos.map((insumo) => (
                          <SelectItem key={insumo.id} value={insumo.id}>
                            {insumo.nome} ({insumo.unidade})
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
                name="consumo_insumo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consumo (por un.)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="Ex: 1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Produto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};