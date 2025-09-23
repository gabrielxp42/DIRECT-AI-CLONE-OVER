import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYmp6cnBnbGlxaWN3dm5jZnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2ODI3MzUsImV4cCI6MjA3MzI1ODczNX0.VOrT3YAVhCqkbSmV-POeb4sVTg1_9vCr4";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    // Persist session in localStorage by default
    persistSession: true,
    // Detect session from URL on redirect
    detectSessionInUrl: true,
    // Always use localStorage for session persistence
    storage: localStorage,
  }
});