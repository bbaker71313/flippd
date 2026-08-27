// P3-38: single source for the Anthropic model name and API endpoint, which
// were previously repeated as separate literal strings at 6 call sites
// across claude-proxy/index.ts and itemIdentification.ts — a real
// duplication risk for a value CLAUDE.md explicitly protects ("AI model:
// claude-sonnet-4-6 — never downgrade without explicit instruction"): every
// site had to be found and changed correctly, and it would be easy to miss
// one and end up running two different models on different scan paths.
//
// This is a stable protocol/product constant, not per-environment
// configuration — it does not vary between sandbox/prod and is not read
// from an env var, matching how CLAUDE.md already treats it as a locked
// product decision rather than a deployment setting.

export const CLAUDE_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
