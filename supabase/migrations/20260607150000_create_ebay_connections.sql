-- ============================================================
-- ebay_connections: stores per-user eBay OAuth tokens
-- One row per user — replaces dead Replit-backend eBay storage
-- ============================================================

CREATE TABLE public.ebay_connections (
  id                 serial PRIMARY KEY,
  user_id            integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  ebay_username      varchar(100),
  access_token       text NOT NULL,
  refresh_token      text NOT NULL,
  expires_at         timestamp NOT NULL,
  refresh_expires_at timestamp NOT NULL,
  connected_at       timestamp DEFAULT now()
);

CREATE INDEX idx_ebay_connections_user ON public.ebay_connections(user_id);

ALTER TABLE public.ebay_connections ENABLE ROW LEVEL SECURITY;

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
