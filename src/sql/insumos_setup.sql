-- Tabela de Insumos
CREATE TABLE IF NOT EXISTS insumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade_atual DECIMAL(10,2) DEFAULT 0,
  unidade TEXT DEFAULT 'un', -- 'm', 'kg', 'l', 'un'
  quantidade_minima DECIMAL(10,2) DEFAULT 10,
  custo_unitario DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_insumos_updated_at ON insumos;
CREATE TRIGGER update_insumos_updated_at
    BEFORE UPDATE ON insumos
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RLS
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON insumos;
CREATE POLICY "Permitir leitura para autenticados" ON insumos
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir escrita para autenticados" ON insumos;
CREATE POLICY "Permitir escrita para autenticados" ON insumos
    FOR ALL USING (auth.role() = 'authenticated');

-- Função para dar baixa no estoque (será chamada via RPC ou Trigger de Pedido)
CREATE OR REPLACE FUNCTION baixar_estoque_insumo(p_insumo_id UUID, p_quantidade DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE insumos
  SET quantidade_atual = quantidade_atual - p_quantidade
  WHERE id = p_insumo_id;
END;
$$ LANGUAGE plpgsql;
