/**
 * Sliding-window rate limiter.
 *
 * consume(subject, policies) records one event only if every policy allows it.
 * Store can be in-memory or Redis-backed.
 */
export function createRateLimiter({ store, now = () => Date.now(), prefix = 'rl' } = {}) {
  if (!store) {
    throw new Error('RateLimiter requires a store.')
  }

  function namespaced(subjectKey, policyName) {
    return `${prefix}:${policyName}:${subjectKey}`
  }

  async function peekPolicy(subjectKey, policy, timestamp) {
    const key = namespaced(subjectKey, policy.name)
    const cutoff = timestamp - policy.windowMs
    await store.prune(key, cutoff)
    const count = await store.count(key)
    if (count >= policy.limit) {
      const oldest = await store.oldest(key)
      const retryAfter = Math.max(1, Math.ceil(((oldest ?? timestamp) + policy.windowMs - timestamp) / 1000))
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit: policy.limit,
        policy: policy.name,
      }
    }
    return {
      allowed: true,
      remaining: policy.limit - count,
      retryAfter: 0,
      limit: policy.limit,
      policy: policy.name,
    }
  }

  async function consume(subjectKey, policies) {
    const timestamp = now()
    const list = (policies ?? []).filter((policy) => policy.limit > 0)
    if (list.length === 0) {
      return { allowed: true, remaining: Infinity, retryAfter: 0, policy: null }
    }

    let tightest = null
    for (const policy of list) {
      const result = await peekPolicy(subjectKey, policy, timestamp)
      if (!result.allowed) {
        return result
      }
      if (!tightest || result.remaining < tightest.remaining) {
        tightest = result
      }
    }

    for (const policy of list) {
      await store.add(namespaced(subjectKey, policy.name), timestamp)
    }

    return {
      allowed: true,
      remaining: Math.max(0, (tightest?.remaining ?? 1) - 1),
      retryAfter: 0,
      limit: tightest?.limit ?? null,
      policy: tightest?.policy ?? list[0].name,
    }
  }

  return { consume, peek: peekPolicy }
}
