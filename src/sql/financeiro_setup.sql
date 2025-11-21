-- Tabela de Despesas
CREATE TABLE IF NOT EXISTS despesas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    categoria TEXT, -- 'fixa', 'variavel', 'insumo', 'pessoal'
    status TEXT DEFAULT 'pendente', -- 'pendente', 'pago', 'atrasado'
    comprovante_url TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas RLS (Row Level Security)
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar duplicação se rodar de novo
DROP POLICY IF EXISTS "Usuários podem ver suas próprias despesas" ON despesas;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias despesas" ON despesas;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias despesas" ON despesas;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias despesas" ON despesas;

CREATE POLICY "Usuários podem ver suas próprias despesas" ON despesas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias despesas" ON despesas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias despesas" ON despesas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias despesas" ON despesas
    FOR DELETE USING (auth.uid() = user_id);
