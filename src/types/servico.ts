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