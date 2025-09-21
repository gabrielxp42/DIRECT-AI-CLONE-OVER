export type Produto = {
  id: string;
  nome: string;
  descricao?: string | null;
  preco: number;
  estoque?: number | null;
  created_at: string;
};

export type NewProduto = Omit<Produto, 'id' | 'created_at'> & { user_id: string };