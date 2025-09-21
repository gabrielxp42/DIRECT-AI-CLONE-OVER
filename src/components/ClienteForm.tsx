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
import { Cliente, NewCliente } from "@/types/cliente";
import { useEffect } from "react";
import { CurrencyInput } from "./CurrencyInput"; // Importar CurrencyInput

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  telefone: z.string().optional().nullable(),
  email: z.string().optional().nullable().refine((val) => {
    if (!val || val === '') return true;
    return z.string().email().safeParse(val).success;
  }, { message: "Por favor, insira um email válido." }),
  endereco: z.string().optional().nullable(),
  valor_metro: z.union([
    z.number().min(0, { message: "O valor deve ser maior ou igual a zero." }),
    z.null(),
    z.undefined()
  ]).optional(),
  status: z.string().default('ativo'),
});

type ClienteFormValues = z.infer<typeof formSchema>;

interface ClienteFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Omit<NewCliente, 'user_id'>, id?: string) => void;
  isSubmitting: boolean;
  initialData?: Cliente | null;
}

export const ClienteForm = ({ isOpen, onOpenChange, onSubmit, isSubmitting, initialData }: ClienteFormProps) => {
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      endereco: "",
      valor_metro: 0, // Definir um valor padrão numérico para o CurrencyInput
      status: "ativo",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          nome: initialData.nome || "",
          telefone: initialData.telefone || "",
          email: initialData.email || "",
          endereco: initialData.endereco || "",
          valor_metro: initialData.valor_metro || 0, // Garantir valor numérico
          status: initialData.status || "ativo",
        });
      } else {
        form.reset({
          nome: "",
          telefone: "",
          email: "",
          endereco: "",
          valor_metro: 0, // Resetar para 0 para o CurrencyInput
          status: "ativo",
        });
      }
    }
  }, [isOpen, initialData, form]);

  const handleSubmit = (data: ClienteFormValues) => {
    // Garantir que os campos vazios sejam enviados como null
    const formattedData = {
      nome: data.nome,
      telefone: data.telefone || null,
      email: data.email || null,
      endereco: data.endereco || null,
      valor_metro: data.valor_metro === undefined || data.valor_metro === null || data.valor_metro === 0 ? null : Number(data.valor_metro),
      status: data.status || "ativo"
    };
    
    console.log('Dados formatados para envio:', formattedData);
    onSubmit(formattedData, initialData?.id);
  };

  const isEditing = !!initialData;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do cliente." : "Preencha as informações do novo cliente."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(21) 99999-9999" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="cliente@email.com" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, bairro..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valor_metro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Metro (R$)</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value || 0} // Passar 0 se for null/undefined
                      onChange={field.onChange}
                      placeholder="0,00" 
                    />
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
                {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};