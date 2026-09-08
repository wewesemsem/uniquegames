import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryRateLimitStore, createRedisRateLimitStore } from './store.js'
import { createRateLimiter } from './RateLimiter.js'

describe('RateLimiter', () => {
  it('allows requests below the limit', async () => {
    const store = createMemoryRateLimitStore({ now: () => 1_000 })
    const limiter = createRateLimiter({ store, now: () => 1_000 })
    const policy = [{ name: 'per_minute', limit: 3, windowMs: 60_000 }]

    const first = await limiter.consume('ip:1', policy)
    const second = await limiter.consume('ip:1', policy)

    assert.equal(first.allowed, true)
    assert.equal(second.allowed, true)
    assert.equal(second.remaining, 1)
  })

  it('rejects requests above the limit and returns retryAfter', async () => {
    const store = createMemoryRateLimitStore({ now: () => 5_000 })
    const limiter = createRateLimiter({ store, now: () => 5_000 })
    const policy = [{ name: 'per_minute', limit: 1, windowMs: 60_000 }]

    await limiter.consume('ip:2', policy)
    const denied = await limiter.consume('ip:2', policy)

    assert.equal(denied.allowed, false)
    assert.equal(denied.remaining, 0)
    assert.ok(denied.retryAfter >= 1)
    assert.equal(denied.policy, 'per_minute')
  })

  it('resets after the window elapses', async () => {
    let now = 10_000
    const store = createMemoryRateLimitStore({ now: () => now })
    const limiter = createRateLimiter({ store, now: () => now })
    const policy = [{ name: 'per_minute', limit: 1, windowMs: 1_000 }]

    assert.equal((await limiter.consume('ip:3', policy)).allowed, true)
    assert.equal((await limiter.consume('ip:3', policy)).allowed, false)

    now = 11_001
    assert.equal((await limiter.consume('ip:3', policy)).allowed, true)
  })

  it('does not consume a token when a later policy would reject', async () => {
    const store = createMemoryRateLimitStore({ now: () => 20_000 })
    const limiter = createRateLimiter({ store, now: () => 20_000 })
    const policies = [
      { name: 'fast', limit: 10, windowMs: 60_000 },
      { name: 'slow', limit: 1, windowMs: 60_000 },
    ]

    assert.equal((await limiter.consume('ip:4', policies)).allowed, true)
    const denied = await limiter.consume('ip:4', policies)
    assert.equal(denied.allowed, false)
    assert.equal(denied.policy, 'slow')

    const onlyFast = await limiter.consume('ip:4', [{ name: 'fast', limit: 10, windowMs: 60_000 }])
    assert.equal(onlyFast.allowed, true)
    assert.equal(onlyFast.remaining, 8)
  })

  it('keeps subjects isolated', async () => {
    const store = createMemoryRateLimitStore({ now: () => 30_000 })
    const limiter = createRateLimiter({ store, now: () => 30_000 })
    const policy = [{ name: 'per_minute', limit: 1, windowMs: 60_000 }]

    assert.equal((await limiter.consume('ip:a', policy)).allowed, true)
    assert.equal((await limiter.consume('ip:b', policy)).allowed, true)
    assert.equal((await limiter.consume('ip:a', policy)).allowed, false)
  })

  it('redis store adapter uses sorted-set commands', async () => {
    const zsets = new Map()
    const client = {
      async zRemRangeByScore(key, min, max) {
        const list = (zsets.get(key) ?? []).filter((item) => item.score > max)
        zsets.set(key, list)
      },
      async zAdd(key, entries) {
        const list = zsets.get(key) ?? []
        list.push(...entries)
        zsets.set(key, list)
      },
      async zCard(key) {
        return (zsets.get(key) ?? []).length
      },
      async zRange(key, start, end) {
        return (zsets.get(key) ?? []).slice(start, end + 1).map((item) => item.value)
      },
    }

    const store = createRedisRateLimitStore(client, { now: () => 40_000 })
    const limiter = createRateLimiter({ store, now: () => 40_000, prefix: 'test' })
    const policy = [{ name: 'per_minute', limit: 1, windowMs: 60_000 }]

    assert.equal((await limiter.consume('user:1', policy)).allowed, true)
    assert.equal((await limiter.consume('user:1', policy)).allowed, false)
  })
})
