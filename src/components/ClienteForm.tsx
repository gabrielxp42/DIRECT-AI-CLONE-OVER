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
import { useEffect, useRef } from "react"; // Importar useRef
import { CurrencyInput } from "./CurrencyInput"; // Importar CurrencyInput
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  telefone: z.string().optional().nullable(),
  email: z.string().optional().nullable().refine((val) => {
    if (!val || val === '') return true;
    return z.string().email().safeParse(val).success;
  }, { message: "Por favor, insira um email válido." }),
  endereco: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
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
      cep: "",
      valor_metro: 0, // Definir um valor padrão numérico para o CurrencyInput
      status: "ativo",
    },
  });

  const isEditing = !!initialData;
  const isFirstOpenForNewRef = useRef(true); // Ref para controlar o reset inicial de novos clientes

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        // Modo de edição: preencher com dados do cliente existente
        form.reset({
          nome: initialData.nome || "",
          telefone: initialData.telefone || "",
          email: initialData.email || "",
          endereco: initialData.endereco || "",
          cep: initialData.cep || "",
          valor_metro: initialData.valor_metro || 0, // Garantir valor numérico
          status: initialData.status || "ativo",
        });
        isFirstOpenForNewRef.current = true; // Resetar para o próximo novo formulário
      } else {
        // Modo de criação: só resetar na primeira vez que o diálogo abre para um novo cliente
        if (isFirstOpenForNewRef.current) {
          form.reset({
            nome: "",
            telefone: "",
            email: "",
            endereco: "",
            cep: "",
            valor_metro: 0, // Resetar para 0 para o CurrencyInput
            status: "ativo",
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
        telefone: "",
        email: "",
        endereco: "",
        cep: "",
        valor_metro: 0,
        status: "ativo",
      });
    }
  }, [isOpen, isEditing, initialData, form]);

  const handleSubmit = (data: ClienteFormValues) => {
    // Garantir que os campos vazios sejam enviados como null
    const formattedData = {
      nome: data.nome,
      telefone: data.telefone || null,
      email: data.email || null,
      endereco: data.endereco || null,
      cep: data.cep || null,
      valor_metro: data.valor_metro === undefined || data.valor_metro === null || data.valor_metro === 0 ? null : Number(data.valor_metro),
      status: data.status || "ativo"
    };

    console.log('Dados formatados para envio:', formattedData);
    onSubmit(formattedData, initialData?.id);
  };

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      CEP
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] text-[10px]">
                            O CEP é essencial para agilizar a cotação de frete e geração de etiquetas.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} value={field.value || ''} maxLength={9} />
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
            </div>
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