// P3-38: aiConfig.ts is the single source for the Anthropic model/endpoint —
// this test exists mainly to catch an accidental second definition drifting
// back in, not to test a literal string.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CLAUDE_MODEL, ANTHROPIC_MESSAGES_URL } from "./aiConfig.ts";

Deno.test("CLAUDE_MODEL matches the model locked in CLAUDE.md (never downgrade without explicit instruction)", () => {
  assertEquals(CLAUDE_MODEL, "claude-sonnet-4-6");
});

Deno.test("ANTHROPIC_MESSAGES_URL is the Messages API endpoint", () => {
  assertEquals(ANTHROPIC_MESSAGES_URL, "https://api.anthropic.com/v1/messages");
});
