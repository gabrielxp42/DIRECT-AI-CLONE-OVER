export interface Servico {
  id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface NewServico {
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface ServiceShortcut {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
  is_pinned: boolean;
  usage_count: number;
  last_used: string;
  created_at: string;
  updated_at: string;
}

export type NewServiceShortcut = Omit<ServiceShortcut, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'usage_count' | 'last_used'>;