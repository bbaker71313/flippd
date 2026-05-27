-- ============================================================
-- 001_extend_schema.sql
-- Surgical extension only — existing users + inventory columns untouched
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Extend public.inventory (ADD COLUMN only)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS listing_title        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS listing_description  TEXT,
  ADD COLUMN IF NOT EXISTS listing_condition    TEXT,
  ADD COLUMN IF NOT EXISTS ebay_category        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ebay_category_id     INTEGER,
  ADD COLUMN IF NOT EXISTS ebay_condition_id    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS listed_at            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sold_at              TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMP DEFAULT now();

-- ────────────────────────────────────────────────────────────
-- 2. scan_log
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scan_log (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMP DEFAULT now(),
  scan_type         VARCHAR(20) DEFAULT 'single',
  item_description  TEXT,
  decision          VARCHAR(10),
  estimated_profit  NUMERIC,
  estimated_sell    NUMERIC,
  cost              NUMERIC,
  category          VARCHAR(100),
  confidence        INTEGER,
  raw_response      JSONB
);

-- ────────────────────────────────────────────────────────────
-- 3. settings
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  ebay_fee        NUMERIC DEFAULT 13.0,
  pkg_cost        NUMERIC DEFAULT 0.0,
  min_roi         NUMERIC DEFAULT 30.0,
  stale_days      INTEGER DEFAULT 30,
  sourcing_style  VARCHAR(20) DEFAULT 'balanced',
  updated_at      TIMESTAMP DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 4. pnl_expenses
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pnl_expenses (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  amount       NUMERIC NOT NULL,
  category     VARCHAR(50) NOT NULL,
  description  TEXT,
  miles        NUMERIC,
  created_at   TIMESTAMP DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 5. growth_cache
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.growth_cache (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  cache_data    JSONB NOT NULL,
  generated_at  TIMESTAMP DEFAULT now(),
  expires_at    TIMESTAMP DEFAULT (now() + INTERVAL '24 hours')
);

-- ────────────────────────────────────────────────────────────
-- 6. Enable RLS on the 4 new tables
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.scan_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_cache ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 7. RLS policies — each user sees only their own rows
-- ────────────────────────────────────────────────────────────
CREATE POLICY scan_log_own_rows ON public.scan_log
  USING (user_id = current_setting('app.user_id')::INTEGER);

CREATE POLICY settings_own_rows ON public.settings
  USING (user_id = current_setting('app.user_id')::INTEGER);

CREATE POLICY pnl_expenses_own_rows ON public.pnl_expenses
  USING (user_id = current_setting('app.user_id')::INTEGER);

CREATE POLICY growth_cache_own_rows ON public.growth_cache
  USING (user_id = current_setting('app.user_id')::INTEGER);

-- ────────────────────────────────────────────────────────────
-- 8. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scan_log_user_id     ON public.scan_log(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_log_created_at  ON public.scan_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id    ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status     ON public.inventory(status);

CREATE INDEX IF NOT EXISTS idx_pnl_expenses_user_date ON public.pnl_expenses(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_growth_cache_user_id   ON public.growth_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_cache_expires_at ON public.growth_cache(expires_at);

-- ────────────────────────────────────────────────────────────
-- 9. Trigger function + attach to inventory + settings
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
