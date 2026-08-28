-- Performance-advisor cleanup.
--
-- Removes four obsolete FOR ALL policies that overlap the intentionally
-- granular policies added by migration 015, caches app.user_id once per
-- statement instead of once per row, adds ownership WITH CHECK guards to
-- UPDATE policies, and removes a redundant waitlist email index.
--
-- Unused-index INFO notices are intentionally not acted on here: those indexes
-- support low-frequency/new workflows and need representative production
-- traffic before removal is safe.

DROP POLICY IF EXISTS growth_cache_own_rows ON public.growth_cache;
DROP POLICY IF EXISTS pnl_expenses_own_rows ON public.pnl_expenses;
DROP POLICY IF EXISTS scan_log_own_rows ON public.scan_log;
DROP POLICY IF EXISTS settings_own_rows ON public.settings;

ALTER POLICY ebay_connections_select_own ON public.ebay_connections
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY ebay_connections_insert_own ON public.ebay_connections
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY ebay_connections_update_own ON public.ebay_connections
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY ebay_connections_delete_own ON public.ebay_connections
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY growth_cache_select_own ON public.growth_cache
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY growth_cache_insert_own ON public.growth_cache
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY growth_cache_update_own ON public.growth_cache
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY inventory_select_own ON public.inventory
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY inventory_insert_own ON public.inventory
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY inventory_update_own ON public.inventory
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY inventory_delete_own ON public.inventory
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY pnl_expenses_select_own ON public.pnl_expenses
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY pnl_expenses_insert_own ON public.pnl_expenses
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY pnl_expenses_update_own ON public.pnl_expenses
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY pnl_expenses_delete_own ON public.pnl_expenses
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY scan_log_select_own ON public.scan_log
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY scan_log_insert_own ON public.scan_log
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY settings_select_own ON public.settings
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY settings_insert_own ON public.settings
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY settings_update_own ON public.settings
  USING (user_id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (user_id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER POLICY users_select_own ON public.users
  USING (id = ((SELECT current_setting('app.user_id', true)))::integer);
ALTER POLICY users_update_own ON public.users
  USING (id = ((SELECT current_setting('app.user_id', true)))::integer)
  WITH CHECK (id = ((SELECT current_setting('app.user_id', true)))::integer);

ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_email_unique;
