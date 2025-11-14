import { useState, useEffect } from "react";
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

const Produtos = () => {
  const { supabase, session } = useSession();
  const queryClient = useQueryClient();
  const { data: produtos, isLoading, error } = useProdutos(); // Usando o hook centralizado
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
      if (!session) throw new Error("Sessão não encontrada");
      if (!supabase) throw new Error("Supabase client is not available");
      
      const productToInsert = { ...newProduto, user_id: session.user.id };
      
      const { error } = await supabase.from("produtos").insert([productToInsert]);
      if (error) throw new Error(error.message);
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
      if (!supabase) throw new Error("Supabase client is not available");
      const { error } = await supabase.from("produtos").update(updateData).eq("id", id);
      if (error) throw new Error(error.message);
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
      if (!supabase) throw new Error("Supabase client is not available");
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw new Error(error.message);
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
    setSelectedProduto(produto);
    setIsFormOpen(true);
  };

  const handleOpenDeleteDialog = (produto: Produto) => {
    setSelectedProduto(produto);
    setIsDeleteDialogOpen(true);
  };

  const filteredProdutos = produtos?.filter(produto =>
    produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
      {/* Header Section - Responsivo */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Produtos</h1>
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
          value={searchTerm}
          onChange={setSearchTerm}
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
    </div>
  );
};

export default Produtos;