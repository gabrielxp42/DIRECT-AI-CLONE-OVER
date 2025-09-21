import { Cliente } from './cliente';
import { Produto } from './produto';

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
  produtos?: Produto;
}

export interface Servico {
  id: string;
  pedido_id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface StatusHistoryItem {
  id: string;
  pedido_id: string;
  status_anterior: string;
  status_novo: string;
  observacao: string | null;
  created_at: string;
  user_id: string | null;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  user_id: string;
  valor_total: number;
  subtotal_produtos: number;
  subtotal_servicos: number;
  desconto_valor: number;
  desconto_percentual: number;
  status: 'pendente' | 'processando' | 'enviado' | 'entregue' | 'cancelado' | 'pago' | 'aguardando retirada'; // Tipos de status atualizados
  observacoes: string | null;
  created_at: string;
  order_number: number;
  clientes: Cliente;
  pedido_items: PedidoItem[];
  servicos: Servico[];
  status_history?: StatusHistoryItem[]; // Adicionado para armazenar o histórico completo
  latest_status_observation?: string | null; // Adicionado para exibir a última observação no card
}

export interface NewPedidoItem {
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
}

export interface NewServico {
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface NewPedido {
  cliente_id: string;
  user_id: string;
  valor_total: number;
  subtotal_produtos: number;
  subtotal_servicos: number;
  desconto_valor?: number;
  desconto_percentual?: number;
  status: 'pendente' | 'processando' | 'enviado' | 'entregue' | 'cancelado' | 'pago' | 'aguardando retirada'; // Tipos de status atualizados
  observacoes?: string;
  items: NewPedidoItem[];
  servicos?: NewServico[];
}