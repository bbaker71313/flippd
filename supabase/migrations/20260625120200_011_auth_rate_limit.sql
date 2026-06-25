-- SEC-011 — rate limiting for /login, /register, /reset-request.
-- Fixed-window counter keyed by an arbitrary bucket string (e.g. "login:<ip>").
-- check_rate_limit() atomically upserts the counter and returns whether the
-- caller is still under the limit. Accessed only via service-role (RLS denies anon).

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket       text PRIMARY KEY,
  attempts     integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access; service-role bypasses RLS.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text, p_max integer, p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts integer;
BEGIN
  INSERT INTO public.auth_rate_limits (bucket, attempts, window_start)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE
  SET attempts = CASE
        WHEN public.auth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        THEN 1
        ELSE public.auth_rate_limits.attempts + 1
      END,
      window_start = CASE
        WHEN public.auth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        THEN now()
        ELSE public.auth_rate_limits.window_start
      END
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts <= p_max;
END;
$$;
