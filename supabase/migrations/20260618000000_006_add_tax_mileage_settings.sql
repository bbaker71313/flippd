-- Add taxReservePct and mileageRate to settings table.
-- These were previously hardcoded in app.html; now configurable per user.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tax_reserve_pct DECIMAL(5,4) DEFAULT 0.25;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS mileage_rate DECIMAL(5,4) DEFAULT 0.67;
