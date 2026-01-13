export type ProdutoInsumo = {
  id: string;
  produto_id: string;
  insumo_id: string;
  consumo: number;
  insumos?: {
    nome: string;
    unidade: string;
  };
};

export type Produto = {
  id: string;
  nome: string;
  descricao?: string | null;
  preco: number;
  estoque?: number | null;
  tipo: string;
  produto_insumos?: ProdutoInsumo[];
  created_at: string;
};

export type NewProduto = Omit<Produto, 'id' | 'created_at' | 'produto_insumos'> & {
  user_id: string;
  produto_insumos?: Omit<ProdutoInsumo, 'id' | 'produto_id'>[];
};