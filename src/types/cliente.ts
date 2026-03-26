export type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  valor_metro?: number | null;
  observacoes?: string | null;
  status: string;
  created_at: string;
};

export type NewCliente = Omit<Cliente, 'id' | 'created_at'> & { user_id: string };