/**
 * Sliding-window event store.
 *
 * Memory is the local default. createRedisRateLimitStore(client) is the
 * production shape for a shared store (ioredis / node-redis compatible).
 */

export function createMemoryRateLimitStore({ now = () => Date.now() } = {}) {
  const buckets = new Map()

  function events(key) {
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    return buckets.get(key)
  }

  return {
    kind: 'memory',
    async prune(key, cutoff) {
      const list = events(key).filter((timestamp) => timestamp > cutoff)
      buckets.set(key, list)
      return list.length
    },
    async add(key, timestamp = now()) {
      events(key).push(timestamp)
    },
    async count(key) {
      return events(key).length
    },
    async oldest(key) {
      const list = events(key)
      return list.length ? list[0] : null
    },
    clear() {
      buckets.clear()
    },
  }
}

/**
 * Redis adapter. Pass a client that implements sorted-set commands:
 * zAdd, zRemRangeByScore, zCard, zRange.
 *
 * Example (ioredis):
 *   createRedisRateLimitStore(redis)
 */
export function createRedisRateLimitStore(client, { now = () => Date.now() } = {}) {
  return {
    kind: 'redis',
    async prune(key, cutoff) {
      await client.zRemRangeByScore(key, 0, cutoff)
      return client.zCard(key)
    },
    async add(key, timestamp = now()) {
      await client.zAdd(key, [{ score: timestamp, value: String(timestamp) }])
    },
    async count(key) {
      return client.zCard(key)
    },
    async oldest(key) {
      const range = await client.zRange(key, 0, 0)
      if (!range?.length) {
        return null
      }
      const value = typeof range[0] === 'object' ? range[0].value ?? range[0].score : range[0]
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    },
  }
}

export function createRateLimitStore({ redisUrl, redisClient, now } = {}) {
  if (redisClient) {
    return createRedisRateLimitStore(redisClient, { now })
  }
  if (redisUrl) {
    throw new Error('REDIS_URL is set but no redisClient was provided. Inject a client or unset REDIS_URL.')
  }
  return createMemoryRateLimitStore({ now })
}
