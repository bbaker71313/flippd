// P1-K test infrastructure: a minimal in-memory fake of the subset of the
// supabase-js query-builder surface actually used by this repo's Edge
// Functions (select/insert/update/delete + eq/is/maybeSingle/single), plus a
// pluggable `.rpc()` dispatcher. Not a general supabase-js replacement —
// only what's needed to exercise real handler/reconciliation code without a
// live Postgres connection. Generalizes the single-table fake introduced in
// claude-proxy/inventory_isolation_test.ts to multiple named tables.

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
export type RpcHandler = (params: Record<string, any>) => { data: unknown; error: unknown };

export function makeFakeSupabase(
  seedTables: Record<string, Row[]>,
  rpcHandlers: Record<string, RpcHandler> = {},
) {
  const tables: Record<string, Row[]> = {};
  const nextIds: Record<string, number> = {};
  for (const [name, rows] of Object.entries(seedTables)) {
    tables[name] = rows.map((r) => ({ ...r }));
    nextIds[name] = Math.max(0, ...tables[name].map((r) => Number(r.id) || 0)) + 1;
  }

  function ensureTable(name: string): Row[] {
    if (!tables[name]) { tables[name] = []; nextIds[name] = 1; }
    return tables[name];
  }

  function filterBuilder(table: Row[]) {
    let predicate: ((r: Row) => boolean) | null = null;
    const and = (fn: (r: Row) => boolean) => {
      const prev = predicate;
      predicate = prev ? (r) => prev(r) && fn(r) : fn;
    };
    const builder = {
      eq(col: string, val: unknown) { and((r) => r[col] === val); return builder; },
      neq(col: string, val: unknown) { and((r) => r[col] !== val); return builder; },
      is(col: string, val: null) { and((r) => (r[col] ?? null) === val); return builder; },
      // deno-lint-ignore no-explicit-any
      lte(col: string, val: unknown) { and((r) => (r[col] as any) <= (val as any)); return builder; },
      // deno-lint-ignore no-explicit-any
      gte(col: string, val: unknown) { and((r) => (r[col] as any) >= (val as any)); return builder; },
      order() { return builder; },
      limit() { return builder; },
      select(_cols?: string) { return builder; },
      maybeSingle: () => {
        const list = table.filter(predicate ?? (() => true));
        return Promise.resolve({ data: list[0] ?? null, error: null });
      },
      single: () => {
        const list = table.filter(predicate ?? (() => true));
        return list.length
          ? Promise.resolve({ data: list[0], error: null })
          : Promise.resolve({ data: null, error: { message: 'no rows', code: 'PGRST116' } });
      },
      then(resolve: (v: unknown) => void) {
        resolve({ data: table.filter(predicate ?? (() => true)), error: null });
      },
      _predicate: () => predicate ?? (() => true),
    };
    return builder;
  }

  return {
    __tables: tables,
    from(name: string) {
      const table = ensureTable(name);
      return {
        select(cols?: string) { return filterBuilder(table).select(cols); },
        update(patch: Row) {
          // NOTE: .eq()/.is() must return this same wrapper (not the inner
          // filterBuilder) so that awaiting the chain — with zero or more
          // .eq()/.is() calls in between — always resolves through this
          // patch-aware `then`, never the filterBuilder's generic select-then.
          const b = filterBuilder(table);
          const wrapper = {
            eq(col: string, val: unknown) { b.eq(col, val); return wrapper; },
            is(col: string, val: null) { b.is(col, val); return wrapper; },
            select: (_cols?: string) => ({
              single: () => {
                const matches = table.filter(b._predicate());
                if (matches.length === 0) return Promise.resolve({ data: null, error: { message: 'no rows' } });
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
          return wrapper;
        },
        delete() {
          const b = filterBuilder(table);
          const wrapper = {
            eq(col: string, val: unknown) { b.eq(col, val); return wrapper; },
            is(col: string, val: null) { b.is(col, val); return wrapper; },
            then: (resolve: (v: unknown) => void) => {
              const matches = table.filter(b._predicate());
              for (const row of matches) {
                const idx = table.indexOf(row);
                if (idx !== -1) table.splice(idx, 1);
              }
              resolve({ error: null });
            },
          };
          return wrapper;
        },
        insert(row: Row) {
          const inserted = { id: nextIds[name]++, ...row };
          table.push(inserted);
          return {
            select: (_cols?: string) => ({
              single: () => Promise.resolve({ data: inserted, error: null }),
            }),
            then: (resolve: (v: unknown) => void) => resolve({ data: inserted, error: null }),
          };
        },
      };
    },
    rpc(name: string, params: Record<string, unknown>) {
      const handler = rpcHandlers[name];
      if (!handler) throw new Error(`fakeSupabase: no rpc handler registered for "${name}"`);
      return Promise.resolve(handler(params));
    },
  };
}
