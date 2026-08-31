import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { externalCall, ExternalCallError } from './externalCall.ts';

function jsonRes(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function noopSleep() {
  return Promise.resolve();
}

Deno.test('externalCall: succeeds on first try', async () => {
  const fetchImpl = () => Promise.resolve(jsonRes({ ok: true }));
  const value = await externalCall('https://x', {}, { fetchImpl }, (r) => r.json());
  assertEquals(value, { ok: true });
});

Deno.test('externalCall: timeout classification when the request never resolves', async () => {
  const fetchImpl: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal!;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const err = await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl, timeoutMs: 5, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals((err as ExternalCallError).kind, 'timeout');
  assertEquals((err as ExternalCallError).retryable, true);
});

Deno.test('externalCall: caller-provided AbortSignal is classified as aborted, not timeout', async () => {
  const controller = new AbortController();
  const fetchImpl: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal!;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const pending = externalCall(
    'https://x',
    { signal: controller.signal },
    { fetchImpl, timeoutMs: 5_000, sleep: noopSleep },
    (r) => r.json(),
  );
  controller.abort();
  const err = await assertRejects(() => pending, ExternalCallError);
  assertEquals((err as ExternalCallError).kind, 'aborted');
  assertEquals((err as ExternalCallError).retryable, false);
});

Deno.test('externalCall: network failure is classified transient', async () => {
  const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
  const err = await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals((err as ExternalCallError).kind, 'network');
  assertEquals((err as ExternalCallError).retryable, true);
});

Deno.test('externalCall: 429 is retryable and permanent 4xx is not', async () => {
  const fetchImpl429: typeof fetch = () => Promise.resolve(new Response('', { status: 429 }));
  const err429 = await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl: fetchImpl429, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals((err429 as ExternalCallError).retryable, true);

  const fetchImpl400: typeof fetch = () => Promise.resolve(new Response('', { status: 400 }));
  const err400 = await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl: fetchImpl400, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals((err400 as ExternalCallError).retryable, false);
  assertEquals((err400 as ExternalCallError).status, 400);
});

Deno.test('externalCall: 5xx retryable, honors Retry-After header', async () => {
  let calls = 0;
  const seenDelays: number[] = [];
  const fetchImpl: typeof fetch = () => {
    calls++;
    if (calls === 1) {
      return Promise.resolve(new Response('', { status: 503, headers: { 'Retry-After': '2' } }));
    }
    return Promise.resolve(jsonRes({ ok: true }));
  };
  const sleep = (ms: number) => {
    seenDelays.push(ms);
    return Promise.resolve();
  };
  const value = await externalCall(
    'https://x',
    {},
    { fetchImpl, maxRetries: 1, sleep },
    (r) => r.json(),
  );
  assertEquals(value, { ok: true });
  assertEquals(calls, 2);
  assertEquals(seenDelays, [2000]);
});

Deno.test('externalCall: bounded retry exhaustion throws the last error after maxRetries', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('', { status: 503 }));
  };
  const err = await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl, maxRetries: 2, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals(calls, 3);
  assertEquals((err as ExternalCallError).attempts, 3);
});

Deno.test('externalCall: successful retry after one transient failure', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    if (calls === 1) return Promise.reject(new TypeError('network blip'));
    return Promise.resolve(jsonRes({ ok: true }));
  };
  const value = await externalCall(
    'https://x',
    {},
    { fetchImpl, maxRetries: 1, sleep: noopSleep },
    (r) => r.json(),
  );
  assertEquals(value, { ok: true });
  assertEquals(calls, 2);
});

Deno.test('externalCall: retry disabled (maxRetries=0) never retries even a transient failure', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('', { status: 503 }));
  };
  await assertRejects(
    () => externalCall('https://x', {}, { fetchImpl, sleep: noopSleep }, (r) => r.json()),
    ExternalCallError,
  );
  assertEquals(calls, 1);
});

Deno.test('externalCall: a non-idempotent POST is never retried even on a transient failure', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('', { status: 503 }));
  };
  await assertRejects(
    () =>
      externalCall(
        'https://x',
        { method: 'POST' },
        { fetchImpl, maxRetries: 3, sleep: noopSleep },
        (r) => r.json(),
      ),
    ExternalCallError,
  );
  assertEquals(calls, 1, 'POST without isIdempotent must not be retried');
});

Deno.test('externalCall: a POST explicitly marked isIdempotent does retry', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response('', { status: 503 }));
    return Promise.resolve(jsonRes({ ok: true }));
  };
  const value = await externalCall(
    'https://x',
    { method: 'POST' },
    { fetchImpl, maxRetries: 1, isIdempotent: true, sleep: noopSleep },
    (r) => r.json(),
  );
  assertEquals(value, { ok: true });
  assertEquals(calls, 2);
});

Deno.test('externalCall: maxRetryAfterMs refuses a Retry-After longer than the cap', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
  };
  const err = await assertRejects(
    () =>
      externalCall(
        'https://x',
        {},
        { fetchImpl, maxRetries: 2, maxRetryAfterMs: 2_000, sleep: noopSleep },
        (r) => r.json(),
      ),
    ExternalCallError,
  );
  assertEquals(calls, 1, 'a Retry-After past the cap must fail fast, not sleep 60s');
  assertEquals((err as ExternalCallError).retryAfterMs, 60_000);
});

Deno.test('externalCall: totalRetryBudgetMs fails fast once the cumulative sleep would exceed it', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '2' } }));
  };
  const seenDelays: number[] = [];
  const sleep = (ms: number) => {
    seenDelays.push(ms);
    return Promise.resolve();
  };
  await assertRejects(
    () =>
      externalCall(
        'https://x',
        {},
        { fetchImpl, maxRetries: 5, totalRetryBudgetMs: 3_000, sleep },
        (r) => r.json(),
      ),
    ExternalCallError,
  );
  // Each attempt asks for a 2s sleep; the budget (3s) allows exactly one.
  assertEquals(seenDelays, [2_000]);
  assertEquals(calls, 2);
});

Deno.test('externalCall: shouldRetry can veto a retry the generic classification would otherwise allow (Trawl throttle-vs-quota)', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    // 429 with no Retry-After header — Trawl's "quota exhausted" case.
    return Promise.resolve(new Response('', { status: 429 }));
  };
  const err = await assertRejects(
    () =>
      externalCall(
        'https://x',
        {},
        {
          fetchImpl,
          maxRetries: 3,
          sleep: noopSleep,
          shouldRetry: (error, retryAfterMs) => error.status !== 429 || retryAfterMs !== undefined,
        },
        (r) => r.json(),
      ),
    ExternalCallError,
  );
  assertEquals(calls, 1, 'no Retry-After header must not be retried when shouldRetry requires one');
  assertEquals((err as ExternalCallError).retryAfterMs, undefined);
});

Deno.test('externalCall: shouldRetry allows a 429 that does carry Retry-After through to succeed', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '1' } }));
    return Promise.resolve(jsonRes({ ok: true }));
  };
  const value = await externalCall(
    'https://x',
    {},
    {
      fetchImpl,
      maxRetries: 1,
      sleep: noopSleep,
      shouldRetry: (error, retryAfterMs) => error.status !== 429 || retryAfterMs !== undefined,
    },
    (r) => r.json(),
  );
  assertEquals(value, { ok: true });
  assertEquals(calls, 2);
});

Deno.test('externalCall: parse failure is permanent (not retried)', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls++;
    return Promise.resolve(new Response('not json', { status: 200 }));
  };
  const err = await assertRejects(
    () =>
      externalCall(
        'https://x',
        {},
        { fetchImpl, maxRetries: 2, sleep: noopSleep },
        (r) => r.json(),
      ),
    ExternalCallError,
  );
  assertEquals((err as ExternalCallError).kind, 'parse');
  assertEquals(calls, 1);
});
