-- R3 (docs/files/DECISIONS.md "R3 identification is SerpAPI-first..."):
-- SerpAPI's Google Lens visual-search API requires a publicly-fetchable
-- image URL, not a raw upload. This bucket exists SOLELY so claude-proxy
-- (supabase/functions/_shared/serpApiIdentification.ts) can upload one scan
-- photo, generate a short-lived signed URL, call SerpAPI, and immediately
-- delete the object — never a persistent photo store. Private from
-- creation (public = false), no client-facing RLS policy — service-role
-- (edge functions) only, matching the exact pattern already used for
-- item-photos in migration 20260827133500_p2_security_advisor_cleanup.sql.
-- This app's identity model (custom integer user id, not Supabase Auth's
-- auth.uid()) can't express per-user RLS ownership on this bucket even if
-- it were ever exposed client-side, and it is never meant to be — every
-- object here is written and deleted by the same edge-function call.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scan-temp-images',
  'scan-temp-images',
  false,
  10485760, -- 10MB — comfortably above a compressed scan photo, well under any real upload
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- No RLS policy added for storage.objects scoped to this bucket — intentional
-- default-deny for anon/authenticated (service-role/edge-function-only),
-- same pattern as item-photos above. Do not add a public SELECT/INSERT
-- policy for this bucket without a fresh product/security decision — its
-- entire purpose is that nothing outside claude-proxy's own service-role
-- call ever touches it.
