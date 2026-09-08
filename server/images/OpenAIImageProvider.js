import { createAsset } from '../../src/assets/AssetProvider.js'
import { fetchWithRetry } from '../ai/http.js'

const GPT_IMAGE_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto'])
const DALLE3_SIZES = new Set(['1024x1024', '1792x1024', '1024x1792'])
const GPT_IMAGE_QUALITY = new Set(['low', 'medium', 'high', 'auto'])
const DALLE_QUALITY = new Set(['standard', 'hd'])

function imagesUrl(baseUrl) {
  const trimmed = String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  if (trimmed.endsWith('/images/generations')) {
    return trimmed
  }
  return `${trimmed}/images/generations`
}

export function compatibleImageSize(model, requested) {
  const name = String(model || '')
  const size = String(requested || '').trim()
  if (name.includes('gpt-image')) {
    if (GPT_IMAGE_SIZES.has(size)) {
      return size
    }
    if (size === '1024x1792') {
      return '1024x1536'
    }
    return '1536x1024'
  }
  if (name.includes('dall-e-3')) {
    return DALLE3_SIZES.has(size) ? size : '1024x1024'
  }
  return size || '1024x1024'
}

export function buildImagePayload({ model, prompt, size, quality }) {
  const payload = {
    model,
    prompt,
    n: 1,
    size: compatibleImageSize(model, size),
  }
  const q = String(quality || 'high').toLowerCase()
  if (String(model).includes('gpt-image') && GPT_IMAGE_QUALITY.has(q)) {
    payload.quality = q
  }
  if (String(model).includes('dall-e') && DALLE_QUALITY.has(q)) {
    payload.quality = q
  }
  return payload
}

export function publicImageError(detail, status) {
  const text = String(detail || '')
  if (status === 429 || /rate limit|too many requests/i.test(text)) {
    return 'The image service is busy. Wait a moment and try Explore again.'
  }
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    /server had an error|internal error|overloaded|try again later|help\.openai\.com/i.test(text)
  ) {
    return 'The image service was temporarily unavailable. Try Explore again.'
  }
  if (/content.?policy|safety system|moderation/i.test(text)) {
    return 'That scene was blocked by the image safety filter. Try a different description.'
  }
  if (/timed out/i.test(text)) {
    return 'Image generation timed out. Try Explore again.'
  }
  if (!text) {
    return `Image generation failed (${status || 'unknown'}).`
  }
  return text.length > 140 ? 'Image generation failed. Try Explore again.' : text
}

export function panoramaPrompt(request) {
  const tags = (request.tags ?? []).join(', ')
  return [
    'Equirectangular 360-degree panoramic photograph, seamless left-right wrap,',
    '2:1 aspect ratio, photorealistic environment, no people, no text, no UI, no watermark.',
    `Scene: ${request.description}.`,
    request.theme ? `Theme: ${String(request.theme).replace(/_/g, ' ')}.` : '',
    tags ? `Keywords: ${tags}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Expensive panorama generator. Models/objects are not generated here.
 * Swap generate() in tests. Never called from the browser.
 */
export function createOpenAIImageAssetProvider({
  apiKey,
  baseUrl = 'https://api.openai.com/v1',
  model = 'gpt-image-1',
  size,
  quality = 'high',
  timeoutMs = 120_000,
  store,
  fetchImpl = fetchWithRetry,
} = {}) {
  const configured = Boolean(apiKey && store)

  async function downloadImage(url) {
    const response = await fetchImpl(url, {}, { timeoutMs, retries: 1 })
    if (!response.ok) {
      throw new Error(`Failed to download generated image (${response.status}).`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, contentType: response.headers.get('content-type') || '' }
  }

  async function generate(request) {
    const payload = buildImagePayload({
      model,
      prompt: panoramaPrompt(request),
      size,
      quality,
    })

    let lastError = 'Image generation failed.'
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      const response = await fetchImpl(
        imagesUrl(baseUrl),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        { timeoutMs, retries: 0 }
      )

      const body = await response.json().catch(() => null)
      if (response.ok) {
        const item = body?.data?.[0]
        if (item?.b64_json) {
          return { buffer: Buffer.from(item.b64_json, 'base64'), contentType: 'image/png' }
        }
        if (item?.url) {
          return downloadImage(item.url)
        }
        throw new Error('Image model returned no image data.')
      }

      const detail = body?.error?.message || `Image generation failed (${response.status})`
      lastError = publicImageError(detail, response.status)
      const retryable = response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503
      if (retryable && attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        continue
      }
      throw new Error(lastError)
    }
    throw new Error(lastError)
  }

  return {
    id: 'openai-image',
    expensive: true,
    configured,
    canHandle(request) {
      return request.kind === 'panorama'
    },
    async resolve(request) {
      if (!configured) {
        return { status: 'unavailable', reason: 'Generation provider not configured.' }
      }
      if (request.kind !== 'panorama') {
        return { status: 'unavailable', reason: 'Only panorama generation is enabled.' }
      }

      const cached = store.get(request)
      if (cached) {
        return { status: 'resolved', asset: cached }
      }

      try {
        const image = await generate(request)
        const asset = store.save(request, image.buffer, image.contentType)
        return {
          status: 'resolved',
          asset: createAsset({
            ...asset,
            source: 'generated',
            description: request.description,
          }),
        }
      } catch (error) {
        return {
          status: 'unavailable',
          reason: error instanceof Error ? error.message : 'Image generation failed.',
        }
      }
    },
  }
}
