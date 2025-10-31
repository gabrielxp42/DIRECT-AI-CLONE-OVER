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
import { User, Phone, Mail, MapPin, DollarSign } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  telefone: z.string().optional(),
  email: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    return z.string().email().safeParse(val).success;
  }, { message: "Por favor, insira um email válido." }),
  endereco: z.string().optional(),
  valor_metro: z.union([
    z.number().min(0, { message: "O valor deve ser maior ou igual a zero." }),
    z.null(),
    z.undefined()
  ]).optional(),
});

type QuickClientFormValues = z.infer<typeof formSchema>;

interface QuickClientFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: QuickClientFormValues) => void;
  isSubmitting: boolean;
}

export const QuickClientForm = ({ isOpen, onOpenChange, onSubmit, isSubmitting }: QuickClientFormProps) => {
  const form = useForm<QuickClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      endereco: "",
      valor_metro: 0,
    },
  });

  const handleSubmit = (data: QuickClientFormValues) => {
    onSubmit(data);
    form.reset();
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Criar Novo Cliente
          </DialogTitle>
          <DialogDescription>
            Adicione um novo cliente rapidamente para incluir no pedido.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nome *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome completo do cliente" 
                      {...field}
                      className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(21) 99999-9999" 
                      {...field} 
                      value={field.value || ''}
                      className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="cliente@email.com" 
                      {...field} 
                      value={field.value || ''}
                      className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
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
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Endereço completo do cliente" 
                      {...field} 
                      value={field.value || ''}
                      className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Valor do Metro (R$)
                  </FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value || 0}
                      onChange={field.onChange}
                      placeholder="0,00" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSubmitting}
                className="transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="transition-all duration-200"
              >
                {isSubmitting ? "Criando..." : "Criar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};