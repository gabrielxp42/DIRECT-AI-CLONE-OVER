import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

export async function debitTokens(accessToken: string, amount: number, reason: string) {
  console.log('[TOKEN_ACTION] Debiting tokens:', { amount, reason });
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  // Ensure amount is an integer as required by the RPC function
  const amountInt = Math.floor(amount);

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('[TOKEN_ACTION] Auth error:', authError);
    throw new Error('Unauthorized or invalid token')
  }

  const { data, error } = await supabase.rpc('debit_user_tokens', {
    p_user_uid: user.id,
    p_amount: amountInt,
    p_reason: reason,
    p_metadata: {}
  })

  if (error) {
    console.error('[TOKEN_ACTION] Debit error:', error)
    throw new Error(error.message)
  }
  
  console.log('[TOKEN_ACTION] Debit success:', data);
  return data
}

export async function creditTokens(accessToken: string, amount: number, reason: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  // Ensure amount is an integer
  const amountInt = Math.floor(amount);

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized or invalid token')
  }

  const { data, error } = await supabase.rpc('credit_user_tokens', {
    p_user_uid: user.id,
    p_amount: amountInt,
    p_reason: reason,
    p_metadata: {}
  })

  if (error) {
    console.error('Credit error:', error)
    throw new Error(error.message)
  }

  return data
}
