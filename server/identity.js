/**
 * Request subject for rate limiting.
 *
 * Anonymous traffic is keyed by IP. A trusted getUserId() hook can be
 * supplied later for authenticated quotas — never trust a client-sent user id.
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

export function getRequestSubject(req, { getUserId } = {}) {
  const userId = getUserId?.(req) ?? null
  const ip = getClientIp(req)
  const authenticated = Boolean(userId)
  return {
    ip,
    userId,
    authenticated,
    key: authenticated ? `user:${userId}` : `ip:${ip}`,
  }
}
