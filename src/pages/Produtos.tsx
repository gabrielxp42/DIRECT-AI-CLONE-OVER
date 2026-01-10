import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Produto, NewProduto } from "@/types/produto";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Package, DollarSign, Loader2 } from "lucide-react";
import { ProdutoForm } from "@/components/ProdutoForm";
import { SearchInput } from "@/components/SearchInput";
import { LowStockAlert } from "@/components/LowStockAlert";
import { showSuccess, showError } from "@/utils/toast";
import { useProdutos } from "@/hooks/useDataFetch"; // Importar o novo hook
import { useDebounce } from "@/hooks/useDebounce"; // Importar useDebounce
import { Skeleton } from "@/components/ui/skeleton"; // Importar Skeleton
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from '@/utils/tokenGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoProducaoManager } from "@/components/TipoProducaoManager";
import { Settings2 } from "lucide-react";
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionModal } from '@/components/SubscriptionModal';

const Produtos = () => {
  const { session, profile } = useSession();
  const queryClient = useQueryClient();
  const { data: produtos, isLoading, error } = useProdutos(); // Usando o hook centralizado
  const accessToken = session?.access_token;
  const { canWriteData } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  const [rawSearchTerm, setRawSearchTerm] = useState("");
  const searchTerm = useDebounce(rawSearchTerm, 300); // Aplicar debounce

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openForm) {
      handleOpenForm();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const addProdutoMutation = useMutation({
    mutationFn: async (newProduto: Omit<NewProduto, 'user_id'>) => {
      if (!session || !accessToken) throw new Error("Sessão não encontrada");

      const productToInsert = {
        ...newProduto,
        user_id: session.user.id,
        organization_id: profile?.organization_id
      };

      const validToken = await getValidToken();
      if (!validToken) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      const url = `${SUPABASE_URL}/rest/v1/produtos`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify([productToInsert])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao adicionar produto: ${response.status} ${response.statusText} - ${errorText}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto adicionado com sucesso!");
      setIsFormOpen(false);
    },
    onError: (error) => {
      showError(`Erro ao adicionar produto: ${error.message}`);
    },
  });

  const updateProdutoMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Omit<NewProduto, 'user_id'>) => {
      const validToken = await getValidToken();
      if (!validToken) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      const url = `${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          ...updateData,
          organization_id: profile?.organization_id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao atualizar produto: ${response.status} ${response.statusText} - ${errorText}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto atualizado com sucesso!");
      setIsFormOpen(false);
      setSelectedProduto(null);
    },
    onError: (error) => {
      showError(`Erro ao atualizar produto: ${error.message}`);
    },
  });

  const deleteProdutoMutation = useMutation({
    mutationFn: async (id: string) => {
      const validToken = await getValidToken();
      if (!validToken) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      };

      const url = `${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao excluir produto: ${response.status} ${response.statusText} - ${errorText}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setSelectedProduto(null);
    },
    onError: (error) => {
      showError(`Erro ao excluir produto: ${error.message}`);
    },
  });

  const handleSaveProduto = (formData: Omit<NewProduto, 'user_id'>, id?: string) => {
    if (!session) return;
    if (id) {
      updateProdutoMutation.mutate({ id, ...formData });
    } else {
      addProdutoMutation.mutate(formData);
    }
  };

  const handleOpenForm = (produto: Produto | null = null) => {
    if (!canWriteData) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedProduto(produto);
    setIsFormOpen(true);
  };

  const handleOpenDeleteDialog = (produto: Produto) => {
    if (!canWriteData) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedProduto(produto);
    setIsDeleteDialogOpen(true);
  };

  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    if (!searchTerm) return produtos; // Retorna todos se a busca estiver vazia

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return produtos.filter(produto =>
      produto.nome.toLowerCase().includes(lowerCaseSearchTerm) ||
      produto.descricao?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [produtos, searchTerm]); // Depende do valor debounced

  const getStockStatus = (estoque: number | null) => {
    if (!estoque || estoque === 0) return { text: "Sem estoque", color: "text-red-600" };
    if (estoque <= 10) return { text: `${estoque} (Baixo)`, color: "text-yellow-600" };
    return { text: estoque.toString(), color: "text-green-600" };
  };

  const isMutating = addProdutoMutation.isPending || updateProdutoMutation.isPending;

  if (error) {
    return <div className="text-center py-8 text-red-600">Erro ao carregar produtos: {error.message}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Produtos & Configurações</h1>
      </div>

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Tipos de Produção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 pt-4">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex-1" />
            <Button
              onClick={() => handleOpenForm()}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-95 transition-transform"
              size="default"
            >
              <PlusCircle className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="text-sm sm:text-base">Adicionar Produto</span>
            </Button>
          </div>

          {/* Alertas de Estoque */}
          {produtos && <LowStockAlert produtos={produtos} />}

          {/* Search Input - Responsivo */}
          <div className="w-full">
            <SearchInput
              placeholder="Buscar produtos por nome ou descrição..."
              value={rawSearchTerm} // Usa o valor bruto para o input
              onChange={setRawSearchTerm} // Atualiza o valor bruto
              className="w-full sm:max-w-md"
            />
          </div>

          <ProdutoForm
            isOpen={isFormOpen}
            onOpenChange={(isOpen) => {
              setIsFormOpen(isOpen);
              if (!isOpen) setSelectedProduto(null);
            }}
            onSubmit={handleSaveProduto}
            isSubmitting={isMutating}
            initialData={selectedProduto}
          />

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="mx-4 max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg">Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Essa ação não pode ser desfeita. Isso excluirá permanentemente o produto "{selectedProduto?.nome}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                <AlertDialogCancel
                  onClick={() => setSelectedProduto(null)}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => selectedProduto && deleteProdutoMutation.mutate(selectedProduto.id)}
                  className="w-full sm:w-auto"
                >
                  {deleteProdutoMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Cards para Mobile, Tabela para Desktop */}
          <div className="block sm:hidden">
            {/* Layout de Cards para Mobile */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-2">Carregando...</p>
                </div>
              ) : filteredProdutos.length > 0 ? (
                filteredProdutos.map((produto) => {
                  const stockStatus = getStockStatus(produto.estoque);
                  return (
                    <Card key={produto.id} className="touch-manipulation">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg leading-tight truncate">
                              {produto.nome}
                            </CardTitle>
                            {produto.descricao && (
                              <CardDescription className="text-sm mt-1 line-clamp-2">
                                {produto.descricao}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 ml-2 flex-shrink-0 touch-manipulation"
                              >
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleOpenForm(produto)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenDeleteDialog(produto)}>
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-semibold text-lg">
                                R$ {produto.preco.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className={`text-sm font-medium ${stockStatus.color}`}>
                                {stockStatus.text}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum produto encontrado para a busca." : "Nenhum produto encontrado."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Tabela para Desktop */}
          <Card className="hidden sm:block">
            <CardHeader>
              <CardTitle>Lista de Produtos</CardTitle>
              <CardDescription>
                Gerencie seus produtos cadastrados. {filteredProdutos.length} produto(s) encontrado(s).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                          <p className="text-muted-foreground mt-2">Carregando...</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredProdutos.length > 0 ? (
                      filteredProdutos.map((produto) => {
                        const stockStatus = getStockStatus(produto.estoque);
                        return (
                          <TableRow key={produto.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-medium">{produto.nome}</div>
                                {produto.descricao && (
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                                    {produto.descricao}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>R$ {produto.preco.toFixed(2)}</TableCell>
                            <TableCell className={stockStatus.color}>
                              {stockStatus.text}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Abrir menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleOpenForm(produto)}>
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenDeleteDialog(produto)}>
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          {searchTerm ? "Nenhum produto encontrado para a busca." : "Nenhum produto encontrado."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <TipoProducaoManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SubscriptionModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </div>
  );
};

export default Produtos;