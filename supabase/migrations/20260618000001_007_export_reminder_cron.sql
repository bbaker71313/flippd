-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add export reminder preferences to settings table
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS export_reminder_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS export_reminder_time    time    DEFAULT '09:00';

-- Hourly function: call export-reminder edge function for each eligible user
CREATE OR REPLACE FUNCTION public.send_export_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  r            RECORD;
  current_hour integer;
BEGIN
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::integer;

  FOR r IN
    SELECT DISTINCT i.user_id
    FROM   public.inventory i
    JOIN   public.settings  s ON s.user_id = i.user_id
    WHERE  i.status = 'Ready to Export'
      AND  s.export_reminder_enabled = true
      AND  EXTRACT(HOUR FROM s.export_reminder_time)::integer = current_hour
  LOOP
    PERFORM net.http_post(
      url     := 'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/export-reminder',
      body    := jsonb_build_object('userId', r.user_id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END LOOP;
END;
$$;

-- Schedule: run once per hour at :00 UTC
SELECT cron.schedule(
  'export-reminders-hourly',
  '0 * * * *',
  'SELECT public.send_export_reminders()'
);
