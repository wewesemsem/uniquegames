export class PayloadTooLargeError extends Error {
  constructor(maxBytes) {
    super('Payload Too Large')
    this.name = 'PayloadTooLargeError'
    this.status = 413
    this.maxBytes = maxBytes
  }
}

export async function readJsonBody(req, { maxBytes }) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) {
      throw new PayloadTooLargeError(maxBytes)
    }
    chunks.push(buffer)
  }

  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error('Request body must be JSON.')
    error.status = 400
    throw error
  }
}

export function wantsNdjson(req) {
  const accept = String(req.headers?.accept || req.headers?.Accept || '')
  return accept.includes('application/x-ndjson')
}

export function beginNdjson(res, { requestId } = {}) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  if (requestId) {
    res.setHeader('X-Request-ID', requestId)
  }
  res.flushHeaders?.()
}

export function writeNdjson(res, event) {
  res.write(`${JSON.stringify(event)}\n`)
  if (typeof res.flush === 'function') {
    res.flush()
  }
}

export function sendJson(res, status, body, { headers = {} } = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  for (const [name, value] of Object.entries(headers)) {
    if (value != null) {
      res.setHeader(name, String(value))
    }
  }
  res.end(JSON.stringify(body))
}

export function sendRateLimited(res, { retryAfter, requestId, message } = {}) {
  const seconds = Math.max(1, Number(retryAfter) || 30)
  sendJson(
    res,
    429,
    {
      error: 'rate_limit_exceeded',
      message: message || 'Too many requests. Please try again later.',
      retryAfter: seconds,
    },
    {
      headers: {
        'Retry-After': seconds,
        'X-Request-ID': requestId,
      },
    }
  )
}
