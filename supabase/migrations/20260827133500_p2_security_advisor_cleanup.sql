-- P2-30: classify and fix live security-advisor findings.
--
-- rls_enabled_no_policy on auth_rate_limits / stripe_webhook_events:
-- INTENTIONAL — DOCUMENTED. Both are internal, service-role-only state
-- (rate-limit counters; webhook idempotency ledger) never queried by an
-- end-user session — RLS enabled with no policy is correct here (default-
-- deny for anon/authenticated), not a gap. Documented via COMMENT so the
-- advisor finding reads as an intentional decision, not silently ignored.
--
-- anon/authenticated SECURITY DEFINER execution on send_export_reminders():
-- FIX. This function is only meant to run from its own pg_cron schedule
-- ('export-reminders-hourly', see migration 007) — nothing in this repo
-- calls it via the exposed /rest/v1/rpc/send_export_reminders path, and
-- letting anon/authenticated invoke a SECURITY DEFINER function directly
-- violates least privilege. Revoke, matching the pattern already used for
-- every other SECURITY DEFINER RPC in this repo (ebay_get_tokens etc.).
--
-- Public item-photos bucket/listing: FIX. Verified via code search that no
-- part of the live app (app.html or any edge function) reads from or writes
-- to this bucket today — item photos are IndexedDB-only client-side (see
-- docs/CURRENT_STATE.md). The bucket was nonetheless `public = true` with an
-- unscoped `SELECT` policy open to the `public` role (anyone, including
-- anonymous requests, could list/read every uploaded photo across every
-- user) and unscoped `INSERT`/`DELETE` policies open to any `authenticated`
-- user (any logged-in user could overwrite or delete any other user's
-- photos — no per-user ownership check at all). Since nothing legitimate
-- currently depends on that public/any-authenticated-user access, this locks
-- it down to service-role-only (RLS enabled, no client policy) rather than
-- inventing a new per-user ownership scheme this app's identity model
-- (custom integer user id, not Supabase Auth's auth.uid()) can't actually
-- express in storage RLS today. If/when this bucket is wired into the live
-- product, that access model is a product/architecture decision for that
-- work, not this cleanup pass.
--
-- Leaked-password protection: NOT APPLICABLE to this app's real login path.
-- This app's auth is 100% custom (public.users.password bcrypt hash + a
-- custom HS256 JWT via the `auth` edge function) — verified via code search
-- that no client code anywhere calls supabase.auth.signUp/signInWithPassword
-- or any other GoTrue method. Supabase's leaked-password-protection setting
-- only guards GoTrue's own password endpoints, which this app never uses,
-- so enabling it would not protect a single real user login and is not
-- toggled here. It also isn't SQL-settable (project-level Auth API config,
-- not a database object) — no migration can express it either way. See the
-- P2 remediation report for the full writeup; a HaveIBeenPwned-style check
-- inside the custom auth edge function would be the real fix and is a new
-- feature, out of scope for this classification pass.

COMMENT ON TABLE public.auth_rate_limits IS
  'Internal rate-limit counters, service-role/RPC-only. RLS enabled with no policy is intentional default-deny for anon/authenticated — not a gap (P2-30).';

COMMENT ON TABLE public.stripe_webhook_events IS
  'Internal Stripe webhook idempotency ledger, service-role/RPC-only. RLS enabled with no policy is intentional default-deny for anon/authenticated — not a gap (P2-30).';

REVOKE EXECUTE ON FUNCTION public.send_export_reminders() FROM anon, authenticated, public;

UPDATE storage.buckets SET public = false WHERE id = 'item-photos';

DROP POLICY IF EXISTS item_photos_select ON storage.objects;
DROP POLICY IF EXISTS item_photos_insert ON storage.objects;
DROP POLICY IF EXISTS item_photos_delete ON storage.objects;
-- No replacement client policy — RLS enabled with no policy, service-role
-- (edge functions) only, matching the pattern already used elsewhere.
