-- ================================================
-- AI LEARNING SYSTEM - DATABASE SCHEMA
-- ================================================
-- This schema supports multi-agent AI learning system
-- using Gemini 2.5 Flash-Lite for WhatsApp automation
-- ================================================

-- Table 1: AI Agent Training Progress
CREATE TABLE IF NOT EXISTS ai_agent_training (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Training Status
  training_status TEXT DEFAULT 'learning' CHECK (training_status IN ('learning', 'ready', 'paused', 'disabled')),
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  conversations_analyzed INTEGER DEFAULT 0,
  patterns_identified INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ready_at TIMESTAMP WITH TIME ZONE, -- When it reached 85%+
  last_analysis_at TIMESTAMP WITH TIME ZONE,
  
  -- Detailed Metrics (0-100)
  similarity_score INTEGER DEFAULT 0 CHECK (similarity_score >= 0 AND similarity_score <= 100),
  coverage_score INTEGER DEFAULT 0 CHECK (coverage_score >= 0 AND coverage_score <= 100),
  tone_consistency_score INTEGER DEFAULT 0 CHECK (tone_consistency_score >= 0 AND tone_consistency_score <= 100),
  product_knowledge_score INTEGER DEFAULT 0 CHECK (product_knowledge_score >= 0 AND product_knowledge_score <= 100),
  
  -- Cost Tracking
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Table 2: AI Knowledge Base (Structured Learning)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Knowledge Type
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('business_rule', 'client_profile', 'tone', 'product', 'faq', 'exception')),
  
  -- Content (JSONB for flexibility)
  content JSONB NOT NULL,
  
  -- Metadata
  confidence DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  source_count INTEGER DEFAULT 1, -- How many conversations generated this
  last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 3: AI Training Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS ai_training_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Agent Information
  agent_type TEXT NOT NULL CHECK (agent_type IN ('extractor', 'validator', 'synthesizer', 'evaluator', 'responder')),
  action TEXT NOT NULL, -- 'pattern_found', 'rule_validated', 'knowledge_updated', 'response_generated'
  
  -- Details
  details JSONB,
  
  -- Cost of this operation
  cost_usd DECIMAL(10,6) DEFAULT 0,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 4: WhatsApp Messages (Enhanced for AI Learning)
-- Note: This extends the existing whatsapp_messages table
DO $$ 
BEGIN
  -- Check if table exists, if not create it
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_messages') THEN
    CREATE TABLE whatsapp_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;

  -- Add AI analysis columns if they don't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'analyzed') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN analyzed BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'analysis_result') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN analysis_result JSONB;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'client_name') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN client_name TEXT;
  END IF;
END $$;

-- Add Gemini API configuration to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_training_model TEXT DEFAULT 'gemini-2.5-flash-lite',
ADD COLUMN IF NOT EXISTS gemini_response_model TEXT DEFAULT 'gemini-2.5-flash',
ADD COLUMN IF NOT EXISTS ai_auto_reply_enabled BOOLEAN DEFAULT FALSE;

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_ai_training_user ON ai_agent_training(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_status ON ai_agent_training(training_status);

CREATE INDEX IF NOT EXISTS idx_knowledge_user ON ai_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON ai_knowledge_base(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON ai_knowledge_base(is_active);

CREATE INDEX IF NOT EXISTS idx_training_logs_user ON ai_training_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_logs_agent ON ai_training_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_training_logs_created ON ai_training_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_analyzed ON whatsapp_messages(analyzed);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at DESC);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE ai_agent_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own training data
CREATE POLICY "Users can view own training" ON ai_agent_training
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own training" ON ai_agent_training
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert training" ON ai_agent_training
  FOR INSERT WITH CHECK (true);

-- Users can only see their own knowledge base
CREATE POLICY "Users can view own knowledge" ON ai_knowledge_base
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage knowledge" ON ai_knowledge_base
  FOR ALL USING (true);

-- Users can view their own logs
CREATE POLICY "Users can view own logs" ON ai_training_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs" ON ai_training_logs
  FOR INSERT WITH CHECK (true);

-- Users can view their own messages
CREATE POLICY "Users can view own messages" ON whatsapp_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage messages" ON whatsapp_messages
  FOR ALL USING (true);

-- Admins can see everything
CREATE POLICY "Admins can view all training" ON ai_agent_training
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can view all knowledge" ON ai_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can view all logs" ON ai_training_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to update training progress
CREATE OR REPLACE FUNCTION update_training_progress(
  p_user_id UUID,
  p_conversations_analyzed INTEGER DEFAULT NULL,
  p_patterns_identified INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update training record
  INSERT INTO ai_agent_training (user_id, conversations_analyzed, patterns_identified, last_analysis_at)
  VALUES (p_user_id, COALESCE(p_conversations_analyzed, 0), COALESCE(p_patterns_identified, 0), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    conversations_analyzed = COALESCE(p_conversations_analyzed, ai_agent_training.conversations_analyzed),
    patterns_identified = COALESCE(p_patterns_identified, ai_agent_training.patterns_identified),
    last_analysis_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate overall confidence score
CREATE OR REPLACE FUNCTION calculate_confidence_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_similarity INTEGER;
  v_coverage INTEGER;
  v_tone INTEGER;
  v_product INTEGER;
  v_overall INTEGER;
BEGIN
  SELECT 
    similarity_score,
    coverage_score,
    tone_consistency_score,
    product_knowledge_score
  INTO v_similarity, v_coverage, v_tone, v_product
  FROM ai_agent_training
  WHERE user_id = p_user_id;
  
  -- Weighted average: 40% similarity, 30% coverage, 20% tone, 10% product
  v_overall := ROUND(
    (COALESCE(v_similarity, 0) * 0.4) +
    (COALESCE(v_coverage, 0) * 0.3) +
    (COALESCE(v_tone, 0) * 0.2) +
    (COALESCE(v_product, 0) * 0.1)
  );
  
  -- Update the confidence score
  UPDATE ai_agent_training
  SET 
    confidence_score = v_overall,
    training_status = CASE 
      WHEN v_overall >= 85 THEN 'ready'
      ELSE training_status
    END,
    ready_at = CASE 
      WHEN v_overall >= 85 AND ready_at IS NULL THEN NOW()
      ELSE ready_at
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_overall;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- SAMPLE DATA (for testing)
-- ================================================

-- This will be populated by the AI agents during training
-- Example knowledge base entry structure:

-- Business Rule Example:
-- {
--   "rule": "Pedidos acima de R$500 oferecer parcelamento",
--   "condition": "order_value > 500",
--   "action": "suggest_installments",
--   "examples": [
--     "Cliente: Quanto fica? Dono: R$600, posso parcelar em 3x sem juros"
--   ]
-- }

-- Client Profile Example:
-- {
--   "client_name": "João Silva",
--   "phone": "5511999999999",
--   "tone": "informal",
--   "preferences": ["desconto", "busca_pessoalmente"],
--   "history_summary": "15 pedidos, sempre paga à vista",
--   "special_notes": "Sempre pede desconto, dar 10% sem ele pedir"
-- }

-- Tone Example:
-- {
--   "greeting": "Oi [nome]! 👋",
--   "emoji_usage": "moderate",
--   "formality": "informal",
--   "closing": "Qualquer dúvida, é só chamar!"
-- }
