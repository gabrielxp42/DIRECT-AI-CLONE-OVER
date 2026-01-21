export type UnidadeMedida = 'metro' | 'unidade';

export interface TipoProducaoInsumo {
    id: string;
    tipo_producao_id: string;
    insumo_id: string;
    consumo: number;
    insumos?: {
        nome: string;
        unidade: string;
    };
}

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
    tipo_producao_insumos?: TipoProducaoInsumo[];
}

export type NewTipoProducao = Omit<TipoProducao, 'id' | 'created_at' | 'updated_at' | 'tipo_producao_insumos'>;
