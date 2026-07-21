import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RequestTimeoutError,
  fetchWithRetry,
  fetchWithTimeout,
  isRetryableStatus,
} from './http';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function jsonResponse(status: number) {
  return new Response('{}', { status });
}

describe('isRetryableStatus', () => {
  it('retries transient server and throttling failures', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('does not retry failures a retry cannot fix', () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  it('returns the response when it resolves in time', async () => {
    mockFetch(async () => jsonResponse(200));

    const response = await fetchWithTimeout('https://example.test', { timeoutMs: 50 });

    expect(response.status).toBe(200);
  });

  it('aborts and raises a timeout error when the request stalls', async () => {
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    );

    await expect(fetchWithTimeout('https://example.test', { timeoutMs: 10 })).rejects.toBeInstanceOf(
      RequestTimeoutError
    );
  });

  it('passes an abort signal to the underlying fetch', async () => {
    const spy = mockFetch(async () => jsonResponse(200));

    await fetchWithTimeout('https://example.test', { timeoutMs: 50 });

    expect(spy.mock.calls[0][1]?.signal).toBeDefined();
  });
});

describe('fetchWithRetry', () => {
  const noSleep = async () => {};

  it('returns a success response without retrying', async () => {
    const spy = mockFetch(async () => jsonResponse(200));

    const response = await fetchWithRetry('https://example.test', { sleep: noSleep });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures and returns the eventual success', async () => {
    let calls = 0;
    const spy = mockFetch(async () => {
      calls += 1;
      return jsonResponse(calls < 3 ? 503 : 200);
    });

    const response = await fetchWithRetry('https://example.test', { sleep: noSleep });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable status', async () => {
    const spy = mockFetch(async () => jsonResponse(401));

    const response = await fetchWithRetry('https://example.test', { sleep: noSleep });

    expect(response.status).toBe(401);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns the last response when every attempt is transient', async () => {
    const spy = mockFetch(async () => jsonResponse(500));

    const response = await fetchWithRetry('https://example.test', { attempts: 3, sleep: noSleep });

    expect(response.status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('retries network errors and rethrows if they never clear', async () => {
    const spy = mockFetch(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(
      fetchWithRetry('https://example.test', { attempts: 2, sleep: noSleep })
    ).rejects.toThrow('Network request failed');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('backs off exponentially between attempts', async () => {
    mockFetch(async () => jsonResponse(503));
    const delays: number[] = [];

    await fetchWithRetry('https://example.test', {
      attempts: 4,
      retryDelayMs: 100,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(delays).toEqual([100, 200, 400]);
  });

  it('does not retry thrown errors when retryOnNetworkError is false', async () => {
    // Transcription uploads are billed on receipt, so a timeout retry could pay
    // for the same audio twice.
    const spy = mockFetch(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(
      fetchWithRetry('https://example.test', { retryOnNetworkError: false, sleep: noSleep })
    ).rejects.toThrow('Network request failed');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still retries rejected statuses when retryOnNetworkError is false', async () => {
    // A 429 means the server refused the request outright, so nothing was
    // billed and retrying is safe.
    let calls = 0;
    const spy = mockFetch(async () => {
      calls += 1;
      return jsonResponse(calls < 2 ? 429 : 200);
    });

    const response = await fetchWithRetry('https://example.test', {
      retryOnNetworkError: false,
      sleep: noSleep,
    });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not retry a caller-initiated abort', async () => {
    const controller = new AbortController();
    const spy = mockFetch(async (_url, init) => {
      controller.abort();
      const error = new Error('Aborted');
      error.name = 'AbortError';
      void init;
      throw error;
    });

    await expect(
      fetchWithRetry('https://example.test', { signal: controller.signal, sleep: noSleep })
    ).rejects.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('refuses to start a request on an already-aborted signal', async () => {
    // addEventListener would never fire on an aborted signal, leaving an
    // in-flight request nothing can cancel.
    const controller = new AbortController();
    controller.abort();
    const spy = mockFetch(async () => jsonResponse(200));

    await expect(
      fetchWithTimeout('https://example.test', { signal: controller.signal })
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
