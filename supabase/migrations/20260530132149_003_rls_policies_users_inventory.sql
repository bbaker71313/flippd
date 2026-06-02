-- ============================================================
-- RLS Policies: users table
-- Uses custom auth pattern: current_setting('app.user_id')
-- ============================================================

-- Users can read their own row
CREATE POLICY "users_select_own"
ON public.users FOR SELECT
USING (id = (current_setting('app.user_id', true))::integer);

-- Users can update their own row (no INSERT — registration is server-side)
CREATE POLICY "users_update_own"
ON public.users FOR UPDATE
USING (id = (current_setting('app.user_id', true))::integer);

-- No DELETE policy — users cannot self-delete (admin only)

-- ============================================================
-- RLS Policies: inventory table
-- ============================================================

CREATE POLICY "inventory_select_own"
ON public.inventory FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "inventory_insert_own"
ON public.inventory FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "inventory_update_own"
ON public.inventory FOR UPDATE
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "inventory_delete_own"
ON public.inventory FOR DELETE
USING (user_id = (current_setting('app.user_id', true))::integer);

-- ============================================================
-- Fix: rls_auto_enable() SECURITY DEFINER exposure
-- Revoke public/anon execute access
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

-- ============================================================
-- Fix: Mutable search_path on functions
-- ============================================================
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.trim_scan_log() SET search_path = public;
