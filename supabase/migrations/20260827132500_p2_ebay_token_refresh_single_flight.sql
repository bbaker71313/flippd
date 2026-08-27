-- P2-25: distributed single-flight boundary for eBay access-token refresh.
-- getValidEbayToken() previously read the token, decided a refresh was
-- needed, and refreshed it with no lock at all — concurrent Edge Function
-- instances (this runs on multiple instances, so in-memory locking alone
-- can't help) could each decide a refresh was needed and both call eBay's
-- token endpoint with the same refresh_token at once.
--
-- Uses a claim column + row-level locking (SELECT ... FOR UPDATE, inside one
-- RPC = one transaction) rather than a bespoke advisory lock — there is
-- already exactly one row per user in ebay_connections to lock.

ALTER TABLE public.ebay_connections
  ADD COLUMN IF NOT EXISTS refresh_claimed_at timestamp;

-- Atomically decide: token already fresh (return it, claimed=false) / someone
-- else's claim is still live (claimed=false, no token) / claim it ourselves
-- (claimed=true — caller now performs the actual eBay HTTP refresh and must
-- call ebay_complete_token_refresh when done, success or failure, so the
-- claim never permanently deadlocks the user).
CREATE OR REPLACE FUNCTION public.ebay_claim_token_refresh(
  p_user_id integer,
  p_claim_ttl_seconds integer DEFAULT 30
) RETURNS TABLE(claimed boolean, access_token text, expires_at timestamp)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_row public.ebay_connections%rowtype;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'ebay_token_key';
  IF v_key IS NULL THEN RAISE EXCEPTION 'ebay_token_key not found in vault'; END IF;

  -- Row lock: a concurrent call for the same user blocks here until this
  -- transaction commits, then sees this transaction's committed result —
  -- the same mechanism that makes SELECT ... FOR UPDATE a correct mutex.
  SELECT * INTO v_row FROM public.ebay_connections WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Already fresh (refreshed by someone else, or was never actually expired) — no claim needed.
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at > now() + interval '60 seconds' THEN
    RETURN QUERY SELECT false, extensions.pgp_sym_decrypt(extensions.dearmor(v_row.access_token), v_key), v_row.expires_at;
    RETURN;
  END IF;

  -- Someone else's claim is still live (not stale) — caller should wait/poll rather than refresh itself.
  IF v_row.refresh_claimed_at IS NOT NULL
     AND v_row.refresh_claimed_at > now() - (p_claim_ttl_seconds || ' seconds')::interval THEN
    RETURN QUERY SELECT false, NULL::text, v_row.expires_at;
    RETURN;
  END IF;

  -- No live claim (none ever, or stale/expired from a crashed refresh) — claim it.
  UPDATE public.ebay_connections SET refresh_claimed_at = now() WHERE user_id = p_user_id;
  RETURN QUERY SELECT true, extensions.pgp_sym_decrypt(extensions.dearmor(v_row.access_token), v_key), v_row.expires_at;
END $$;

-- Releases the claim, and on success also persists the new access token —
-- one atomic call so a failure path can never leave the claim held forever.
CREATE OR REPLACE FUNCTION public.ebay_complete_token_refresh(
  p_user_id integer,
  p_access text,
  p_expires timestamp,
  p_success boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_key text;
BEGIN
  IF p_success THEN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'ebay_token_key';
    IF v_key IS NULL THEN RAISE EXCEPTION 'ebay_token_key not found in vault'; END IF;

    UPDATE public.ebay_connections
       SET access_token = extensions.armor(extensions.pgp_sym_encrypt(p_access, v_key)),
           expires_at   = p_expires,
           refresh_claimed_at = NULL
     WHERE user_id = p_user_id;
  ELSE
    UPDATE public.ebay_connections SET refresh_claimed_at = NULL WHERE user_id = p_user_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.ebay_claim_token_refresh(integer, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.ebay_complete_token_refresh(integer, text, timestamp, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ebay_claim_token_refresh(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ebay_complete_token_refresh(integer, text, timestamp, boolean) TO service_role;
