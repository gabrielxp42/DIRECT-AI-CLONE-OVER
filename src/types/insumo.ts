export interface Insumo {
    id: string;
    user_id: string;
    nome: string;
    quantidade_atual: number;
    quantidade_inicial: number;
    unidade: string;
    quantidade_minima: number;
    custo_unitario: number;
    created_at?: string;
    updated_at?: string;
}

export type NewInsumo = Omit<Insumo, 'id' | 'created_at' | 'updated_at'>;
