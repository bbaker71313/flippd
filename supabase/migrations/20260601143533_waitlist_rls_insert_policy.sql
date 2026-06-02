-- Allow anyone (anon + authenticated) to insert into waitlist
-- This is correct: waitlist is public-facing, no auth required to sign up
CREATE POLICY "allow_public_insert"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Add unique constraint on email if it doesn't exist
-- Prevents duplicate signups at DB level
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_unique UNIQUE (email);
