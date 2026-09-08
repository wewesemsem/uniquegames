export class ApiError extends Error {
  constructor({ error = 'request_failed', message, status, retryAfter = null, requestId = null } = {}) {
    super(message || 'Request failed.')
    this.name = 'ApiError'
    this.error = error
    this.status = status ?? 500
    this.retryAfter = retryAfter
    this.requestId = requestId
  }
}

function header(response, name) {
  if (typeof response.headers?.get === 'function') {
    return response.headers.get(name)
  }
  return response.headers?.[name] ?? response.headers?.[name.toLowerCase()] ?? null
}

function throwIfRateLimited(response, payload, requestId) {
  const retryAfterHeader = header(response, 'Retry-After')
  if (response.status === 429 || payload?.error === 'rate_limit_exceeded') {
    const retryAfter = Number(payload?.retryAfter ?? retryAfterHeader) || 30
    throw new ApiError({
      error: 'rate_limit_exceeded',
      message: payload?.message || "You're sending requests too quickly. Please wait a moment.",
      status: 429,
      retryAfter,
      requestId: payload?.requestId ?? requestId,
    })
  }
}

function throwIfFailed(response, payload, requestId) {
  if (!response.ok) {
    throw new ApiError({
      error: payload?.error || 'request_failed',
      message: payload?.message || payload?.error || `World director failed (${response.status}).`,
      status: response.status,
      requestId: payload?.requestId ?? requestId,
    })
  }
}

async function readJsonPayload(response) {
  try {
    return await response.json()
  } catch {
    throw new ApiError({
      message: 'World director returned an unreadable response.',
      status: response.status,
      requestId: header(response, 'X-Request-ID'),
    })
  }
}

export async function* iterateNdjson(response) {
  const body = response.body
  if (!body || typeof body.getReader !== 'function') {
    throw new ApiError({ message: 'World director did not stream a body.', status: 502 })
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) {
          yield JSON.parse(line)
        }
        newline = buffer.indexOf('\n')
      }
    }
    const tail = buffer.trim()
    if (tail) {
      yield JSON.parse(tail)
    }
  } finally {
    reader.releaseLock?.()
  }
}

function contentType(response) {
  return String(header(response, 'Content-Type') || '')
}

export async function generateWorldSpecification(prompt, { onEvent, signal } = {}) {
  const response = await fetch('/api/world/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: onEvent ? 'application/x-ndjson' : 'application/json',
    },
    body: JSON.stringify({ prompt }),
    signal,
  })

  const requestId = header(response, 'X-Request-ID')

  if (!contentType(response).includes('ndjson')) {
    const payload = await readJsonPayload(response)
    throwIfRateLimited(response, payload, requestId)
    throwIfFailed(response, payload, requestId)
    if (!payload?.specification) {
      throw new ApiError({
        message: 'World director did not return a specification.',
        status: 502,
        requestId,
      })
    }
    onEvent?.({ type: 'world', ...payload })
    if (Array.isArray(payload.resolved?.rooms)) {
      payload.resolved.rooms.forEach((room, index) => {
        onEvent?.({ type: 'room', room, index, total: payload.resolved.rooms.length })
      })
    }
    onEvent?.({ type: 'done', generation: payload.generation, resolved: payload.resolved })
    return payload
  }

  if (!response.ok) {
    const payload = await readJsonPayload(response).catch(() => null)
    throwIfRateLimited(response, payload, requestId)
    throwIfFailed(response, payload, requestId)
  }

  const payload = {
    specification: null,
    resolved: { rooms: [] },
    director: null,
    models: null,
    generation: null,
    notice: null,
    retries: 0,
    requestId,
  }

  try {
    for await (const event of iterateNdjson(response)) {
      if (event.type === 'error') {
        throw new ApiError({
          error: event.error || 'director_failed',
          message: event.message || 'Could not build that world.',
          status: 502,
          requestId: event.requestId ?? requestId,
        })
      }
      onEvent?.(event)
      if (event.type === 'world') {
        payload.specification = event.specification
        payload.director = event.director
        payload.models = event.models
        payload.notice = event.notice
        payload.retries = event.retries ?? 0
        payload.requestId = event.requestId ?? requestId
      }
      if (event.type === 'room' && event.room) {
        payload.resolved.rooms[event.index ?? payload.resolved.rooms.length] = event.room
      }
      if (event.type === 'done') {
        if (event.generation) {
          payload.generation = event.generation
        }
        if (event.resolved?.rooms) {
          payload.resolved = event.resolved
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw error
    }
    throw new ApiError({
      message: 'World director stream was interrupted.',
      status: 502,
      requestId,
    })
  }

  if (!payload.specification) {
    throw new ApiError({
      message: 'World director did not return a specification.',
      status: 502,
      requestId,
    })
  }

  return payload
}
