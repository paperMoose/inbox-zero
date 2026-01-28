export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 * Skips retry on 401/404. Backs off harder on 429 (rate limit).
 */
export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.code === 401 || error.code === 404) throw error;

      if (attempt < maxRetries) {
        const multiplier = (error.code === 429 || error.message?.includes('Rate Limit'))
          ? Math.pow(2, attempt + 2)
          : Math.pow(2, attempt);
        await sleep(baseDelay * multiplier);
      }
    }
  }
  throw lastError;
}

/**
 * Concurrency-safe rate limiter using promise-chaining.
 * Each caller chains behind the previous, so even concurrent Promise.all
 * callers are serialized with the minimum interval between them.
 */
export class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.minInterval = 1000 / requestsPerSecond;
    this._pending = Promise.resolve();
  }

  wait() {
    this._pending = this._pending.then(() => sleep(this.minInterval));
    return this._pending;
  }
}
