-- P2-19: optimistic concurrency for human-editable inventory records. P1's
-- client_op_id idempotency (20260826230000) prevents a duplicate/retried
-- write from creating a second row, but does not stop two independently
-- valid, differently-stale edits (e.g. two open tabs) from silently
-- overwriting each other. `version` closes that gap: a mutation must supply
-- the version it read, the update is conditioned on `version = expectedVersion`,
-- and a successful write atomically bumps it — zero matching rows means a
-- stale write, surfaced by the edge function as HTTP 409.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
