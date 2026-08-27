-- P2-27: durable retry queue for important transactional email (verification,
-- billing) that fails to send on the first attempt. Service-role/edge-function
-- only, mirroring the stripe_webhook_events pattern: RLS enabled, no user
-- policies, since this is internal delivery-tracking state, never queried by
-- an end-user session.

CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email            text NOT NULL,
  subject             text NOT NULL,
  html                text NOT NULL,
  category            text NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'dead')),
  attempts            integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 5,
  last_error          text,
  provider_message_id text,
  next_attempt_at     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_log_due_idx
  ON public.email_delivery_log (next_attempt_at)
  WHERE status = 'pending';

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
-- RLS enabled with no policy = default-deny for anon/authenticated. Only the
-- service-role client used by the `auth`, `stripe-webhook`, and `cron` edge
-- functions can read/write this table.
