-- Hardening — pin search_path on the functions added this session (Supabase linter
-- 0011_function_search_path_mutable). All object refs are already schema-qualified,
-- so an empty search_path is safe and blocks search_path-injection.

CREATE OR REPLACE FUNCTION public.increment_scan_count(p_user_id integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.users
  SET scan_count_month = 0,
      scan_reset_date = CURRENT_DATE
  WHERE id = p_user_id
    AND to_char(scan_reset_date, 'YYYY-MM') < to_char(CURRENT_DATE, 'YYYY-MM');

  UPDATE public.users
  SET scan_count_month = scan_count_month + 1
  WHERE id = p_user_id
    AND (p_limit IS NULL OR scan_count_month < p_limit)
  RETURNING scan_count_month INTO new_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan_limit_reached';
  END IF;

  RETURN new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text, p_max integer, p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
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
