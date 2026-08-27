// Local stand-ins for the subset of std/assert used by this repo's Deno
// tests (assertEquals, assertThrows, assertRejects). This sandbox's egress
// policy blocks deno.land, so real test runs here map the deno.land assert
// specifier to this file via deno_test_import_map.json — see
// docs/HANDOFF.md for why. Not imported by any deployed function; test-only.

// deno-lint-ignore no-explicit-any
type ErrorClass = new (...args: any[]) => Error;

function format(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(msg ?? `assertEquals failed: expected ${format(expected)}, got ${format(actual)}`);
  }
}

export function assertThrows(fn: () => unknown, ErrorClass?: ErrorClass, msgIncludes?: string): Error {
  try {
    fn();
  } catch (e) {
    if (ErrorClass && !(e instanceof ErrorClass)) {
      throw new Error(`assertThrows: expected instance of ${ErrorClass.name}, got ${e}`);
    }
    if (msgIncludes && !(e instanceof Error && e.message.includes(msgIncludes))) {
      throw new Error(`assertThrows: expected message to include "${msgIncludes}", got "${(e as Error).message}"`);
    }
    return e as Error;
  }
  throw new Error("assertThrows: function did not throw");
}

export async function assertRejects(
  fn: () => Promise<unknown>,
  ErrorClass?: ErrorClass,
  msgIncludes?: string,
): Promise<Error> {
  try {
    await fn();
  } catch (e) {
    if (ErrorClass && !(e instanceof ErrorClass)) {
      throw new Error(`assertRejects: expected instance of ${ErrorClass.name}, got ${e}`);
    }
    if (msgIncludes && !(e instanceof Error && e.message.includes(msgIncludes))) {
      throw new Error(`assertRejects: expected message to include "${msgIncludes}", got "${(e as Error).message}"`);
    }
    return e as Error;
  }
  throw new Error("assertRejects: function did not reject");
}
