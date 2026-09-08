/**
 * In-flight / short-ttl idempotency for expensive world generation.
 * Duplicate Explore clicks share one LLM job instead of starting another.
 */
export function createIdempotencyCache({ ttlMs = 15_000, now = () => Date.now() } = {}) {
  const inflight = new Map()
  const recent = new Map()

  async function run(key, fn) {
    const cached = recent.get(key)
    if (cached && cached.expires > now()) {
      return { value: cached.value, duplicate: true, inflight: false }
    }

    const pending = inflight.get(key)
    if (pending) {
      const value = await pending
      return { value, duplicate: true, inflight: true }
    }

    const promise = Promise.resolve().then(fn)
    inflight.set(key, promise)
    try {
      const value = await promise
      recent.set(key, { value, expires: now() + ttlMs })
      return { value, duplicate: false, inflight: false }
    } finally {
      inflight.delete(key)
    }
  }

  function clear() {
    inflight.clear()
    recent.clear()
  }

  return { run, clear }
}
