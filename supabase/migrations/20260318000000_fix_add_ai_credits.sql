-- ========================================================
-- BUGFIX: AICREDIT ADDITION FUNCTION
-- ========================================================
-- This function handles gifting and recharging AI credits.
-- It is called from the Admin page and the Asaas Webhook.
-- ========================================================

CREATE OR REPLACE FUNCTION add_ai_credits(
    p_user_id UUID,
    p_amount INT,
    p_payment_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Crédito Adicionado'
)
RETURNS void AS $$
BEGIN
    -- 1. Update profiles_v2 (Standard for new Launcher)
    UPDATE profiles_v2
    SET ai_credits = COALESCE(ai_credits, 0) + p_amount
    WHERE id = p_user_id;

    -- 2. Update profiles (Legacy/Compatibility)
    -- Just in case some systems still rely on the old table
    UPDATE profiles
    SET ai_credits = COALESCE(ai_credits, 0) + p_amount
    WHERE id = p_user_id;
    
    -- Note: If you have a transactions table, you could log it here.
    -- Example:
    -- INSERT INTO ai_transactions (user_id, amount, type, description, payment_id)
    -- VALUES (p_user_id, p_amount, 'credit', p_description, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
