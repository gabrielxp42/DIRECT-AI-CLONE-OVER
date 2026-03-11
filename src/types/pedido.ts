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
  tipo?: 'dtf' | 'vinil';
  produtos?: Produto;
  ordem?: number;
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

export type PedidoStatus = 'pendente' | 'processando' | 'enviado' | 'entregue' | 'cancelado' | 'pago' | 'aguardando retirada';
export type ProductionStatus = 'design' | 'queued' | 'printing' | 'finishing' | 'ready';

export interface Pedido {
  id: string;
  cliente_id: string;
  user_id: string;
  organization_id?: string | null;
  valor_total: number;
  subtotal_produtos: number;
  subtotal_servicos: number;
  desconto_valor: number;
  desconto_percentual: number;
  total_metros: number; // Total de metros lineares
  total_metros_dtf: number;
  total_metros_vinil: number;
  status: PedidoStatus; // Tipos de status atualizados
  observacoes: string | null;
  tipo_entrega?: 'frete' | 'retirada';
  valor_frete?: number;
  transportadora?: string | null;
  tracking_code?: string | null;
  shipping_label_id?: string | null;
  shipping_label_status?: string | null;
  shipping_cep?: string | null;
  shipping_details?: any | null;
  production_status: ProductionStatus;
  created_at: string;
  pago_at: string | null;
  order_number: number;
  clientes: Cliente;
  pedido_items: PedidoItem[];
  servicos: Servico[];
  status_history?: StatusHistoryItem[]; // Adicionado para armazenar o histórico completo
  latest_status_observation?: string | null; // Adicionado para exibir a última observação no card
}

export interface NewPedidoItem {
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
  tipo: 'dtf' | 'vinil';
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
  total_metros: number; // Total de metros lineares
  total_metros_dtf: number;
  total_metros_vinil: number;
  status: PedidoStatus; // Status de pagamento/geral
  pago_at?: string | null;
  observacoes?: string;
  tipo_entrega?: 'frete' | 'retirada';
  valor_frete?: number;
  transportadora?: string | null;
  items: NewPedidoItem[];
  servicos?: NewServico[];
}