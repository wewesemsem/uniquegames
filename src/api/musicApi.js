import { apiUrl } from './apiBase.js'
import { ApiError } from './worldApi.js'
import { heuristicMusicSpecification, sanitizeMusicSpecification } from '../audio/MusicSpecification.js'

/**
 * Isolated music prompt → MusicSpecification.
 * Never sends the world prompt.
 */
export async function composeMusic(prompt, options = {}) {
  const text = String(prompt ?? '').trim()
  if (!text) {
    return {
      specification: heuristicMusicSpecification(''),
      director: 'heuristic',
    }
  }

  const response = await fetch(apiUrl('/api/music/compose'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ prompt: text.slice(0, 200) }),
    signal: options.signal,
  })

  const requestId = response.headers?.get?.('X-Request-ID') ?? null
  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new ApiError({
      message: 'Music director returned an unreadable response.',
      status: response.status,
      requestId,
    })
  }

  if (response.status === 429 || payload?.error === 'rate_limit_exceeded') {
    throw new ApiError({
      error: 'rate_limit_exceeded',
      message: payload?.message || 'Too many music requests. Please wait a moment.',
      status: 429,
      retryAfter: Number(payload?.retryAfter) || 30,
      requestId: payload?.requestId ?? requestId,
    })
  }

  if (!response.ok) {
    throw new ApiError({
      error: payload?.error || 'request_failed',
      message: payload?.message || `Music director failed (${response.status}).`,
      status: response.status,
      requestId: payload?.requestId ?? requestId,
    })
  }

  return {
    specification: sanitizeMusicSpecification(payload.specification),
    director: payload.director ?? 'llm',
    notice: payload.notice ?? null,
    requestId: payload.requestId ?? requestId,
  }
}
