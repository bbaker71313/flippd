-- Repository-health repair: this table was created directly against production on
-- 2026-06-07 (recorded in supabase's schema_migrations history as version
-- 20260607170846 / name "create_ebay_connections") but the migration file itself was
-- never committed to the repo. That left 013_encrypt_ebay_tokens.sql referencing
-- public.ebay_connections with no earlier committed migration creating it, so a clean
-- database rebuild (Supabase Preview) failed.
--
-- Reconstructed verbatim from the live production schema (information_schema.columns,
-- pg_constraint, pg_indexes, pg_policies on project dqgfpchkheznvanfgsmx) so a fresh
-- database matches production exactly. The version prefix on this filename matches
-- production's already-recorded migration version, so applying this to production is
-- a no-op there (already marked applied) — only fresh/preview databases actually run it.
CREATE TABLE public.ebay_connections (
  id                      serial PRIMARY KEY,
  user_id                 integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  ebay_username           varchar(100),
  access_token            text NOT NULL,
  refresh_token           text NOT NULL,
  expires_at              timestamp NOT NULL,
  refresh_expires_at      timestamp NOT NULL,
  connected_at            timestamp DEFAULT now(),
  oauth_nonce             varchar(64),
  oauth_nonce_expires_at  timestamptz
);

ALTER TABLE public.ebay_connections ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ebay_connections_user ON public.ebay_connections(user_id);

CREATE POLICY "ebay_connections_select_own"
ON public.ebay_connections FOR SELECT
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "ebay_connections_insert_own"
ON public.ebay_connections FOR INSERT
WITH CHECK (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "ebay_connections_update_own"
ON public.ebay_connections FOR UPDATE
USING (user_id = (current_setting('app.user_id', true))::integer);

CREATE POLICY "ebay_connections_delete_own"
ON public.ebay_connections FOR DELETE
USING (user_id = (current_setting('app.user_id', true))::integer);
