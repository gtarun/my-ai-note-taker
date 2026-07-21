/**
 * Network helpers for outbound provider calls.
 *
 * Every `fetch` in this app used to run without a timeout, so a stalled socket
 * — common on flaky mobile networks — would hang a meeting's processing
 * indefinitely with the UI stuck on "Transcribing". These wrappers put an upper
 * bound on every request and retry the failures that are actually worth
 * retrying.
 */

/** Generous by default: transcription uploads carry whole audio files. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

export type TimeoutFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `The request timed out after ${Math.round(timeoutMs / 1000)}s. Check your connection and try again.`
    );
    this.name = 'RequestTimeoutError';
  }
}

/**
 * `fetch` with an enforced deadline. Aborts the underlying request rather than
 * merely rejecting, so a stalled upload stops consuming the radio.
 */
export async function fetchWithTimeout(
  url: string,
  options: TimeoutFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...init } = options;

  // An already-aborted signal must not start a request. addEventListener below
  // would never fire for it, producing an uncancellable in-flight request.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Preserve any caller-supplied signal by forwarding its abort to ours.
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // A caller-initiated abort should surface as-is; only our own deadline
    // becomes a RequestTimeoutError.
    if (isAbortError(error) && !signal?.aborted) {
      throw new RequestTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Retry only what a retry can plausibly fix. A 401 will never succeed on attempt two. */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestTimeoutError');
}

export type RetryOptions = TimeoutFetchOptions & {
  /** Total attempts including the first. */
  attempts?: number;
  /** Base delay; grows exponentially per attempt. */
  retryDelayMs?: number;
  /**
   * Whether to retry thrown errors (timeouts, dropped connections) in addition
   * to retryable status codes.
   *
   * Set false for requests that may already have been accepted and billed when
   * the client gives up — a transcription upload that exceeds our deadline may
   * still be processing server-side, and retrying would pay for it twice. A
   * retryable *status* is always safe to retry, because the server explicitly
   * rejected the request.
   */
  retryOnNetworkError?: boolean;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `fetchWithTimeout` plus bounded exponential backoff on transient failures.
 *
 * Retries on network errors, timeouts, and the 5xx/429/408 family. A response
 * with a non-retryable status is returned to the caller untouched so the
 * existing per-provider error handling still owns the message.
 */
export async function fetchWithRetry(url: string, options: RetryOptions = {}): Promise<Response> {
  const {
    attempts = 3,
    retryDelayMs = 1_000,
    retryOnNetworkError = true,
    sleep = defaultSleep,
    ...fetchOptions
  } = options;
  const totalAttempts = Math.max(1, attempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const isLastAttempt = attempt === totalAttempts;

    try {
      const response = await fetchWithTimeout(url, fetchOptions);

      if (!isRetryableStatus(response.status) || isLastAttempt) {
        return response;
      }

      // Release the connection before the next attempt rather than leaving an
      // unread body behind.
      await response.body?.cancel?.().catch(() => undefined);
    } catch (error) {
      lastError = error;

      // A caller-initiated abort is a decision, not a failure to retry through.
      if (fetchOptions.signal?.aborted) {
        throw error;
      }

      if (isLastAttempt || !retryOnNetworkError) {
        throw error;
      }
    }

    await sleep(retryDelayMs * 2 ** (attempt - 1));
  }

  // Unreachable: the loop either returns or throws on the last attempt.
  throw lastError ?? new Error('Request failed.');
}
