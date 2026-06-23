-- Replace cookie-based CSRF nonce with database-stored nonce.
-- Cookies set by cross-origin fetch() responses cannot be stored by browsers
-- when CORS uses Access-Control-Allow-Origin: * (credentials disallowed).
-- Storing the nonce server-side is CORS-safe and works in all browsers.
ALTER TABLE IF EXISTS public.ebay_connections
  ADD COLUMN IF NOT EXISTS oauth_nonce             VARCHAR(64)  NULL,
  ADD COLUMN IF NOT EXISTS oauth_nonce_expires_at  TIMESTAMPTZ  NULL;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS ebay_oauth_nonce             VARCHAR(64)  NULL,
  ADD COLUMN IF NOT EXISTS ebay_oauth_nonce_expires_at  TIMESTAMPTZ  NULL;
