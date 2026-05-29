-- ============================================================
-- 002_align_to_flippd.sql
-- Surgical alignment to Flippd data model — ADD/ALTER only, no drops
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. inventory — add missing Flippd columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS nickname      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS platform      VARCHAR(50)  DEFAULT 'eBay',
  ADD COLUMN IF NOT EXISTS sell_price    NUMERIC,
  ADD COLUMN IF NOT EXISTS created_from  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sourcing_meta JSONB,
  ADD COLUMN IF NOT EXISTS listing_data  JSONB,
  ADD COLUMN IF NOT EXISTS ebay_item_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photo_count   INTEGER      DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- 2. settings — add missing columns + fix wrong defaults
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS min_profit      NUMERIC     DEFAULT 15.0,
  ADD COLUMN IF NOT EXISTS min_str         NUMERIC     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping        VARCHAR(20) DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS ship_cost       NUMERIC     DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS tax_reserve_pct NUMERIC     DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS mileage_rate    NUMERIC     DEFAULT 0.67;

ALTER TABLE public.settings
  ALTER COLUMN pkg_cost   SET DEFAULT 1.25,
  ALTER COLUMN stale_days SET DEFAULT 60,
  ALTER COLUMN min_roi    SET DEFAULT 200.0;

-- ────────────────────────────────────────────────────────────
-- 3. scan_log — add missing Flippd columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.scan_log
  ADD COLUMN IF NOT EXISTS item_name        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS roi              NUMERIC,
  ADD COLUMN IF NOT EXISTS bought           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS potential_profit NUMERIC;

-- ────────────────────────────────────────────────────────────
-- 4. scan_log — 500-row-per-user trim trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trim_scan_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.scan_log
  WHERE id IN (
    SELECT id
    FROM   public.scan_log
    WHERE  user_id = NEW.user_id
    ORDER  BY created_at ASC
    OFFSET 500
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_log_trim ON public.scan_log;
CREATE TRIGGER scan_log_trim
  AFTER INSERT ON public.scan_log
  FOR EACH ROW EXECUTE FUNCTION public.trim_scan_log();

-- ────────────────────────────────────────────────────────────
-- 5. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scan_log_user_bought
  ON public.scan_log(user_id, bought);

CREATE INDEX IF NOT EXISTS idx_inventory_user_platform
  ON public.inventory(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_inventory_user_status
  ON public.inventory(user_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_ebay_item
  ON public.inventory(ebay_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_platform
  ON public.inventory(platform);
