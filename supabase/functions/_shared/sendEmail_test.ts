import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sendEmail, sendDurableEmail } from './sendEmail.ts';
import { makeFakeSupabase } from './testing/fakeSupabase.ts';
import { processEmailQueue } from '../cron/index.ts';

function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prior[k] = Deno.env.get(k); Deno.env.set(k, vars[k]); }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (prior[k] === undefined) Deno.env.delete(k); else Deno.env.set(k, prior[k]!);
    }
  });
}

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl;
}
function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test('sendEmail: skips (never throws) when RESEND_API_KEY is not configured', async () => {
  const result = await withEnv({}, async () => {
    Deno.env.delete('RESEND_API_KEY');
    return sendEmail('a@b.com', 'subj', '<p>hi</p>');
  });
  assertEquals(result.success, false);
  assertEquals(result.skipped, true);
});

Deno.test('sendEmail: reports provider success with messageId', async () => {
  stubFetch(() => Promise.resolve(new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 })));
  try {
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => sendEmail('a@b.com', 'subj', '<p>hi</p>'));
    assertEquals(result.success, true);
    assertEquals(result.messageId, 'msg_123');
  } finally {
    restoreFetch();
  }
});

Deno.test('sendEmail: permanent 4xx is reported as non-retryable failure, never thrown', async () => {
  stubFetch(() => Promise.resolve(new Response('bad request', { status: 400 })));
  try {
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => sendEmail('a@b.com', 'subj', '<p>hi</p>'));
    assertEquals(result.success, false);
    assertEquals(result.retryable, false);
  } finally {
    restoreFetch();
  }
});

Deno.test('sendEmail: transient 5xx is reported as retryable failure, never thrown', async () => {
  stubFetch(() => Promise.resolve(new Response('', { status: 503 })));
  try {
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => sendEmail('a@b.com', 'subj', '<p>hi</p>'));
    assertEquals(result.success, false);
    assertEquals(result.retryable, true);
  } finally {
    restoreFetch();
  }
});

Deno.test('sendDurableEmail: queues a pending retry row when the immediate send fails transiently', async () => {
  stubFetch(() => Promise.resolve(new Response('', { status: 503 })));
  try {
    const supabase = makeFakeSupabase({ email_delivery_log: [] });
    // deno-lint-ignore no-explicit-any
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => sendDurableEmail(supabase as any, {
      to: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
    }));
    assertEquals(result.success, false);
    assertEquals(supabase.__tables.email_delivery_log.length, 1);
    assertEquals(supabase.__tables.email_delivery_log[0].status, 'pending');
    assertEquals(supabase.__tables.email_delivery_log[0].category, 'verification');
  } finally {
    restoreFetch();
  }
});

Deno.test('sendDurableEmail: a permanent failure is recorded dead, not queued for retry', async () => {
  stubFetch(() => Promise.resolve(new Response('', { status: 400 })));
  try {
    const supabase = makeFakeSupabase({ email_delivery_log: [] });
    // deno-lint-ignore no-explicit-any
    await withEnv({ RESEND_API_KEY: 'k' }, () => sendDurableEmail(supabase as any, {
      to: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
    }));
    assertEquals(supabase.__tables.email_delivery_log[0].status, 'dead');
  } finally {
    restoreFetch();
  }
});

Deno.test('sendDurableEmail: no row is queued when the immediate send succeeds', async () => {
  stubFetch(() => Promise.resolve(new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })));
  try {
    const supabase = makeFakeSupabase({ email_delivery_log: [] });
    // deno-lint-ignore no-explicit-any
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => sendDurableEmail(supabase as any, {
      to: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
    }));
    assertEquals(result.success, true);
    assertEquals(supabase.__tables.email_delivery_log.length, 0);
  } finally {
    restoreFetch();
  }
});

Deno.test('processEmailQueue: a successful retry marks the row sent', async () => {
  stubFetch(() => Promise.resolve(new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 })));
  try {
    const supabase = makeFakeSupabase({
      email_delivery_log: [{
        id: 1, to_email: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
        status: 'pending', attempts: 1, max_attempts: 5, next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      }],
    });
    // deno-lint-ignore no-explicit-any
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => processEmailQueue(supabase as any));
    assertEquals(result.sent, 1);
    assertEquals(supabase.__tables.email_delivery_log[0].status, 'sent');
    assertEquals(supabase.__tables.email_delivery_log[0].provider_message_id, 'msg_2');
  } finally {
    restoreFetch();
  }
});

Deno.test('processEmailQueue: a repeated transient failure is requeued with backoff until max_attempts, then marked dead', async () => {
  stubFetch(() => Promise.resolve(new Response('', { status: 503 })));
  try {
    const supabase = makeFakeSupabase({
      email_delivery_log: [{
        id: 1, to_email: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
        status: 'pending', attempts: 4, max_attempts: 5, next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      }],
    });
    // deno-lint-ignore no-explicit-any
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => processEmailQueue(supabase as any));
    assertEquals(result.dead, 1);
    assertEquals(supabase.__tables.email_delivery_log[0].status, 'dead');
    assertEquals(supabase.__tables.email_delivery_log[0].attempts, 5);
  } finally {
    restoreFetch();
  }
});

Deno.test('processEmailQueue: a not-yet-due row is left untouched', async () => {
  let calls = 0;
  stubFetch(() => { calls++; return Promise.resolve(new Response(JSON.stringify({ id: 'x' }), { status: 200 })); });
  try {
    const supabase = makeFakeSupabase({
      email_delivery_log: [{
        id: 1, to_email: 'a@b.com', subject: 'Verify', html: '<p>x</p>', category: 'verification',
        status: 'pending', attempts: 1, max_attempts: 5, next_attempt_at: new Date(Date.now() + 3_600_000).toISOString(),
      }],
    });
    // deno-lint-ignore no-explicit-any
    const result = await withEnv({ RESEND_API_KEY: 'k' }, () => processEmailQueue(supabase as any));
    assertEquals(result.processed, 0);
    assertEquals(calls, 0);
    assertEquals(supabase.__tables.email_delivery_log[0].status, 'pending');
  } finally {
    restoreFetch();
  }
});
