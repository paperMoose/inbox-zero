import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sleep, withRetry, RateLimiter } from '../src/lib/rate-limiter.js';

describe('sleep', () => {
  it('resolves after roughly the given ms', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `expected >= 40ms, got ${elapsed}ms`);
  });
});

describe('withRetry', () => {
  it('returns on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42));
    assert.equal(result, 42);
  });

  it('retries on transient failure', async () => {
    let calls = 0;
    const result = await withRetry(() => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'ok';
    }, 3, 10);
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('does not retry on 401', async () => {
    let calls = 0;
    await assert.rejects(async () => {
      await withRetry(() => {
        calls++;
        const err = new Error('auth');
        err.code = 401;
        throw err;
      }, 3, 10);
    });
    assert.equal(calls, 1);
  });

  it('does not retry on 404', async () => {
    let calls = 0;
    await assert.rejects(async () => {
      await withRetry(() => {
        calls++;
        const err = new Error('not found');
        err.code = 404;
        throw err;
      }, 3, 10);
    });
    assert.equal(calls, 1);
  });

  it('throws after max retries exhausted', async () => {
    await assert.rejects(
      () => withRetry(() => { throw new Error('fail'); }, 2, 10),
      { message: 'fail' }
    );
  });
});

describe('RateLimiter', () => {
  it('serializes concurrent Promise.all callers (bug #2 regression)', async () => {
    const limiter = new RateLimiter(10); // 100ms interval
    const timestamps = [];

    // Launch 5 concurrent callers
    await Promise.all(
      Array.from({ length: 5 }, () =>
        limiter.wait().then(() => timestamps.push(Date.now()))
      )
    );

    assert.equal(timestamps.length, 5);

    // Each call should be at least ~80ms apart (allowing some timer jitter)
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      assert.ok(gap >= 70, `gap between call ${i - 1} and ${i} was only ${gap}ms, expected >= 70ms`);
    }

    // Total span should be at least ~400ms for 5 calls at 100ms intervals
    const totalSpan = timestamps[4] - timestamps[0];
    assert.ok(totalSpan >= 300, `total span was only ${totalSpan}ms, expected >= 300ms`);
  });

  it('does not delay unnecessarily for sequential calls', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    // First call should still wait minInterval (100ms)
    assert.ok(elapsed >= 70, `first call took ${elapsed}ms`);
  });
});
