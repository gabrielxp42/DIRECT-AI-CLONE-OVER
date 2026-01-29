-- FUNÇÃO DE SEGURANÇA PARA ESTOQUE (RACE CONDITION PROOF)
-- Execute este script no SQL Editor do Supabase para blindar seu estoque.

CREATE OR REPLACE FUNCTION update_insumo_quantity_atomic(
  p_insumo_id UUID,
  p_quantity_change NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualiza o estoque somando (ou subtraindo se negativo) o valor passado
  -- A operação é atômica: o banco trava a linha durante o update, impedindo
  -- que dois usuários sobrescrevam o valor um do outro.
  UPDATE insumos
  SET quantidade_atual = COALESCE(quantidade_atual, 0) + p_quantity_change
  WHERE id = p_insumo_id;
END;
$$;
