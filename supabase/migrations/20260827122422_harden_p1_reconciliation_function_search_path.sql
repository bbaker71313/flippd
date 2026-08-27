-- Hardening — pin search_path on the 4 functions added by
-- 20260826230000_p1_ebay_sync_and_webhook_idempotency.sql (Supabase linter
-- 0011_function_search_path_mutable), matching the convention already
-- established in 012_harden_function_search_path.sql. All object references
-- in these functions are already schema-qualified (public.inventory,
-- public.stripe_webhook_events), so an empty search_path is safe and blocks
-- search_path-injection. Signatures/bodies are otherwise unchanged —
-- CREATE OR REPLACE preserves the existing function identity and grants.

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
SET search_path = ''
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
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id   text,
  p_event_type text
) RETURNS text
LANGUAGE plpgsql
SET search_path = ''
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
SET search_path = ''
AS $$
  UPDATE public.stripe_webhook_events
     SET status       = CASE WHEN p_success THEN 'succeeded' ELSE 'failed' END,
         completed_at = now(),
         error_detail = p_error
   WHERE id = p_event_id;
$$;
