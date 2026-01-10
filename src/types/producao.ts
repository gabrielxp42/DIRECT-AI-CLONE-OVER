export type UnidadeMedida = 'metro' | 'unidade';

export interface TipoProducao {
    id: string;
    user_id: string;
    organization_id?: string;
    nome: string;
    unidade_medida: UnidadeMedida;
    order_index: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type NewTipoProducao = Omit<TipoProducao, 'id' | 'created_at' | 'updated_at'>;
