/**
 * CORS helpers for the standalone API (Netlify frontend → Heroku backend).
 *
 * CORS_ORIGINS: comma-separated list of allowed origins.
 * Empty / unset → allow any origin (Access-Control-Allow-Origin: *).
 * Example: https://my-app.netlify.app,http://localhost:5173
 *
 * Trailing slashes are ignored — browsers never send Origin with a trailing `/`.
 */

function normalizeOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
}

export function parseCorsOrigins(env = process.env) {
  const raw = String(env.CORS_ORIGINS ?? '').trim()
  if (!raw) {
    return ['*']
  }
  return raw
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean)
}

export function resolveCorsOrigin(requestOrigin, allowedOrigins) {
  const origins = allowedOrigins?.length ? allowedOrigins : ['*']
  if (origins.includes('*')) {
    return '*'
  }
  const origin = normalizeOrigin(requestOrigin)
  if (origin && origins.includes(origin)) {
    return origin
  }
  return null
}

export function applyCorsHeaders(req, res, allowedOrigins) {
  const allowed = resolveCorsOrigin(req.headers?.origin, allowedOrigins)
  if (!allowed) {
    return false
  }

  res.setHeader('Access-Control-Allow-Origin', allowed)
  if (allowed !== '*') {
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-Request-ID, Idempotency-Key'
  )
  res.setHeader('Access-Control-Max-Age', '86400')
  return true
}
