-- Store eBay OAuth tokens per user so the app can sync listings/inventory via the eBay API.
ALTER TABLE public.users
  ADD COLUMN ebay_access_token    text,
  ADD COLUMN ebay_refresh_token   text,
  ADD COLUMN ebay_token_expires_at timestamp,
  ADD COLUMN ebay_username        varchar(100);
