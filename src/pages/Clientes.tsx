import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin, DollarSign, Eye, Loader2, UserX } from "lucide-react";
import { useSession } from "@/contexts/SessionProvider";
import { useToast } from "@/hooks/use-toast";
import { ClienteForm } from "@/components/ClienteForm";
import { EmptyState } from "@/components/EmptyState";
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
import { ClientDetailsCard } from "@/components/ClientDetailsCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // Importar DialogHeader, DialogTitle, DialogDescription
import { useIsMobile } from "@/hooks/use-mobile";
import { useClientes } from "@/hooks/useDataFetch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cliente, NewCliente } from "@/types/cliente";
import { showSuccess, showError } from "@/utils/toast";
import { useDebounce } from "@/hooks/useDebounce"; // Importar useDebounce
import { Skeleton } from "@/components/ui/skeleton"; // IMPORTAÇÃO ADICIONADA
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { removeAccents } from "@/utils/string"; // Importar função de normalização

const Clientes = () => {
  const { session } = useSession();
  const { data: clientes, isLoading, error } = useClientes();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;

  const [rawSearchTerm, setRawSearchTerm] = useState("");
  const searchTerm = useDebounce(rawSearchTerm, 300); // Aplicar debounce

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  useEffect(() => {
    if (location.state?.openForm) {
      setEditingCliente(null);
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // --- Mutações ---
  const addOrUpdateClienteMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Omit<NewCliente, 'user_id'>, id?: string }) => {
      if (!session || !accessToken) throw new Error('Sessão não encontrada');

      const clienteData = {
        ...data,
        user_id: session.user.id,
        status: data.status || 'ativo'
      };

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      if (id) {
        // Update usando PATCH
        const url = `${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(clienteData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao atualizar cliente: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return { type: 'update', nome: data.nome };
      } else {
        // Create usando POST
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

        return { type: 'create', nome: data.nome };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess(`Cliente ${result.type === 'create' ? 'criado' : 'atualizado'} com sucesso!`);
      setIsFormOpen(false);
      setEditingCliente(null);
    },
    onError: (error: any) => {
      showError(`Erro ao salvar cliente: ${error.message}`);
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) throw new Error('Token de acesso não encontrado');

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      const url = `${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao excluir cliente: ${response.status} ${response.statusText} - ${errorText}`);
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess("Cliente excluído com sucesso.");
      if (selectedClient?.id === id) {
        setSelectedClient(null);
      }
    },
    onError: (error: any) => {
      showError(`Não foi possível excluir o cliente: ${error.message}`);
    },
  });
  // --- Fim Mutações ---

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setIsFormOpen(true);
  };

  const handleViewDetails = (cliente: Cliente) => {
    setSelectedClient(cliente);
  };

  const handleSubmitCliente = (data: Omit<NewCliente, 'user_id'>, id?: string) => {
    addOrUpdateClienteMutation.mutate({ data, id });
  };

  const handleDelete = (id: string) => {
    deleteClienteMutation.mutate(id);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // OTIMIZAÇÃO: Usar useMemo para filtrar clientes com busca inteligente (normalização de acentos)
  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    if (!searchTerm || searchTerm.trim() === '') return clientes; // Retorna todos se a busca estiver vazia

    const trimmedSearch = searchTerm.trim();
    const normalizedSearch = removeAccents(trimmedSearch.toLowerCase());

    return clientes.filter(cliente => {
      // Busca no nome (normalizado, sem acentos)
      const normalizedNome = removeAccents(cliente.nome.toLowerCase());
      const nomeMatch = normalizedNome.includes(normalizedSearch) ||
        cliente.nome.toLowerCase().includes(trimmedSearch.toLowerCase());

      // Busca no email (case-insensitive)
      const emailMatch = cliente.email ?
        cliente.email.toLowerCase().includes(trimmedSearch.toLowerCase()) : false;

      // Busca no telefone (mantém formato original para números)
      const telefoneMatch = cliente.telefone ?
        cliente.telefone.includes(trimmedSearch) : false;

      // Busca no endereço (normalizado, sem acentos)
      const enderecoMatch = cliente.endereco ?
        removeAccents(cliente.endereco.toLowerCase()).includes(normalizedSearch) ||
        cliente.endereco.toLowerCase().includes(trimmedSearch.toLowerCase()) : false;

      return nomeMatch || emailMatch || telefoneMatch || enderecoMatch;
    });
  }, [clientes, searchTerm]); // Depende do valor debounced

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erro ao carregar clientes: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e informações de contato
          </p>
        </div>
        <Button
          onClick={() => { setEditingCliente(null); setIsFormOpen(true); }}
          size="default"
          className="h-10 w-full sm:w-auto transition-all duration-300 hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={rawSearchTerm} // Usa o valor bruto para o input
            onChange={(e) => setRawSearchTerm(e.target.value)} // Atualiza o valor bruto
            className="pl-8 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Grid de Clientes - Simplificado para melhor responsividade */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredClientes.map((cliente) => (
          <Card
            key={cliente.id}
            className="hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            onClick={() => handleViewDetails(cliente)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{cliente.nome}</CardTitle>
                <Badge variant={cliente.status === 'ativo' ? 'default' : 'secondary'}>
                  {cliente.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              )}
              {cliente.telefone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {cliente.endereco && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{cliente.endereco}</span>
                </div>
              )}
              {cliente.valor_metro !== null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Valor do Metro: {formatCurrency(cliente.valor_metro)}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleViewDetails(cliente); }}
                  className="transition-all duration-200 hover:bg-primary/10"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Detalhes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}
                  className="transition-all duration-200 hover:bg-primary/10"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()} className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o cliente "{cliente.nome}"?
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(cliente.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClientes.length === 0 && (
        <EmptyState
          title={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={searchTerm ? "Não encontramos clientes com esse termo de busca. Tente buscar por nome, email, telefone ou endereço." : "Comece criando seu primeiro cliente para gerenciar suas vendas de forma eficiente."}
          icon={UserX}
          actionLabel={searchTerm ? "Limpar Busca" : "Criar Primeiro Cliente"}
          onAction={searchTerm ? () => setRawSearchTerm('') : () => { setEditingCliente(null); setIsFormOpen(true); }}
        />
      )}

      <ClienteForm
        isOpen={isFormOpen}
        onOpenChange={(isOpen) => {
          setIsFormOpen(isOpen);
          if (!isOpen) setEditingCliente(null);
        }}
        onSubmit={handleSubmitCliente}
        isSubmitting={addOrUpdateClienteMutation.isPending || deleteClienteMutation.isPending}
        initialData={editingCliente}
      />

      {/* Modal de Detalhes */}
      {selectedClient && (
        <Dialog
          open={!!selectedClient}
          onOpenChange={(open) => !open && setSelectedClient(null)}
        >
          <DialogContent className="sm:max-w-[450px] max-w-[95vw] max-h-[95vh] p-0">
            {/* Adicionando DialogHeader/Title/Description para acessibilidade */}
            <DialogHeader className="sr-only">
              <DialogTitle>Detalhes do Cliente: {selectedClient.nome}</DialogTitle>
              <DialogDescription>Informações detalhadas e métricas do cliente.</DialogDescription>
            </DialogHeader>
            <ClientDetailsCard
              cliente={selectedClient}
              onClose={() => setSelectedClient(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Clientes;