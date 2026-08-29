// Run: `deno test supabase/functions/_shared/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assessEvidenceQuality } from "./evidenceQuality.ts";

Deno.test("3+ coherent exact-model sold comps -> strong", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 5, precision: "exact_model", coherent: true },
    activeEvidence: null,
  });
  assertEquals(r, "strong");
});

Deno.test("3+ coherent exact-identifier-variant sold comps -> strong", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 3, precision: "exact_identifier_variant", coherent: true },
    activeEvidence: null,
  });
  assertEquals(r, "strong");
});

Deno.test("3+ coherent comps but only product_family precision -> moderate, not strong", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 8, precision: "product_family", coherent: true },
    activeEvidence: null,
  });
  assertEquals(r, "moderate");
});

Deno.test("1-2 exact-precision sold comps with supporting active evidence -> moderate", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 2, precision: "exact_model", coherent: true },
    activeEvidence: { count: 3, coherent: false },
  });
  assertEquals(r, "moderate");
});

Deno.test("1-2 exact-precision sold comps with NO active support -> weak, not moderate", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 2, precision: "exact_model", coherent: true },
    activeEvidence: null,
  });
  assertEquals(r, "weak");
});

Deno.test("no sold evidence, 5+ coherent active listings alone -> moderate", () => {
  const r = assessEvidenceQuality({
    soldEvidence: null,
    activeEvidence: { count: 6, coherent: true },
  });
  assertEquals(r, "moderate");
});

Deno.test("no sold evidence, active listings present but not coherent -> weak", () => {
  const r = assessEvidenceQuality({
    soldEvidence: null,
    activeEvidence: { count: 6, coherent: false },
  });
  assertEquals(r, "weak");
});

Deno.test("no sold evidence, fewer than 5 active listings even if coherent -> weak", () => {
  const r = assessEvidenceQuality({
    soldEvidence: null,
    activeEvidence: { count: 4, coherent: true },
  });
  assertEquals(r, "weak");
});

Deno.test("a single sold comp alone -> weak", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 1, precision: "exact_model", coherent: true },
    activeEvidence: null,
  });
  assertEquals(r, "weak");
});

Deno.test("nothing at all -> none", () => {
  const r = assessEvidenceQuality({ soldEvidence: null, activeEvidence: null });
  assertEquals(r, "none");
});

Deno.test("incoherent sold comps at count>=3, exact precision -> not strong", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 5, precision: "exact_model", coherent: false },
    activeEvidence: null,
  });
  assertEquals(r, "weak");
});

Deno.test("substitute precision alone (1 comp) -> weak, never moderate/strong", () => {
  const r = assessEvidenceQuality({
    soldEvidence: { count: 1, precision: "substitute", coherent: false },
    activeEvidence: null,
  });
  assertEquals(r, "weak");
});
