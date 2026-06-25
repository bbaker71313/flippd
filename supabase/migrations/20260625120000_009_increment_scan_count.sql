-- §5.1 — Atomic scan-count increment, replacing the read-then-write race in
-- claude-proxy (two concurrent scans could both read N and both write N+1).
-- Folds the monthly reset into the same call so the whole op is atomic.
-- p_limit NULL = unlimited. Raises 'scan_limit_reached' when at/over limit.

CREATE OR REPLACE FUNCTION public.increment_scan_count(p_user_id integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
BEGIN
  -- Monthly reset: if the last reset was in a prior calendar month, zero first.
  UPDATE public.users
  SET scan_count_month = 0,
      scan_reset_date = CURRENT_DATE
  WHERE id = p_user_id
    AND to_char(scan_reset_date, 'YYYY-MM') < to_char(CURRENT_DATE, 'YYYY-MM');

  -- Atomic increment guarded by the tier limit.
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
