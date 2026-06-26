-- SEC-010 follow-up: migration 013's `revoke all ... from public` did NOT remove
-- Supabase's default EXECUTE grants to anon/authenticated, leaving these SECURITY
-- DEFINER functions callable via /rest/v1/rpc/ — anon could decrypt eBay tokens.
-- Revoke from every client role; only service-role (Edge Functions) may call them.
-- (013 on disk has since been corrected too; this stays for the already-applied DB.)
revoke execute on function public.ebay_store_tokens(integer,text,text,timestamp,timestamp,text) from anon, authenticated, public;
revoke execute on function public.ebay_get_tokens(integer) from anon, authenticated, public;
revoke execute on function public.ebay_update_access_token(integer,text,timestamp) from anon, authenticated, public;
