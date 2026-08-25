-- Repository-health follow-up to 20260607170846_create_ebay_connections.sql.
-- 20260603000000_005_add_ebay_oauth_columns.sql added ebay_access_token/ebay_refresh_token/
-- ebay_token_expires_at/ebay_username to public.users for an early "tokens as user columns"
-- design. That was abandoned in favor of the separate public.ebay_connections table before
-- migration 005 was ever applied to production — confirmed via live schema introspection that
-- production's users table has never had these columns, and a repo-wide search found no code
-- (Edge Functions, app.html, packages/shared) reading or writing them; every live ebay_username/
-- token read-write targets public.ebay_connections only.
--
-- Historical migration 005 is left as committed history (do not edit it — see project
-- guardrails). This migration removes the dead columns it created so a fresh database matches
-- production. IF EXISTS makes this a no-op against production, which never had them.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS ebay_access_token,
  DROP COLUMN IF EXISTS ebay_refresh_token,
  DROP COLUMN IF EXISTS ebay_token_expires_at,
  DROP COLUMN IF EXISTS ebay_username;
