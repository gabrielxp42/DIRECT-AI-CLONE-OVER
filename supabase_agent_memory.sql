-- ============================================
-- SISTEMA DE MEMÓRIA PARA AGENTE AI
-- ============================================
-- Este script cria as tabelas necessárias para
-- implementar memória persistente na agente AI
-- ============================================

-- 1. Tabela de Conversas
-- Armazena cada conversa/sessão do usuário com a agente
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Título gerado automaticamente baseado na primeira mensagem
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Mensagens
-- Armazena cada mensagem da conversa
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  content TEXT,
  function_call JSONB, -- Para armazenar chamadas de função
  function_result JSONB, -- Para armazenar resultados de função
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Memórias (Long-term Memory)
-- Armazena fatos, preferências e insights aprendidos
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'pattern', 'insight', 'context')),
  category TEXT, -- Ex: 'cliente', 'produto', 'processo', 'negócio'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- Memórias podem expirar
);

-- 4. Tabela de Insights da Agente
-- Armazena análises e padrões detectados automaticamente
CREATE TABLE IF NOT EXISTS agent_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- Ex: 'trend', 'anomaly', 'recommendation'
  title TEXT NOT NULL,
  description TEXT,
  data JSONB, -- Dados que suportam o insight
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE -- Quando o usuário viu/reconheceu
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON agent_conversations(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON agent_conversations(user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON agent_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON agent_messages(conversation_id, role);

CREATE INDEX IF NOT EXISTS idx_memory_user_id ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON agent_memory(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_category ON agent_memory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memory_accessed ON agent_memory(last_accessed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON agent_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_active ON agent_insights(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_insights_type ON agent_insights(user_id, insight_type);

-- ============================================
-- FUNÇÕES ÚTEIS
-- ============================================

-- Função para buscar memórias relevantes
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_min_importance FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  category TEXT,
  content TEXT,
  importance FLOAT,
  access_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Atualiza o contador de acesso e última data de acesso
  UPDATE agent_memory
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE user_id = p_user_id
    AND importance >= p_min_importance
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Retorna as memórias mais importantes e recentes
  RETURN QUERY
  SELECT 
    m.id,
    m.memory_type,
    m.category,
    m.content,
    m.importance,
    m.access_count,
    m.created_at
  FROM agent_memory m
  WHERE m.user_id = p_user_id
    AND m.importance >= p_min_importance
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY 
    m.importance DESC,
    m.last_accessed_at DESC NULLS LAST,
    m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Função para criar ou atualizar memória
CREATE OR REPLACE FUNCTION upsert_memory(
  p_user_id UUID,
  p_memory_type TEXT,
  p_category TEXT,
  p_content TEXT,
  p_importance FLOAT DEFAULT 0.5,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
  v_existing_id UUID;
BEGIN
  -- Verifica se já existe uma memória similar
  SELECT id INTO v_existing_id
  FROM agent_memory
  WHERE user_id = p_user_id
    AND memory_type = p_memory_type
    AND category = p_category
    AND content = p_content
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Atualiza a memória existente (aumenta importância)
    UPDATE agent_memory
    SET 
      importance = LEAST(1.0, importance + 0.1),
      access_count = access_count + 1,
      last_accessed_at = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_memory_id;
  ELSE
    -- Cria nova memória
    INSERT INTO agent_memory (
      user_id,
      conversation_id,
      memory_type,
      category,
      content,
      importance
    ) VALUES (
      p_user_id,
      p_conversation_id,
      p_memory_type,
      p_category,
      p_content,
      p_importance
    )
    RETURNING id INTO v_memory_id;
  END IF;

  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar memórias antigas/irrelevantes
CREATE OR REPLACE FUNCTION cleanup_old_memories()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_temp_count INTEGER;
BEGIN
  -- Remove memórias expiradas
  DELETE FROM agent_memory
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_deleted_count := v_deleted_count + v_temp_count;
  
  -- Remove memórias com baixa importância e pouco acesso
  DELETE FROM agent_memory
  WHERE importance < 0.2
    AND access_count < 3
    AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_deleted_count := v_deleted_count + v_temp_count;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_insights ENABLE ROW LEVEL SECURITY;

-- Políticas para agent_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON agent_conversations;
CREATE POLICY "Users can view their own conversations"
  ON agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversations" ON agent_conversations;
CREATE POLICY "Users can insert their own conversations"
  ON agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON agent_conversations;
CREATE POLICY "Users can update their own conversations"
  ON agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON agent_conversations;
CREATE POLICY "Users can delete their own conversations"
  ON agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para agent_messages
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON agent_messages;
CREATE POLICY "Users can view messages from their conversations"
  ON agent_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE id = agent_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON agent_messages;
CREATE POLICY "Users can insert messages to their conversations"
  ON agent_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE id = agent_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Políticas para agent_memory
DROP POLICY IF EXISTS "Users can view their own memories" ON agent_memory;
CREATE POLICY "Users can view their own memories"
  ON agent_memory FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own memories" ON agent_memory;
CREATE POLICY "Users can insert their own memories"
  ON agent_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own memories" ON agent_memory;
CREATE POLICY "Users can update their own memories"
  ON agent_memory FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own memories" ON agent_memory;
CREATE POLICY "Users can delete their own memories"
  ON agent_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para agent_insights
DROP POLICY IF EXISTS "Users can view their own insights" ON agent_insights;
CREATE POLICY "Users can view their own insights"
  ON agent_insights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own insights" ON agent_insights;
CREATE POLICY "Users can update their own insights"
  ON agent_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para atualizar last_message_at em conversas
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_conversations
  SET 
    last_message_at = NEW.created_at,
    message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON agent_messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE agent_conversations IS 'Armazena sessões de conversa entre usuário e agente AI';
COMMENT ON TABLE agent_messages IS 'Armazena mensagens individuais de cada conversa';
COMMENT ON TABLE agent_memory IS 'Armazena memórias de longo prazo da agente (fatos, preferências, padrões)';
COMMENT ON TABLE agent_insights IS 'Armazena insights e análises geradas automaticamente pela agente';

COMMENT ON FUNCTION get_relevant_memories IS 'Busca as memórias mais relevantes para o contexto atual';
COMMENT ON FUNCTION upsert_memory IS 'Cria ou atualiza uma memória, evitando duplicatas';
COMMENT ON FUNCTION cleanup_old_memories IS 'Remove memórias antigas ou irrelevantes para economizar espaço';
