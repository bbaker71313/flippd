-- ============================================================
-- 000_base_schema.sql
-- Creates users + inventory from scratch so that
-- 001_extend_schema.sql (which ALTERs both tables) can run on
-- a fresh database (e.g. Supabase preview branches).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. users  (all columns — 001/002 do not alter this table)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                         SERIAL PRIMARY KEY,
  name                       VARCHAR(255),
  username                   VARCHAR(255) NOT NULL UNIQUE,
  email                      VARCHAR(255) NOT NULL UNIQUE,
  password                   VARCHAR(255) NOT NULL,
  is_verified                BOOLEAN   DEFAULT false,
  verification_token         VARCHAR(255),
  verification_token_expires TIMESTAMP,
  tier                       VARCHAR(50) DEFAULT 'trial',
  trial_ends_at              TIMESTAMP,
  scan_count_month           INTEGER   DEFAULT 0,
  scan_reset_date            DATE      DEFAULT CURRENT_DATE,
  stripe_customer_id         VARCHAR(255),
  stripe_subscription_id     VARCHAR(255),
  subscription_status        VARCHAR(50),
  subscription_period_end    TIMESTAMP,
  created_at                 TIMESTAMP DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 2. inventory  (base columns only)
--    001_extend_schema adds: listing_title, listing_description,
--      listing_condition, ebay_category, ebay_category_id,
--      ebay_condition_id, listed_at, sold_at, updated_at
--    002_align_to_flippd adds: nickname, platform, sell_price,
--      created_from, sourcing_meta, listing_data, ebay_item_id,
--      photo_count
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id       VARCHAR(255) NOT NULL,
  sku           VARCHAR(255),
  category      VARCHAR(100),
  condition     VARCHAR(50),
  date_acquired DATE,
  cost          NUMERIC,
  status        VARCHAR(50) DEFAULT 'Unlisted',
  notes         TEXT,
  photos        JSONB       DEFAULT '[]',
  created_at    TIMESTAMP   DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
