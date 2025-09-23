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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewProduto, Produto } from "@/types/produto";
import { useEffect, useRef } from "react"; // Importar useRef

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  descricao: z.string().optional(),
  preco: z.coerce.number().min(0, { message: "O preço não pode ser negativo." }),
  estoque: z.coerce.number().min(0, { message: "O estoque não pode ser negativo." }).optional(),
});

type ProdutoFormValues = z.infer<typeof formSchema>;

interface ProdutoFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Omit<NewProduto, 'user_id'>, id?: string) => void;
  isSubmitting: boolean;
  initialData?: Produto | null;
}

export const ProdutoForm = ({ isOpen, onOpenChange, onSubmit, isSubmitting, initialData }: ProdutoFormProps) => {
  const form = useForm<ProdutoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      preco: 0,
      estoque: 0,
    },
  });

  const isEditing = !!initialData;
  const isFirstOpenForNewRef = useRef(true); // Ref para controlar o reset inicial de novos produtos

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        // Modo de edição: preencher com dados do produto existente
        form.reset({
          nome: initialData.nome,
          descricao: initialData.descricao || "",
          preco: initialData.preco,
          estoque: initialData.estoque || 0,
        });
        isFirstOpenForNewRef.current = true; // Resetar para o próximo novo formulário
      } else {
        // Modo de criação: só resetar na primeira vez que o diálogo abre para um novo produto
        if (isFirstOpenForNewRef.current) {
          form.reset({
            nome: "",
            descricao: "",
            preco: 0,
            estoque: 0,
          });
          isFirstOpenForNewRef.current = false; // Marcar como inicializado para esta sessão de novo formulário
        }
      }
    } else {
      // Quando o diálogo fecha, resetar a flag para a próxima abertura de um novo formulário
      isFirstOpenForNewRef.current = true;
      // Opcional: Limpar o formulário completamente ao fechar para garantir um novo começo na próxima vez
      form.reset({
        nome: "",
        descricao: "",
        preco: 0,
        estoque: 0,
      });
    }
  }, [isOpen, isEditing, initialData, form]);

  const handleSubmit = (data: ProdutoFormValues) => {
    onSubmit(data, initialData?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do produto." : "Preencha as informações do novo produto."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
            <FormField
              control={form.control}
              name="estoque"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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