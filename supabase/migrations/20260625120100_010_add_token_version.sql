-- SEC-012 — JWT revocation. 90-day tokens previously had no kill switch:
-- a password reset did not invalidate existing sessions. token_version is embedded
-- in the JWT at login and bumped on password reset; authenticated endpoints reject
-- a token whose version is stale.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
