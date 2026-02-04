-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the AI Training Processor to run every 5 minutes
-- Configured Automatically by Agent on 2026-02-03
SELECT cron.schedule(
  'ai-training-cycle',
  '*/5 * * * *',
  $$
  select
    net.http_post(
      url:='https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/ai-training-processor',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYmp6cnBnbGlxaWN3dm5jZnBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY4MjczNSwiZXhwIjoyMDczMjU4NzM1fQ.8GUJAj9NB1Apxd2QKVaRhrQY2pDGdcAzYwKkxyy4jMg"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
