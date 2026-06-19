-- Add sold_price column so eBay sync-orders can record actual sale price
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS sold_price numeric;
