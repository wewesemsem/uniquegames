import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createOpenAIImageAssetProvider, panoramaPrompt, buildImagePayload, compatibleImageSize, publicImageError } from './OpenAIImageProvider.js'
import { createMemoryImageStore } from './store.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('OpenAIImageAssetProvider', () => {
  it('is not configured without an API key', async () => {
    const provider = createOpenAIImageAssetProvider({ store: createMemoryImageStore() })
    assert.equal(provider.configured, false)
    const result = await provider.resolve({
      kind: 'panorama',
      description: 'Moon base',
      tags: ['moon'],
    })
    assert.equal(result.status, 'unavailable')
  })

  it('stores a generated panorama and reuses the cache', async () => {
    const store = createMemoryImageStore()
    let calls = 0
    const provider = createOpenAIImageAssetProvider({
      apiKey: 'sk-test',
      store,
      fetchImpl: async () => {
        calls += 1
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          async json() {
            return { data: [{ b64_json: png.toString('base64') }] }
          },
        }
      },
    })

    const request = {
      kind: 'panorama',
      type: 'panorama',
      theme: 'space',
      description: 'Lunar habitat interior',
      tags: ['moon', 'habitat'],
    }

    const first = await provider.resolve(request)
    const second = await provider.resolve(request)

    assert.equal(first.status, 'resolved')
    assert.match(first.asset.url, /^\/generated\/panoramas\//)
    assert.equal(second.asset.url, first.asset.url)
    assert.equal(calls, 1)
  })

  it('does not generate 3D models', async () => {
    const provider = createOpenAIImageAssetProvider({
      apiKey: 'sk-test',
      store: createMemoryImageStore(),
      fetchImpl: async () => {
        throw new Error('should not be called')
      },
    })
    const result = await provider.resolve({ kind: 'model', type: 'statue', description: 'A statue' })
    assert.equal(result.status, 'unavailable')
  })

  it('builds an equirectangular prompt', () => {
    const prompt = panoramaPrompt({
      description: 'Coral reef',
      theme: 'underwater',
      tags: ['ocean'],
    })
    assert.match(prompt, /equirectangular 360/i)
    assert.match(prompt, /Coral reef/)
  })

  it('does not send response_format and remaps dall-e sizes for gpt-image-1', async () => {
    const payload = buildImagePayload({
      model: 'gpt-image-1',
      prompt: 'A desert',
      size: '1792x1024',
      quality: 'standard',
    })
    assert.equal(payload.model, 'gpt-image-1')
    assert.equal(payload.size, '1536x1024')
    assert.equal('response_format' in payload, false)
    assert.equal('quality' in payload, false)
    assert.equal(compatibleImageSize('gpt-image-1', '1792x1024'), '1536x1024')

    let sent
    const provider = createOpenAIImageAssetProvider({
      apiKey: 'sk-test',
      model: 'gpt-image-1',
      size: '1792x1024',
      quality: 'standard',
      store: createMemoryImageStore(),
      fetchImpl: async (_url, options) => {
        sent = JSON.parse(options.body)
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          async json() {
            return { data: [{ b64_json: png.toString('base64') }] }
          },
        }
      },
    })
    await provider.resolve({
      kind: 'panorama',
      type: 'panorama',
      description: 'A desert canyon',
      tags: ['desert'],
    })
    assert.equal(sent.response_format, undefined)
    assert.equal(sent.size, '1536x1024')
  })

  it('defaults to one high-quality 1536x1024 image', () => {
    const payload = buildImagePayload({
      model: 'gpt-image-1',
      prompt: 'A desert',
    })
    assert.equal(payload.n, 1)
    assert.equal(payload.quality, 'high')
    assert.equal(payload.size, '1536x1024')
  })

  it('retries a 500 from the image API and then stores the image', async () => {
    let calls = 0
    const provider = createOpenAIImageAssetProvider({
      apiKey: 'sk-test',
      store: createMemoryImageStore(),
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) {
          return {
            ok: false,
            status: 500,
            async json() {
              return { error: { message: 'The server had an error while processing your request. Sorry about that!' } }
            },
          }
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          async json() {
            return { data: [{ b64_json: png.toString('base64') }] }
          },
        }
      },
    })
    const result = await provider.resolve({
      kind: 'panorama',
      type: 'panorama',
      description: 'Retry sky after outage',
      tags: ['retry'],
    })
    assert.equal(result.status, 'resolved')
    assert.equal(calls, 2)
  })

  it('hides raw OpenAI server errors from the UI', () => {
    const message = publicImageError(
      'The server had an error while processing your request. Sorry about that! help.openai.com req_abc',
      500
    )
    assert.match(message, /temporarily unavailable/i)
    assert.doesNotMatch(message, /help\.openai/)
  })
})
