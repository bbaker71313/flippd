-- Add last_login_at for churn tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at timestamp;

-- Enable pg_cron (Pro plan required; safe no-op on free plan if extension doesn't exist)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Nightly at 2am UTC: downgrade expired trial users to scout
SELECT cron.schedule(
  'sfp-trial-expiry',
  '0 2 * * *',
  $$
    UPDATE public.users
    SET tier = 'scout'
    WHERE tier = 'trial'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < now();
  $$
);
