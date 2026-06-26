-- SEC-010 — encrypt eBay OAuth tokens at rest.
-- access_token / refresh_token were stored as plaintext in public.ebay_connections.
-- They are now stored as ASCII-armored pgcrypto PGP messages, encrypted with a
-- symmetric key held in Supabase Vault (never leaves the database). The Edge Function
-- only ever sees plaintext via these SECURITY DEFINER RPCs — it never handles the key.
--
-- ebay_username / expires_at stay plaintext: username is not a secret and the
-- /status check only needs row existence, so it never triggers a decrypt.

-- 1. Symmetric key in Vault (idempotent — keep the same key across re-runs).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ebay_token_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'ebay_token_key',
      'Symmetric key for eBay OAuth tokens at rest (SEC-010)'
    );
  end if;
end $$;

-- 2. Write path — encrypt + upsert (relies on UNIQUE(user_id)).
create or replace function public.ebay_store_tokens(
  p_user_id         integer,
  p_access          text,
  p_refresh         text,
  p_expires         timestamp,
  p_refresh_expires timestamp,
  p_username        text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'ebay_token_key';
  if v_key is null then raise exception 'ebay_token_key not found in vault'; end if;

  insert into public.ebay_connections
    (user_id, access_token, refresh_token, expires_at, refresh_expires_at, ebay_username, connected_at)
  values
    (p_user_id,
     extensions.armor(extensions.pgp_sym_encrypt(p_access,  v_key)),
     extensions.armor(extensions.pgp_sym_encrypt(p_refresh, v_key)),
     p_expires, p_refresh_expires, p_username, now())
  on conflict (user_id) do update set
    access_token       = excluded.access_token,
    refresh_token      = excluded.refresh_token,
    expires_at         = excluded.expires_at,
    refresh_expires_at = excluded.refresh_expires_at,
    ebay_username      = excluded.ebay_username,
    connected_at       = now();
end $$;

-- 3. Read path — decrypt for the refresh check.
create or replace function public.ebay_get_tokens(p_user_id integer)
returns table(access_token text, refresh_token text, expires_at timestamp, ebay_username text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'ebay_token_key';
  if v_key is null then raise exception 'ebay_token_key not found in vault'; end if;

  return query
  select
    extensions.pgp_sym_decrypt(extensions.dearmor(c.access_token),  v_key),
    extensions.pgp_sym_decrypt(extensions.dearmor(c.refresh_token), v_key),
    c.expires_at,
    c.ebay_username::text
  from public.ebay_connections c
  where c.user_id = p_user_id;
end $$;

-- 4. Refresh path — re-encrypt only the access token + new expiry.
create or replace function public.ebay_update_access_token(
  p_user_id integer, p_access text, p_expires timestamp
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'ebay_token_key';
  if v_key is null then raise exception 'ebay_token_key not found in vault'; end if;

  update public.ebay_connections
     set access_token = extensions.armor(extensions.pgp_sym_encrypt(p_access, v_key)),
         expires_at   = p_expires
   where user_id = p_user_id;
end $$;

-- 5. Lock down: these run only via service-role (Edge Functions). Block anon/authenticated.
-- NB: `from public` alone is NOT enough — Supabase grants EXECUTE to anon/authenticated
-- by default, so they must be revoked explicitly (see migration 014).
revoke all on function public.ebay_store_tokens(integer,text,text,timestamp,timestamp,text) from public, anon, authenticated;
revoke all on function public.ebay_get_tokens(integer) from public, anon, authenticated;
revoke all on function public.ebay_update_access_token(integer,text,timestamp) from public, anon, authenticated;
grant execute on function public.ebay_store_tokens(integer,text,text,timestamp,timestamp,text) to service_role;
grant execute on function public.ebay_get_tokens(integer) to service_role;
grant execute on function public.ebay_update_access_token(integer,text,timestamp) to service_role;

-- 6. Migrate existing plaintext rows → armored ciphertext (idempotent: skip already-armored).
do $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'ebay_token_key';
  update public.ebay_connections
     set access_token  = extensions.armor(extensions.pgp_sym_encrypt(access_token,  v_key)),
         refresh_token = extensions.armor(extensions.pgp_sym_encrypt(refresh_token, v_key))
   where access_token not like '-----BEGIN PGP MESSAGE-----%';
end $$;
