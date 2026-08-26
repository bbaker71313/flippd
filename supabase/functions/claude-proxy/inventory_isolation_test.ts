// P1-D regression tests: User A must never be able to read, update, delete,
// or "sync"-duplicate-into User B's inventory rows through the claude-proxy
// inventory handlers. These handlers run with the service-role client (RLS
// is not the enforcement boundary here) — the only thing standing between a
// user and someone else's data is the `.eq('user_id', userId)` scoping in
// application code. This harness proves that scoping actually holds, using a
// minimal in-memory fake that only allows a row to be found/mutated when
// every `.eq()` the handler applied — including user_id — actually matches.
// Run: `deno test supabase/functions/claude-proxy/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  handleInventoryCreate,
  handleInventoryDelete,
  handleInventoryStatus,
  handleInventoryUpdate,
} from "./index.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function makeFakeSupabase(seedRows: Row[]) {
  const table: Row[] = seedRows.map((r) => ({ ...r }));
  let nextId = Math.max(0, ...table.map((r) => Number(r.id) || 0)) + 1;

  function filterBuilder(getList: () => Row[]) {
    let predicate: ((r: Row) => boolean) | null = null;
    const and = (fn: (r: Row) => boolean) => {
      const prev = predicate;
      predicate = prev ? (r) => prev(r) && fn(r) : fn;
    };
    const builder = {
      eq(col: string, val: unknown) { and((r) => r[col] === val); return builder; },
      is(col: string, val: null) { and((r) => (r[col] ?? null) === val); return builder; },
      select(_cols?: string) { return builder; },
      order() { return builder; },
      range() { return builder; },
      maybeSingle: () => {
        const list = getList().filter(predicate ?? (() => true));
        return Promise.resolve({ data: list[0] ?? null, error: null });
      },
      single: () => {
        const list = getList().filter(predicate ?? (() => true));
        return list.length
          ? Promise.resolve({ data: list[0], error: null })
          : Promise.resolve({ data: null, error: { message: "no rows", code: "PGRST116" } });
      },
      then(resolve: (v: unknown) => void) {
        // supabase-js query builders are thenables — callers that `await`
        // without a terminal .select()/.single() (e.g. plain delete/update)
        // rely on this.
        resolve({ data: getList().filter(predicate ?? (() => true)), error: null });
      },
      _predicate: () => predicate ?? (() => true),
    };
    return builder;
  }

  return {
    __table: table,
    from(name: string) {
      if (name !== "inventory") throw new Error(`fake only supports inventory, got ${name}`);
      return {
        select(cols?: string) { return filterBuilder(() => table).select(cols); },
        update(patch: Row) {
          const b = filterBuilder(() => table);
          const originalEq = b.eq.bind(b);
          // deno-lint-ignore no-explicit-any
          (b as any).eq = (col: string, val: unknown) => { originalEq(col, val); return b; };
          return {
            eq: b.eq,
            select: (_cols?: string) => ({
              single: () => {
                const matches = table.filter(b._predicate());
                if (matches.length === 0) return Promise.resolve({ data: null, error: { message: "no rows" } });
                Object.assign(matches[0], patch);
                return Promise.resolve({ data: matches[0], error: null });
              },
            }),
            then: (resolve: (v: unknown) => void) => {
              const matches = table.filter(b._predicate());
              for (const row of matches) Object.assign(row, patch);
              resolve({ data: matches, error: null });
            },
          };
        },
        delete() {
          const b = filterBuilder(() => table);
          return {
            eq: b.eq,
            then: (resolve: (v: unknown) => void) => {
              const matches = table.filter(b._predicate());
              for (const row of matches) {
                const idx = table.indexOf(row);
                if (idx !== -1) table.splice(idx, 1);
              }
              resolve({ error: null });
            },
          };
        },
        insert(row: Row) {
          const inserted = { id: nextId++, ...row };
          table.push(inserted);
          return {
            select: (_cols?: string) => ({
              single: () => Promise.resolve({ data: inserted, error: null }),
            }),
          };
        },
      };
    },
  };
}

function seed() {
  return [
    { id: 1, user_id: 100, sku: "ELEC-00001", nickname: "User A widget", status: "Unlisted", client_op_id: null },
    { id: 2, user_id: 200, sku: "ELEC-00002", nickname: "User B widget", status: "Unlisted", client_op_id: null },
  ];
}

Deno.test("handleInventoryUpdate: User A cannot update User B's row", async () => {
  const fake = makeFakeSupabase(seed());
  // deno-lint-ignore no-explicit-any
  await handleInventoryUpdate(fake as any, 100, { id: 2, nickname: "hijacked" }).catch(() => {});
  const userBRow = fake.__table.find((r) => r.id === 2);
  assertEquals(userBRow?.nickname, "User B widget"); // unchanged
});

Deno.test("handleInventoryDelete: User A cannot delete User B's row", async () => {
  const fake = makeFakeSupabase(seed());
  // deno-lint-ignore no-explicit-any
  await handleInventoryDelete(fake as any, 100, { id: 2 });
  assertEquals(fake.__table.some((r) => r.id === 2), true); // still present
});

Deno.test("handleInventoryStatus: User A cannot transition User B's row", async () => {
  const fake = makeFakeSupabase(seed());
  let threw = false;
  try {
    // deno-lint-ignore no-explicit-any
    await handleInventoryStatus(fake as any, 100, { id: 2, status: "Sold" });
  } catch { threw = true; }
  assertEquals(threw, true); // "Item not found" for a cross-user id — not silently applied
  const userBRow = fake.__table.find((r) => r.id === 2);
  assertEquals(userBRow?.status, "Unlisted");
});

Deno.test("handleInventoryCreate: idempotent retry (same client_op_id) never leaks/duplicates across the call", async () => {
  const fake = makeFakeSupabase(seed());
  // deno-lint-ignore no-explicit-any
  const first = await handleInventoryCreate(fake as any, 100, "scout", { id: "client-op-1", nickname: "New item" });
  // deno-lint-ignore no-explicit-any
  const retry = await handleInventoryCreate(fake as any, 100, "scout", { id: "client-op-1", nickname: "New item (retried)" });
  assertEquals(first.item.id, retry.item.id); // same row reused, not a second insert
  const matching = fake.__table.filter((r) => r.client_op_id === "client-op-1");
  assertEquals(matching.length, 1);
});

Deno.test("handleInventoryCreate: a different user's identical client_op_id does not collide", async () => {
  const fake = makeFakeSupabase(seed());
  // deno-lint-ignore no-explicit-any
  const a = await handleInventoryCreate(fake as any, 100, "scout", { id: "shared-op-id", nickname: "A's item" });
  // deno-lint-ignore no-explicit-any
  const b = await handleInventoryCreate(fake as any, 200, "scout", { id: "shared-op-id", nickname: "B's item" });
  assertEquals(a.item.id !== b.item.id, true);
  assertEquals(a.item.user_id, 100);
  assertEquals(b.item.user_id, 200);
});
