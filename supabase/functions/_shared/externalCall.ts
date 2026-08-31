// P2-18: shared external-call reliability policy for provider HTTP calls
// (eBay, Stripe, Resend, Anthropic, SoldComps). Not a general networking
// framework — just timeout + AbortController + explicit-opt-in retry with
// backoff/jitter, 429 (incl. Retry-After) handling, and transient/permanent
// classification, so provider integrations stop each hand-rolling this.

export type ExternalCallErrorKind = 'timeout' | 'aborted' | 'network' | 'http' | 'parse';

const MAX_ERROR_BODY_CHARS = 2000;

export class ExternalCallError extends Error {
  readonly kind: ExternalCallErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly attempts: number;
  /** Raw response body (truncated), only for kind='http' — lets a caller surface a provider's own error detail (e.g. Stripe's `error.message`). Never populated from request data, so it can't leak our own secrets. */
  readonly bodyText?: string;
  /** Parsed Retry-After delay (ms) for this specific failed attempt, when the
   *  response carried one — set independently of whether it was actually
   *  honored (capped by maxRetryAfterMs, refused by shouldRetry, etc.), so a
   *  caller can distinguish "the provider told us to wait" from "the
   *  provider gave no signal at all" (R2 §5.2 — Trawl's throttled-vs-quota-
   *  exhausted distinction). Undefined when no Retry-After was present. */
  readonly retryAfterMs?: number;

  constructor(
    kind: ExternalCallErrorKind,
    message: string,
    opts: { status?: number; retryable: boolean; attempts: number; cause?: unknown; bodyText?: string; retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'ExternalCallError';
    this.kind = kind;
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.attempts = opts.attempts;
    this.bodyText = opts.bodyText;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

export interface ExternalCallPolicy {
  /** Per-attempt timeout. Default 10000ms. */
  timeoutMs?: number;
  /** Additional attempts after the first. Default 0 — no retry unless explicitly opted in. */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /**
   * Only GET/HEAD requests are safe to retry automatically. A write
   * (POST/PUT/PATCH/DELETE) must set this true — meaning the caller has a
   * safe idempotency boundary (e.g. a provider Idempotency-Key, or the
   * operation is a pure read despite the verb) — before retries apply to it.
   */
  isIdempotent?: boolean;
  /** Injectable for tests; defaults to real timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /**
   * R2 (§5.2, Decision B). Refuse a single honored Retry-After longer than
   * this — a provider asking us to wait past this cap fails fast instead of
   * sleeping through it. Undefined (default) = no cap, preserving prior
   * behavior for every existing caller (ebayBrowse, ebayAppAuth, sendEmail,
   * stripe-checkout).
   */
  maxRetryAfterMs?: number;
  /**
   * R2 (§5.2, Decision B). Total sleep across every retry of this call.
   * Exceeded => fail fast rather than partially sleeping into it. Undefined
   * (default) = unbounded, preserving prior behavior.
   */
  totalRetryBudgetMs?: number;
  /**
   * R2 (§5.2). Extra, caller-specific veto on retrying a specific failure —
   * called only when the failure is otherwise eligible (method-safe,
   * attempts remain, generically retryable). Return false to refuse this
   * retry. `retryAfterMs` is the parsed Retry-After delay for this attempt,
   * if the response carried one (undefined otherwise) — this is how a
   * provider whose 429 without Retry-After means "quota exhausted, do not
   * retry" (Trawl) differs from one where every 429 is a plain transient
   * throttle. Omitted (default) = always allow, preserving prior behavior.
   */
  shouldRetry?: (error: ExternalCallError, retryAfterMs: number | undefined) => boolean;
}

interface AttemptResult<T> {
  ok: boolean;
  value?: T;
  error?: ExternalCallError;
  retryAfterMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const deltaMs = asDate - Date.now();
    return deltaMs > 0 ? deltaMs : 0;
  }
  return undefined;
}

function backoffWithJitter(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.random() * exp;
}

/** GET/HEAD are inherently safe to retry; any other verb needs an explicit idempotency boundary. */
function methodIsSafeToRetry(method: string | undefined, isIdempotent: boolean | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') return true;
  return isIdempotent === true;
}

/**
 * Fetch with timeout + AbortController + explicit-opt-in bounded retry.
 * Throws ExternalCallError (never leaks raw headers/body into the error message).
 */
export async function externalCall<T>(
  url: string,
  init: RequestInit,
  policy: ExternalCallPolicy,
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  const timeoutMs = policy.timeoutMs ?? 10_000;
  const maxRetries = policy.maxRetries ?? 0;
  const baseDelayMs = policy.baseDelayMs ?? 250;
  const maxDelayMs = policy.maxDelayMs ?? 4_000;
  const sleep = policy.sleep ?? defaultSleep;
  const fetchImpl = policy.fetchImpl ?? fetch;
  const retryEligible = methodIsSafeToRetry(init.method, policy.isIdempotent);

  let lastError: ExternalCallError | undefined;
  let retryBudgetUsedMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await attemptOnce<T>(url, init, timeoutMs, fetchImpl, parse, attempt);
    if (result.ok) return result.value as T;

    lastError = result.error!;
    let canRetry = attempt < maxRetries && retryEligible && lastError.retryable;

    if (canRetry && policy.shouldRetry) {
      canRetry = policy.shouldRetry(lastError, result.retryAfterMs);
    }
    if (canRetry && policy.maxRetryAfterMs !== undefined && result.retryAfterMs !== undefined
      && result.retryAfterMs > policy.maxRetryAfterMs) {
      canRetry = false;
    }

    const delay = result.retryAfterMs ?? backoffWithJitter(attempt, baseDelayMs, maxDelayMs);
    if (canRetry && policy.totalRetryBudgetMs !== undefined
      && retryBudgetUsedMs + delay > policy.totalRetryBudgetMs) {
      canRetry = false;
    }

    if (!canRetry) throw lastError;

    retryBudgetUsedMs += delay;
    await sleep(delay);
  }

  throw lastError as ExternalCallError;
}

async function attemptOnce<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  parse: (res: Response) => Promise<T>,
  attempt: number,
): Promise<AttemptResult<T>> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      const kind: ExternalCallErrorKind = externalSignal?.aborted ? 'aborted' : 'timeout';
      return {
        ok: false,
        error: new ExternalCallError(kind, `external call ${kind} after attempt ${attempt + 1}`, {
          retryable: kind === 'timeout',
          attempts: attempt + 1,
        }),
      };
    }
    return {
      ok: false,
      error: new ExternalCallError('network', 'external call network failure', {
        retryable: true,
        attempts: attempt + 1,
        cause: err instanceof Error ? err.message : String(err),
      }),
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const status = res.status;
    const retryable = status === 429 || status >= 500;
    const retryAfterMs = retryable ? parseRetryAfter(res.headers.get('Retry-After')) : undefined;
    const bodyText = await res.text().catch(() => '');
    return {
      ok: false,
      retryAfterMs,
      error: new ExternalCallError('http', `external call received HTTP ${status}`, {
        status,
        retryable,
        attempts: attempt + 1,
        bodyText: bodyText.slice(0, MAX_ERROR_BODY_CHARS),
        retryAfterMs,
      }),
    };
  }

  try {
    const value = await parse(res);
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      error: new ExternalCallError('parse', 'external call response could not be parsed', {
        retryable: false,
        attempts: attempt + 1,
        cause: err instanceof Error ? err.message : String(err),
      }),
    };
  }
}

export async function externalCallJson<T>(
  url: string,
  init: RequestInit,
  policy: ExternalCallPolicy = {},
): Promise<T> {
  return externalCall<T>(url, init, policy, (res) => res.json() as Promise<T>);
}
