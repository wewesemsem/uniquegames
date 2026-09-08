const RETRYABLE = new Set([429, 500, 502, 503])

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Upstream request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchWithRetry(url, options = {}, { timeoutMs = 30_000, retries = 1 } = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs)
      if (RETRYABLE.has(response.status) && attempt < retries) {
        lastError = new Error(`Upstream request failed (${response.status})`)
        await wait(700 * (attempt + 1))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt >= retries) {
        throw error
      }
      await wait(700 * (attempt + 1))
    }
  }
  throw lastError ?? new Error('Upstream request failed.')
}
