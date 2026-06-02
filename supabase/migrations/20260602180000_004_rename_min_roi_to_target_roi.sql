-- Rename settings.min_roi → target_roi to match claude-proxy code references.
-- claude-proxy reads s.target_roi everywhere; the DB column was named min_roi.
-- This caused silent undefined reads for any user with a real settings row.
ALTER TABLE public.settings RENAME COLUMN min_roi TO target_roi;
