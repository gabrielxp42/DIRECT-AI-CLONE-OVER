import { supabase } from '@/integrations/supabase/client';

export async function debitTokens(_accessToken: string, amount: number, reason: string) {
  console.log('[TOKEN_ACTION] Debiting tokens:', { amount, reason });
  
  // Ensure amount is an integer as required by the RPC function
  const amountInt = Math.floor(amount);

  const run = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const user = session?.user;
    if (!session || !user) {
      throw new Error('Unauthorized or invalid token');
    }

    const { data, error } = await supabase.rpc('debit_user_tokens', {
      p_user_uid: user.id,
      p_amount: amountInt,
      p_reason: reason,
      p_metadata: {}
    });

    if (error) {
      console.error('[TOKEN_ACTION] Debit error:', error);
      throw new Error(error.message);
    }

    return data;
  };

  try {
    const data = await run();
    console.log('[TOKEN_ACTION] Debit success:', data);
    return data;
  } catch (err: any) {
    const message = err?.message || '';
    const needsRefresh = typeof message === 'string' && message.toLowerCase().includes('jwt expired');
    if (!needsRefresh) throw err;

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw err;

    const data = await run();
    console.log('[TOKEN_ACTION] Debit success (after refresh):', data);
    return data;
  }
  
}

export async function creditTokens(_accessToken: string, amount: number, reason: string) {
  // Ensure amount is an integer
  const amountInt = Math.floor(amount);

  const run = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const user = session?.user;
    if (!session || !user) {
      throw new Error('Unauthorized or invalid token');
    }

    const { data, error } = await supabase.rpc('credit_user_tokens', {
      p_user_uid: user.id,
      p_amount: amountInt,
      p_reason: reason,
      p_metadata: {}
    });

    if (error) {
      console.error('Credit error:', error);
      throw new Error(error.message);
    }

    return data;
  };

  try {
    return await run();
  } catch (err: any) {
    const message = err?.message || '';
    const needsRefresh = typeof message === 'string' && message.toLowerCase().includes('jwt expired');
    if (!needsRefresh) throw err;

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw err;

    return await run();
  }
}
