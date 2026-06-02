-- ============================================================
-- Initial schema: users, inventory, settings, scan_log,
-- pnl_expenses, growth_cache + functions, triggers, indexes
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE public.users (
  id                        serial PRIMARY KEY,
  name                      varchar(100) NOT NULL,
  username                  varchar(50)  NOT NULL UNIQUE,
  email                     varchar(255) NOT NULL UNIQUE,
  password                  varchar(255) NOT NULL,
  is_verified               boolean      DEFAULT false,
  verification_token        varchar(255),
  verification_token_expires timestamp,
  tier                      varchar(20)  DEFAULT 'trial',
  trial_ends_at             timestamp,
  scan_count_month          integer      DEFAULT 0,
  scan_reset_date           date         DEFAULT CURRENT_DATE,
  stripe_customer_id        varchar(255),
  stripe_subscription_id    varchar(255),
  subscription_status       varchar(50),
  subscription_period_end   timestamp,
  created_at                timestamp    DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ── inventory ────────────────────────────────────────────────
CREATE TABLE public.inventory (
  id                  serial PRIMARY KEY,
  user_id             integer      NOT NULL REFERENCES public.users(id),
  item_id             varchar(100) NOT NULL,
  sku                 varchar(100),
  nickname            varchar(255),
  category            varchar(100),
  condition           varchar(50),
  date_acquired       date,
  platform            varchar(50)  DEFAULT 'eBay',
  cost                numeric,
  sell_price          numeric,
  status              varchar(50)  DEFAULT 'Unlisted',
  notes               text,
  photos              jsonb        DEFAULT '[]',
  created_at          timestamp    DEFAULT now(),
  listing_title       varchar(80),
  listing_description text,
  listing_condition   text,
  ebay_category       varchar(100),
  ebay_category_id    integer,
  ebay_condition_id   varchar(50),
  listed_at           timestamp,
  sold_at             timestamp,
  updated_at          timestamp    DEFAULT now(),
  created_from        varchar(30)  DEFAULT 'manual',
  sourcing_meta       jsonb,
  listing_data        jsonb,
  ebay_item_id        varchar(60),
  photo_count         integer      DEFAULT 0
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inventory_user_id       ON public.inventory(user_id);
CREATE INDEX idx_inventory_status        ON public.inventory(status);
CREATE INDEX idx_inventory_platform      ON public.inventory(platform);
CREATE INDEX idx_inventory_user_status   ON public.inventory(user_id, status);
CREATE INDEX idx_inventory_user_platform ON public.inventory(user_id, platform);
CREATE INDEX idx_inventory_ebay_item     ON public.inventory(ebay_item_id);

-- ── settings ─────────────────────────────────────────────────
CREATE TABLE public.settings (
  id               serial PRIMARY KEY,
  user_id          integer UNIQUE NOT NULL REFERENCES public.users(id),
  ebay_fee         numeric  DEFAULT 13.0,
  pkg_cost         numeric  DEFAULT 1.25,
  min_roi          numeric  DEFAULT 200.0,
  stale_days       integer  DEFAULT 60,
  sourcing_style   varchar(20) DEFAULT 'balanced',
  updated_at       timestamp   DEFAULT now(),
  min_profit       numeric  DEFAULT 15.0,
  min_str          numeric  DEFAULT 0.0,
  shipping         varchar(20) DEFAULT 'buyer',
  ship_cost        numeric  DEFAULT 6.00,
  tax_reserve_pct  numeric  DEFAULT 0.25,
  mileage_rate     numeric  DEFAULT 0.67
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ── scan_log ─────────────────────────────────────────────────
CREATE TABLE public.scan_log (
  id               serial PRIMARY KEY,
  user_id          integer NOT NULL REFERENCES public.users(id),
  created_at       timestamp DEFAULT now(),
  scan_type        varchar(20) DEFAULT 'single',
  item_description text,
  decision         varchar(10),
  estimated_profit numeric,
  estimated_sell   numeric,
  cost             numeric,
  category         varchar(100),
  confidence       integer,
  raw_response     jsonb,
  item_name        text,
  roi              numeric,
  bought           boolean DEFAULT false,
  potential_profit numeric
);

ALTER TABLE public.scan_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_scan_log_user_id      ON public.scan_log(user_id);
CREATE INDEX idx_scan_log_created_at   ON public.scan_log(created_at DESC);
CREATE INDEX idx_scan_log_user_created ON public.scan_log(user_id, created_at DESC);
CREATE INDEX idx_scan_log_user_bought  ON public.scan_log(user_id, bought);

-- ── pnl_expenses ─────────────────────────────────────────────
CREATE TABLE public.pnl_expenses (
  id          serial PRIMARY KEY,
  user_id     integer     NOT NULL REFERENCES public.users(id),
  date        date        NOT NULL,
  amount      numeric     NOT NULL,
  category    varchar(50) NOT NULL,
  description text,
  miles       numeric,
  created_at  timestamp DEFAULT now()
);

ALTER TABLE public.pnl_expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pnl_expenses_user_date ON public.pnl_expenses(user_id, date DESC);

-- ── growth_cache ─────────────────────────────────────────────
CREATE TABLE public.growth_cache (
  id           serial PRIMARY KEY,
  user_id      integer UNIQUE NOT NULL REFERENCES public.users(id),
  cache_data   jsonb NOT NULL,
  generated_at timestamp DEFAULT now(),
  expires_at   timestamp DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.growth_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_growth_cache_user_id   ON public.growth_cache(user_id);
CREATE INDEX idx_growth_cache_expires_at ON public.growth_cache(expires_at);

-- ── functions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trim_scan_log()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
      AND cmd.schema_name IN ('public')
      AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
      AND cmd.schema_name NOT LIKE 'pg_toast%'
      AND cmd.schema_name NOT LIKE 'pg_temp%'
    THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

-- ── triggers ─────────────────────────────────────────────────
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_trim_scan_log
  AFTER INSERT ON public.scan_log
  FOR EACH ROW EXECUTE FUNCTION public.trim_scan_log();
