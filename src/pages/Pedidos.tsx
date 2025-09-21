import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/contexts/SessionProvider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Eye, Edit, Trash2, ArrowUpDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditableStatusBadge } from '@/components/EditableStatusBadge'; // Importar o novo componente
import { useUpdateOrderStatus } from '@/hooks/useUpdateOrderStatus'; // Importar o novo hook
import { toast } from 'react-hot-toast';

interface Pedido {
  id: string;
  cliente_id: string;
  valor_total: number;
  status: string;
  created_at: string;
  clientes: {
    nome: string;
  };
}

const Pedidos = () => {
  const { supabase } = useSession();
  const location = useLocation();
  const filterStatusFromState = location.state?.filterStatus || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<keyof Pedido | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>(filterStatusFromState);

  const { mutate: updateOrderStatus, isPending: isUpdatingStatus } = useUpdateOrderStatus();

  const { data: pedidos, isLoading, error } = useQuery<Pedido[]>({
    queryKey: ['pedidos', statusFilter],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not available');
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nome)');

      if (statusFilter && statusFilter !== 'todos') {
        if (statusFilter === 'pendente-pagamento') {
          query = query.not('status', 'in', '("pago", "cancelado", "entregue")');
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as Pedido[];
    },
    enabled: !!supabase,
  });

  const filteredPedidos = useMemo(() => {
    let filtered = pedidos || [];

    if (searchTerm) {
      filtered = filtered.filter(
        (pedido) =>
          pedido.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pedido.clientes.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pedido.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortColumn) {
      filtered = filtered.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }

    return filtered;
  }, [pedidos, searchTerm, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredPedidos.length / itemsPerPage);
  const paginatedPedidos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPedidos.slice(startIndex, endIndex);
  }, [filteredPedidos, currentPage, itemsPerPage]);

  const handleSort = (column: keyof Pedido) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrderStatus({ orderId, newStatus });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando pedidos...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erro ao carregar pedidos: {error.message}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Pedidos</h1>

      <div className="flex flex-col md:flex-row items-center justify-between mb-6 space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedidos..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente-pagamento">Faltam Pagar</SelectItem>
              <SelectItem value="aguardando retirada">Aguardando Retirada</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Link to="/pedidos/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Pedido
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <Button variant="ghost" onClick={() => handleSort('id')}>
                  ID do Pedido
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('cliente_id')}>
                  Cliente
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('valor_total')}>
                  Valor Total
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('status')}>
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPedidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhum pedido encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedPedidos.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-medium">{pedido.id.substring(0, 8)}...</TableCell>
                  <TableCell>{pedido.clientes?.nome || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(pedido.valor_total)}</TableCell>
                  <TableCell>
                    <EditableStatusBadge
                      currentStatus={pedido.status}
                      onStatusChange={(newStatus) => handleStatusChange(pedido.id, newStatus)}
                      isLoading={isUpdatingStatus}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Link to={`/pedidos/${pedido.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link to={`/pedidos/${pedido.id}/editar`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      {/* Implementar exclusão se necessário */}
                      {/* <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button> */}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              isActive={currentPage > 1}
            />
          </PaginationItem>
          {[...Array(totalPages)].map((_, index) => (
            <PaginationItem key={index}>
              <PaginationLink
                onClick={() => setCurrentPage(index + 1)}
                isActive={currentPage === index + 1}
              >
                {index + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              isActive={currentPage < totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default Pedidos;