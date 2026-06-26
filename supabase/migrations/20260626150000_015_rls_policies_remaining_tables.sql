-- SEC-022: Add RLS policies for scan_log, pnl_expenses, growth_cache, settings.
-- These tables had RLS enabled (deny-by-default) but no explicit policies.
-- All Edge Functions use service-role key (bypasses RLS) so isolation is currently
-- application-layer. These policies provide defense-in-depth if key ever changes.

-- ============================================================
-- scan_log
-- ============================================================

CREATE POLICY "scan_log_select_own"
ON public.scan_log FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "scan_log_insert_own"
ON public.scan_log FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

-- scan_log rows are never updated or deleted by users

-- ============================================================
-- pnl_expenses
-- ============================================================

CREATE POLICY "pnl_expenses_select_own"
ON public.pnl_expenses FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "pnl_expenses_insert_own"
ON public.pnl_expenses FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "pnl_expenses_update_own"
ON public.pnl_expenses FOR UPDATE
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "pnl_expenses_delete_own"
ON public.pnl_expenses FOR DELETE
USING (user_id = (current_setting('app.user_id', true))::integer);

-- ============================================================
-- growth_cache
-- ============================================================

CREATE POLICY "growth_cache_select_own"
ON public.growth_cache FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "growth_cache_insert_own"
ON public.growth_cache FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "growth_cache_update_own"
ON public.growth_cache FOR UPDATE
USING (user_id = (current_setting('app.user_id', true))::integer);

-- ============================================================
-- settings
-- ============================================================

CREATE POLICY "settings_select_own"
ON public.settings FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "settings_insert_own"
ON public.settings FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "settings_update_own"
ON public.settings FOR UPDATE
USING (user_id = (current_setting('app.user_id', true))::integer);
