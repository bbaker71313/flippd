-- SEC-016: single-use password reset tokens
-- Track when a reset token was consumed; handleResetRequest clears it on each new request,
-- handleResetConfirm rejects if already set (token already used).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_used_at TIMESTAMPTZ;
