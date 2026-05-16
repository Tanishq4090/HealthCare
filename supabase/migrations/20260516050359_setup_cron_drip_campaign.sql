-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule the edge function to run every hour
SELECT cron.schedule(
  'hourly-drip',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
      url:='https://sgyladamwnanudnropwl.supabase.co/functions/v1/scheduled-followup',
      headers:='{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
