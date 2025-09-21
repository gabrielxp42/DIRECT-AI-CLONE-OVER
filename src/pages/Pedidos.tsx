import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionProvider";
import { Pedido, PedidoStatus } from "@/types/pedido";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast"; // Importando do utilitário
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Search, PlusCircle, Filter, ChevronDown, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pagination } from "@/components/Pagination";

const Pedidos = () => {
  const { supabase } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<PedidoStatus | "todos">("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [pedidosPerPage] = useState(10);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [newStatus, setNewStatus] = useState<PedidoStatus | "">("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pedidoToDelete, setPedidoToDelete] = useState<Pedido | null>(null);

  useEffect(() => {
    const fetchPedidos = async () => {
      setLoading(true);
      if (!supabase) return;

      let query = supabase.from("pedidos").select("*").order("created_at", { ascending: false });

      if (filterStatus !== "todos") {
        query = query.eq("status", filterStatus);
      }

      if (searchTerm) {
        query = query.ilike("nome_cliente", `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar pedidos:", error);
        showError("Erro ao carregar pedidos."); // Usando showError
      } else {
        setPedidos(data || []);
      }
      setLoading(false);
    };

    fetchPedidos();
  }, [supabase, filterStatus, searchTerm]);

  useEffect(() => {
    const state = location.state as { filterStatus?: PedidoStatus };
    if (state?.filterStatus) {
      setFilterStatus(state.filterStatus);
      navigate(location.pathname, { replace: true }); // Limpa o estado após usar
    }
  }, [location.state, navigate, location.pathname]);

  const getStatusBadge = (status: PedidoStatus) => {
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" = "default";
    let text = status;

    switch (status) {
      case PedidoStatus.PENDENTE:
        variant = "warning";
        text = "Pendente";
        break;
      case PedidoStatus.PROCESSANDO:
        variant = "info";
        text = "Processando";
        break;
      case PedidoStatus.AGUARDANDO_RETIRADA:
        variant = "secondary";
        text = "Aguardando Retirada";
        break;
      case PedidoStatus.ENTREGUE:
        variant = "success";
        text = "Entregue";
        break;
      case PedidoStatus.CANCELADO:
        variant = "destructive";
        text = "Cancelado";
        break;
      default:
        variant = "default";
        break;
    }
    return <Badge variant={variant}>{text}</Badge>;
  };

  const handleOpenStatusModal = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setNewStatus(pedido.status);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!supabase || !selectedPedido || !newStatus) return;

    const toastId = showLoading("Atualizando status..."); // Usando showLoading
    const { error } = await supabase
      .from("pedidos")
      .update({ status: newStatus })
      .eq("id", selectedPedido.id);

    if (error) {
      showError("Erro ao atualizar status.", { id: toastId }); // Usando showError
      console.error("Erro ao atualizar status:", error);
    } else {
      showSuccess("Status atualizado com sucesso!", { id: toastId }); // Usando showSuccess
      setPedidos((prev) =>
        prev.map((p) => (p.id === selectedPedido.id ? { ...p, status: newStatus } : p))
      );
      setIsStatusModalOpen(false);
      setSelectedPedido(null);
      setNewStatus("");
    }
  };

  const handleOpenDeleteModal = (pedido: Pedido) => {
    setPedidoToDelete(pedido);
    setIsDeleteModalOpen(true);
  };

  const handleDeletePedido = async () => {
    if (!supabase || !pedidoToDelete) return;

    const toastId = showLoading("Excluindo pedido..."); // Usando showLoading
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", pedidoToDelete.id);

    if (error) {
      showError("Erro ao excluir pedido.", { id: toastId }); // Usando showError
      console.error("Erro ao excluir pedido:", error);
    } else {
      showSuccess("Pedido excluído com sucesso!", { id: toastId }); // Usando showSuccess
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoToDelete.id));
      setIsDeleteModalOpen(false);
      setPedidoToDelete(null);
    }
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((pedido) => {
      const matchesSearch = searchTerm
        ? pedido.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pedido.id.toString().includes(searchTerm)
        : true;
      const matchesStatus = filterStatus === "todos" || pedido.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [pedidos, searchTerm, filterStatus]);

  // Paginação
  const indexOfLastPedido = currentPage * pedidosPerPage;
  const indexOfFirstPedido = indexOfLastPedido - pedidosPerPage;
  const currentPedidos = filteredPedidos.slice(indexOfFirstPedido, indexOfLastPedido);
  const totalPages = Math.ceil(filteredPedidos.length / pedidosPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => navigate("/pedidos/novo")} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Pedido
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4" />
              {filterStatus === "todos" ? "Todos os Status" : filterStatus}
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterStatus("todos")}>
              Todos os Status
            </DropdownMenuItem>
            {Object.values(PedidoStatus).map((status) => (
              <DropdownMenuItem key={status} onClick={() => setFilterStatus(status)}>
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(pedidosPerPage)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-md">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-grow">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {isMobile ? (
            <div className="space-y-4">
              {currentPedidos.map((pedido) => (
                <div key={pedido.id} className="border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg">Pedido #{pedido.id}</h3>
                    <div
                      onClick={() => handleOpenStatusModal(pedido)} // Adicionado onClick aqui para mobile
                      className="cursor-pointer"
                    >
                      {getStatusBadge(pedido.status)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Cliente: {pedido.nome_cliente}
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">
                    Valor Total:{" "}
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(pedido.valor_total)}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Data:{" "}
                    {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/pedidos/${pedido.id}`)}
                      className="flex-grow"
                    >
                      <Edit className="mr-2 h-4 w-4" /> Detalhes
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOpenDeleteModal(pedido)}
                      className="flex-grow"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">{pedido.id}</TableCell>
                      <TableCell>{pedido.nome_cliente}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(pedido.valor_total)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            {getStatusBadge(pedido.status)}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {Object.values(PedidoStatus).map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => {
                                  setSelectedPedido(pedido); // Define o pedido selecionado
                                  setNewStatus(status); // Define o novo status
                                  handleUpdateStatus(); // Chama a função de atualização
                                }}
                              >
                                {status}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/pedidos/${pedido.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenDeleteModal(pedido)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={paginate}
          />
        </>
      )}

      {/* Modal de Alteração de Status */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status do Pedido #{selectedPedido?.id}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={newStatus} onValueChange={(value: PedidoStatus) => setNewStatus(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PedidoStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateStatus}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>
            Tem certeza de que deseja excluir o pedido #
            {pedidoToDelete?.id} do cliente {pedidoToDelete?.nome_cliente}?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeletePedido}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pedidos;