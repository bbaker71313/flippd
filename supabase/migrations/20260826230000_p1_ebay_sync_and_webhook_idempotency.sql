-- P1-A: eBay sync idempotency — database is the final concurrency guard.
-- P1-B: Stripe webhook idempotency — persisted event-processing state.
-- P1-C: scan/manual-add → inventory idempotency — client-supplied operation id.

-- ── P1-A: (user_id, ebay_item_id) hard uniqueness boundary ────────────────────
-- One eBay listing identity must map to at most one inventory row per user.
-- SKU stays non-unique (seller-controlled, may be blank/reused/duplicated) —
-- this index intentionally does NOT touch sku.
--
-- Safety: if concurrent/duplicate syncs already created more than one row for
-- the same (user_id, ebay_item_id) before this migration, creating the index
-- directly would fail. Preserve the oldest row (by created_at, then id) as the
-- surviving identity and null out ebay_item_id on the later duplicates rather
-- than deleting them — no inventory data is destroyed, and the duplicates
-- become ordinary un-linked rows a human can review/merge.
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT id
    FROM (
      SELECT id,
             row_number() OVER (
               PARTITION BY user_id, ebay_item_id
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM public.inventory
      WHERE ebay_item_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  LOOP
    UPDATE public.inventory
       SET ebay_item_id = NULL
     WHERE id = dup.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_ebay_item_id_uniq
  ON public.inventory (user_id, ebay_item_id)
  WHERE ebay_item_id IS NOT NULL;

-- ── P1-C: client-supplied idempotency key for Save/Buy → inventory ───────────
-- The web client already assigns each locally-created item a stable id before
-- the first save attempt (see app.html pushItemToServer/itemForServer). Persist
-- it and enforce uniqueness per user so a double-tap, client retry, timeout
-- retry, or reconnect/replay of the same logical Save/Buy action can never
-- create more than one inventory row.
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS client_op_id text;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_client_op_id_uniq
  ON public.inventory (user_id, client_op_id)
  WHERE client_op_id IS NOT NULL;

-- ── P1-A: atomic reconciliation RPC ───────────────────────────────────────────
-- Replaces the old "SELECT all rows into a Map, then INSERT if not found"
-- pattern (a check-then-insert race under concurrent/repeated sync runs) with
-- a single atomic statement per listing. Called with the service-role client
-- from ebay-oauth's sync handlers only — RLS is not the enforcement boundary
-- here (SECURITY INVOKER is fine; the caller already authenticated the user
-- and always passes that user's own id).
--
-- Reconciliation order (approved relist rule — DECISIONS.md):
--   1. (user_id, ebay_item_id) already exists → same listing identity, apply
--      the caller's field updates to that row (repeated sync is a no-op write,
--      never a new row).
--   2. No identity match, but exactly one non-Sold row for this user shares
--      the given sku → treat as a relist of the same physical item (a new
--      eBay item ID does not by itself imply a new physical item) and adopt
--      the new ebay_item_id onto that row. If more than one row shares the
--      sku, the match is ambiguous — do not guess; fall through to (3).
--   3. Otherwise insert a new row. A concurrent duplicate racing this same
--      insert is caught by the unique index above (ON CONFLICT) and re-read
--      instead of erroring.
CREATE OR REPLACE FUNCTION public.ebay_reconcile_inventory_row(
  p_user_id        integer,
  p_ebay_item_id    text,
  p_sku             text,
  p_status          text,
  p_sell_price      numeric,
  p_title           text,
  p_category_id     integer,
  p_item_id_fallback text
) RETURNS public.inventory
LANGUAGE plpgsql
AS $$
DECLARE
  v_row       public.inventory;
  v_relist_id integer;
  v_match_count integer;
BEGIN
  IF p_ebay_item_id IS NULL THEN
    RAISE EXCEPTION 'ebay_reconcile_inventory_row requires a non-null ebay_item_id';
  END IF;

  -- (1) Same listing identity already known.
  SELECT * INTO v_row FROM public.inventory
   WHERE user_id = p_user_id AND ebay_item_id = p_ebay_item_id
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.inventory SET
      status      = COALESCE(p_status, status),
      sell_price  = COALESCE(p_sell_price, sell_price),
      listing_title = COALESCE(p_title, listing_title),
      ebay_category_id = COALESCE(p_category_id, ebay_category_id),
      updated_at  = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- (2) Unambiguous relist candidate via SKU (never Sold — a completed sale's
  -- identity is not silently reassigned to a new listing).
  IF p_sku IS NOT NULL THEN
    SELECT count(*) INTO v_match_count FROM public.inventory
     WHERE user_id = p_user_id AND sku = p_sku AND status <> 'Sold';

    IF v_match_count = 1 THEN
      SELECT id INTO v_relist_id FROM public.inventory
       WHERE user_id = p_user_id AND sku = p_sku AND status <> 'Sold'
       FOR UPDATE;

      UPDATE public.inventory SET
        ebay_item_id = p_ebay_item_id,
        status       = COALESCE(p_status, status),
        sell_price   = COALESCE(p_sell_price, sell_price),
        listing_title = COALESCE(p_title, listing_title),
        ebay_category_id = COALESCE(p_category_id, ebay_category_id),
        updated_at   = now()
      WHERE id = v_relist_id
      RETURNING * INTO v_row;
      RETURN v_row;
    END IF;
    -- v_match_count = 0 or > 1 (ambiguous) — fall through to insert, never guess.
  END IF;

  -- (3) New row. ON CONFLICT protects against a concurrent duplicate sync run
  -- inserting the same ebay_item_id between our lookup above and this insert.
  INSERT INTO public.inventory (
    user_id, item_id, sku, nickname, listing_title, sell_price, status,
    ebay_item_id, ebay_category_id, platform, created_from
  ) VALUES (
    p_user_id,
    COALESCE(p_sku, p_item_id_fallback),
    p_sku,
    COALESCE(p_title, p_sku, 'eBay item'),
    p_title,
    p_sell_price,
    COALESCE(p_status, 'Unlisted'),
    p_ebay_item_id,
    p_category_id,
    'eBay',
    'ebay_sync'
  )
  ON CONFLICT (user_id, ebay_item_id) WHERE ebay_item_id IS NOT NULL
  DO UPDATE SET
    status      = COALESCE(EXCLUDED.status, public.inventory.status),
    sell_price  = COALESCE(EXCLUDED.sell_price, public.inventory.sell_price),
    updated_at  = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── P1-A: reconcile a Sold order line against existing inventory ────────────
-- Same atomicity concern as above, applied to the orders-sync phase: match by
-- sku first, then ebay_item_id, else insert a new Sold row. ON CONFLICT
-- guards the same (user_id, ebay_item_id) identity.
CREATE OR REPLACE FUNCTION public.ebay_reconcile_sold_order_line(
  p_user_id      integer,
  p_sku          text,
  p_ebay_item_id text,
  p_title        text,
  p_sold_price   numeric,
  p_sold_at      timestamptz,
  p_item_id_fallback text
) RETURNS public.inventory
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.inventory;
BEGIN
  -- SKU is not a uniqueness boundary (may be reused/duplicated per the
  -- approved relist rule) — prefer an unsold candidate row, deterministically
  -- (oldest first) rather than an arbitrary match, to avoid attributing this
  -- order's sold_price/sold_at to the wrong physical item when a sku repeats.
  IF p_sku IS NOT NULL THEN
    SELECT * INTO v_row FROM public.inventory
     WHERE user_id = p_user_id AND sku = p_sku AND status <> 'Sold'
     ORDER BY created_at ASC, id ASC
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF NOT FOUND AND p_ebay_item_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.inventory
     WHERE user_id = p_user_id AND ebay_item_id = p_ebay_item_id
     FOR UPDATE;
  END IF;

  IF FOUND THEN
    UPDATE public.inventory SET
      status      = 'Sold',
      sold_at     = COALESCE(p_sold_at, now()),
      sold_price  = COALESCE(p_sold_price, sold_price),
      ebay_item_id = COALESCE(p_ebay_item_id, ebay_item_id),
      updated_at  = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.inventory (
    user_id, item_id, sku, nickname, listing_title, sell_price, sold_price,
    status, ebay_item_id, platform, created_from, sold_at
  ) VALUES (
    p_user_id,
    COALESCE(p_sku, p_item_id_fallback),
    p_sku,
    COALESCE(p_title, 'eBay sold item'),
    p_title,
    p_sold_price,
    p_sold_price,
    'Sold',
    p_ebay_item_id,
    'eBay',
    'ebay_sync',
    COALESCE(p_sold_at, now())
  )
  ON CONFLICT (user_id, ebay_item_id) WHERE ebay_item_id IS NOT NULL
  DO UPDATE SET
    status      = 'Sold',
    sold_at     = COALESCE(EXCLUDED.sold_at, public.inventory.sold_at),
    sold_price  = COALESCE(EXCLUDED.sold_price, public.inventory.sold_price),
    updated_at  = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── P1-B: persisted Stripe webhook event idempotency ─────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id           text PRIMARY KEY,              -- Stripe event.id (evt_...)
  event_type   text NOT NULL,
  status       text NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing', 'succeeded', 'failed')),
  received_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_detail text
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies added — this table is written/read exclusively by the
-- stripe-webhook Edge Function via the service-role client, never by an
-- end-user session. RLS enabled with no policy = default-deny for anon/authenticated.

-- Atomically claim an event id before running its business effects.
-- Returns: 'claimed' (proceed), 'already_succeeded' (ack, do nothing),
-- 'in_progress' (a concurrent delivery is already handling it — ack, do nothing).
CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id   text,
  p_event_type text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  INSERT INTO public.stripe_webhook_events (id, event_type, status)
  VALUES (p_event_id, p_event_type, 'processing')
  ON CONFLICT (id) DO NOTHING;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  -- Row already existed. A prior 'failed' attempt may be retried — reclaim it
  -- atomically so two concurrent retries can't both proceed.
  UPDATE public.stripe_webhook_events
     SET status = 'processing', error_detail = NULL
   WHERE id = p_event_id AND status = 'failed'
   RETURNING status INTO v_status;

  IF v_status IS NOT NULL THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO v_status FROM public.stripe_webhook_events WHERE id = p_event_id;
  IF v_status = 'succeeded' THEN
    RETURN 'already_succeeded';
  END IF;
  RETURN 'in_progress';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(
  p_event_id text,
  p_success  boolean,
  p_error    text
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.stripe_webhook_events
     SET status       = CASE WHEN p_success THEN 'succeeded' ELSE 'failed' END,
         completed_at = now(),
         error_detail = p_error
   WHERE id = p_event_id;
$$;
