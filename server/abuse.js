/**
 * Lightweight suspicion tracking with temporary extra throttling.
 * Does not permanently ban. Not a content-moderation system.
 */
export function createAbuseGuard({ now = () => Date.now() } = {}) {
  const identical = new Map()
  const failures = new Map()

  function prune(map, key, cutoff) {
    const list = (map.get(key) ?? []).filter((entry) => entry > cutoff)
    map.set(key, list)
    return list
  }

  function recordIdentical(key, promptHash) {
    const stamp = now()
    const bucketKey = `${key}:id:${promptHash}`
    const list = prune(identical, bucketKey, stamp - 2 * 60_000)
    list.push(stamp)
    identical.set(bucketKey, list)
    return list.length
  }

  function recordValidationFailure(key) {
    const stamp = now()
    const list = prune(failures, key, stamp - 2 * 60_000)
    list.push(stamp)
    failures.set(key, list)
    return list.length
  }

  function restriction(key, promptHash) {
    const stamp = now()
    const identicalCount = prune(identical, `${key}:id:${promptHash}`, stamp - 2 * 60_000).length
    const failureCount = prune(failures, key, stamp - 2 * 60_000).length

    if (identicalCount >= 8 || failureCount >= 12) {
      return { restricted: true, retryAfter: 30, reason: 'temporary_restriction' }
    }
    if (identicalCount >= 5 || failureCount >= 8) {
      return { restricted: true, retryAfter: 10, reason: 'temporary_restriction' }
    }
    return { restricted: false, retryAfter: 0, reason: null }
  }

  return { recordIdentical, recordValidationFailure, restriction }
}
