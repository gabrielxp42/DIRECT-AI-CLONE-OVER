-- ============================================
-- ATUALIZAÇÃO RAG VETORIAL (pgvector)
-- ============================================

-- 1. Habilitar a extensão pgvector (Crucial para RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Adicionar coluna de embedding na tabela de memórias
-- Usaremos 1536 dimensões (padrão do text-embedding-3-small da OpenAI)
ALTER TABLE agent_memory 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Índice para busca vetorial rápida (IVFFlat)
-- Melhora performance e economia em bancos grandes
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding 
ON agent_memory 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Função de Busca Híbrida (Semântica + Filtros)
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    agent_memory.id,
    agent_memory.content,
    agent_memory.memory_type,
    1 - (agent_memory.embedding <=> query_embedding) as similarity
  FROM agent_memory
  WHERE 1 - (agent_memory.embedding <=> query_embedding) > match_threshold
  AND agent_memory.user_id = p_user_id
  ORDER BY agent_memory.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Atualizar a tabela de produtos para permitir busca semântica também (Opcional, mas recomendado)
-- Se quiser buscar produtos por descrição semântica no futuro
-- ALTER TABLE produtos ADD COLUMN IF NOT EXISTS embedding vector(1536);
