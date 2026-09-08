import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createWorldGenerationHandler } from './world-generation.js'
import { loadServerConfig } from './config.js'
import { createIdempotencyCache } from './idempotency.js'
import { createMemoryRateLimitStore } from './rate-limit/store.js'
import { createRateLimiter } from './rate-limit/RateLimiter.js'
import { createMockReq, createMockRes, spaceSpec } from './http-mocks.js'

function testConfig(overrides = {}) {
  return loadServerConfig({
    WORLD_RATE_LIMIT_PER_MINUTE: '10',
    WORLD_RATE_LIMIT_PER_10_MINUTES: '100',
    WORLD_RATE_LIMIT_PER_HOUR: '100',
    WORLD_RATE_LIMIT_BUDGET_PER_10_MINUTES: '100',
    WORLD_RATE_LIMIT_PER_DAY: '100',
    GENERATION_RATE_LIMIT_PER_MINUTE: '50',
    GENERATION_RATE_LIMIT_PER_DAY: '100',
    ...overrides,
  })
}

function createHandler(overrides = {}, deps = {}) {
  const now = deps.now ?? (() => 50_000)
  const store = deps.store ?? createMemoryRateLimitStore({ now })
  const { useBuiltInDirector, ...handlerDeps } = deps
  return {
    handle: createWorldGenerationHandler(overrides, {
      config: testConfig(overrides),
      store,
      rateLimiter: handlerDeps.rateLimiter ?? createRateLimiter({ store, now }),
      now,
      log: () => {},
      idempotency: handlerDeps.idempotency ?? createIdempotencyCache({ now, ttlMs: 15_000 }),
      ...(useBuiltInDirector
        ? {}
        : {
            directWorld:
              handlerDeps.directWorld ??
              (async () => ({ specification: spaceSpec(), director: 'heuristic', retries: 0 })),
          }),
      ...handlerDeps,
    }),
    store,
  }
}

async function post(handle, { body, ip, raw, headers } = {}) {
  const req = createMockReq({ body, ip, raw, headers })
  const res = createMockRes()
  await handle(req, res)
  return res
}

describe('POST /api/world/generate', () => {
  it('builds a world for a normal prompt', async () => {
    const { handle } = createHandler()
    const res = await post(handle, { body: { prompt: 'I want to explore space.' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.specification.theme, 'space')
    assert.ok(res.headers['x-request-id'])
  })

  it('rate-limits rapid requests and never calls the director', async () => {
    let directorCalls = 0
    const { handle } = createHandler({ WORLD_RATE_LIMIT_PER_MINUTE: '2' }, {
      directWorld: async () => {
        directorCalls += 1
        return { specification: spaceSpec(), director: 'llm', retries: 0 }
      },
    })

    assert.equal((await post(handle, { ip: '10.0.0.9', body: { prompt: 'explore space one' } })).statusCode, 200)
    assert.equal((await post(handle, { ip: '10.0.0.9', body: { prompt: 'explore space two' } })).statusCode, 200)
    const limited = await post(handle, { ip: '10.0.0.9', body: { prompt: 'explore space three' } })

    assert.equal(limited.statusCode, 429)
    assert.equal(limited.payload.error, 'rate_limit_exceeded')
    assert.ok(limited.payload.retryAfter >= 1)
    assert.equal(limited.headers['retry-after'], String(limited.payload.retryAfter))
    assert.equal(directorCalls, 2)
  })

  it('rejects an empty prompt', async () => {
    const { handle } = createHandler()
    const res = await post(handle, { body: { prompt: '   ' } })
    assert.equal(res.statusCode, 400)
    assert.match(res.payload.message, /describe a world/i)
  })

  it('rejects an oversized prompt', async () => {
    const { handle } = createHandler({ MAX_PROMPT_LENGTH: '8' })
    const res = await post(handle, { body: { prompt: 'this prompt is way too long' } })
    assert.equal(res.statusCode, 400)
    assert.match(res.payload.message, /too long/i)
  })

  it('rejects an oversized request body with 413', async () => {
    const { handle } = createHandler({ MAX_REQUEST_BODY_BYTES: '32' })
    const res = await post(handle, { raw: Buffer.alloc(64, 97) })
    assert.equal(res.statusCode, 413)
    assert.equal(res.payload.error, 'payload_too_large')
  })

  it('rejects a world that exceeds room limits', async () => {
    const spec = spaceSpec()
    spec.rooms.push({
      id: 'room4',
      name: 'Extra',
      environment: { type: 'panorama', description: 'Too many rooms', tags: [] },
      objects: [],
      hotspots: [],
    })
    const { handle } = createHandler({ MAX_ROOMS: '3' }, {
      directWorld: async () => ({ specification: spec, director: 'llm', retries: 0 }),
    })
    const res = await post(handle, { body: { prompt: 'too many rooms please' } })
    assert.equal(res.statusCode, 422)
    assert.equal(res.payload.error, 'invalid_world')
  })

  it('rejects a world that exceeds object limits', async () => {
    const spec = spaceSpec()
    spec.rooms[0].objects = Array.from({ length: 21 }, (_, index) => ({
      type: 'crate',
      description: `Crate ${index + 1}`,
      tags: ['crate'],
    }))
    const { handle } = createHandler({ MAX_OBJECTS_PER_ROOM: '20' }, {
      directWorld: async () => ({ specification: spec, director: 'llm', retries: 0 }),
    })
    const res = await post(handle, { body: { prompt: 'too many objects' } })
    assert.equal(res.statusCode, 422)
  })

  it('rejects a world that exceeds hotspot limits', async () => {
    const spec = spaceSpec()
    spec.rooms[0].hotspots = Array.from({ length: 11 }, (_, index) => ({
      id: `hs-${index}`,
      label: `Go ${index}`,
      targetRoom: 'room2',
      description: 'Travel',
    }))
    const { handle } = createHandler({ MAX_HOTSPOTS_PER_ROOM: '10' }, {
      directWorld: async () => ({ specification: spec, director: 'llm', retries: 0 }),
    })
    const res = await post(handle, { body: { prompt: 'too many hotspots' } })
    assert.equal(res.statusCode, 422)
  })

  it('shares one director job for duplicate in-flight requests', async () => {
    let directorCalls = 0
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const { handle } = createHandler({}, {
      directWorld: async () => {
        directorCalls += 1
        await gate
        return { specification: spaceSpec(), director: 'llm', retries: 0 }
      },
    })

    const first = post(handle, { body: { prompt: 'same world please' }, ip: '10.0.0.4' })
    const second = post(handle, { body: { prompt: 'same world please' }, ip: '10.0.0.4' })
    const waitStart = Date.now()
    while (directorCalls < 1) {
      if (Date.now() - waitStart > 2000) {
        throw new Error('director was never called')
      }
      await new Promise((resolve) => setImmediate(resolve))
    }
    await new Promise((resolve) => setImmediate(resolve))
    release()
    const [a, b] = await Promise.all([first, second])

    assert.equal(a.statusCode, 200)
    assert.equal(b.statusCode, 200)
    assert.equal(directorCalls, 1)
    assert.equal(a.payload.generation.duplicate || b.payload.generation.duplicate, true)
  })

  it('returns 502 when the director fails without crashing', async () => {
    const { handle } = createHandler({}, {
      directWorld: async () => {
        throw new Error('upstream exploded')
      },
    })
    const res = await post(handle, { body: { prompt: 'break please' } })
    assert.equal(res.statusCode, 502)
    assert.equal(res.payload.error, 'director_failed')
  })

  it('falls back to the heuristic director when the LLM fails', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('network down')
    }
    try {
      const { handle } = createHandler({ LLM_API_KEY: 'sk-test' }, { useBuiltInDirector: true })
      const res = await post(handle, { body: { prompt: 'I want to explore a forest.' } })
      assert.equal(res.statusCode, 200)
      assert.equal(res.payload.director, 'heuristic')
      assert.match(res.payload.notice ?? '', /heuristic/i)
    } finally {
      globalThis.fetch = original
    }
  })

  it('generates panoramas with the image model and returns resolved URLs', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', ENVIRONMENT_MODE: 'IMAGE_GENERATION' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async (url, options) => {
          imageCalls += 1
          assert.match(String(url), /images\/generations/)
          const payload = JSON.parse(options.body)
          assert.equal(payload.model, 'gpt-image-1')
          assert.equal(payload.n, 1)
          assert.equal(payload.quality, 'high')
          assert.equal(payload.size, '1536x1024')
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            async json() {
              return { data: [{ b64_json: png.toString('base64') }] }
            },
          }
        },
      }
    )

    const res = await post(handle, { body: { prompt: 'I want to explore space.' } })
    assert.equal(res.statusCode, 200)
    assert.equal(imageCalls, 3)
    const rooms = res.payload.resolved.rooms
    assert.equal(rooms.length, 3)
    assert.match(rooms[0].panorama.url, /^\/generated\/panoramas\//)
    assert.equal(rooms[0].panorama.source, 'generated')
    assert.equal(rooms[1].panorama.source, 'generated')
    assert.equal(rooms[2].panorama.source, 'generated')
    assert.equal(res.payload.generation.generatedAssets, 3)
    assert.equal(res.payload.generation.imageLimit, 3)
    assert.equal(res.payload.models.image, 'gpt-image-1')
  })

  it('respects IMAGE_GENERATION_COUNT=1 and falls back for later rooms', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', IMAGE_GENERATION_COUNT: '1', ENVIRONMENT_MODE: 'IMAGE_GENERATION' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async () => {
          imageCalls += 1
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            async json() {
              return { data: [{ b64_json: png.toString('base64') }] }
            },
          }
        },
      }
    )
    const res = await post(handle, { body: { prompt: 'I want to explore space.' } })
    assert.equal(imageCalls, 1)
    assert.equal(res.payload.resolved.rooms[0].panorama.source, 'generated')
    assert.equal(res.payload.resolved.rooms[1].panorama.source, 'fallback')
    assert.equal(res.payload.generation.imageLimit, 1)
  })

  it('can generate one panorama per room when IMAGE_GENERATION_COUNT is raised', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', IMAGE_GENERATION_COUNT: '3', ENVIRONMENT_MODE: 'IMAGE_GENERATION' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async () => {
          imageCalls += 1
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            async json() {
              return { data: [{ b64_json: png.toString('base64') }] }
            },
          }
        },
      }
    )
    const res = await post(handle, { body: { prompt: 'I want to explore space.' } })
    assert.equal(imageCalls, 3)
    assert.equal(res.payload.generation.generatedAssets, 3)
    assert.ok(res.payload.resolved.rooms.every((room) => room.panorama.source === 'generated'))
  })

  it('uses a fallback panorama when the image model fails', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', ENVIRONMENT_MODE: 'IMAGE_GENERATION' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async () => {
          throw new Error('image API down')
        },
      }
    )
    const res = await post(handle, { body: { prompt: 'Take me underwater.' } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.payload.resolved.rooms[0].panorama.url)
    assert.equal(res.payload.resolved.rooms[0].panorama.source, 'fallback')
    assert.equal(res.payload.generation.missing, 3)
    assert.ok(res.payload.generation.reasons.some((reason) => /image API down/i.test(reason)))
  })

  it('streams room 1 first while later rooms continue', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const gates = []
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', IMAGE_GENERATION_COUNT: '3', ENVIRONMENT_MODE: 'IMAGE_GENERATION' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async () => {
          imageCalls += 1
          await new Promise((resolve) => {
            gates.push(resolve)
          })
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            async json() {
              return { data: [{ b64_json: png.toString('base64') }] }
            },
          }
        },
      }
    )

    const req = createMockReq({
      body: { prompt: 'I want to explore space.' },
      headers: { accept: 'application/x-ndjson' },
    })
    const res = createMockRes()
    const finished = handle(req, res)

    async function waitFor(predicate) {
      const started = Date.now()
      while (!predicate()) {
        if (Date.now() - started > 2000) {
          throw new Error('timed out waiting for stream event')
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    await waitFor(() => gates.length >= 1)
    assert.equal(res.events.filter((event) => event.type === 'room').length, 0)
    assert.ok(res.events.some((event) => event.type === 'world'))

    // Finish room 1 only — player can enter while rooms 2–3 are still gated.
    gates[0]()
    await waitFor(() => res.events.some((event) => event.type === 'room' && event.index === 0))
    assert.equal(res.events.filter((event) => event.type === 'room').length, 1)

    // Background rooms start after room 1 unlocks.
    await waitFor(() => gates.length >= 3)
    gates[1]()
    gates[2]()
    await finished

    const rooms = res.events.filter((event) => event.type === 'room')
    assert.equal(rooms.length, 3)
    assert.equal(rooms[0].room.panorama.source, 'generated')
    assert.equal(rooms[1].room.panorama.source, 'generated')
    assert.equal(rooms[2].room.panorama.source, 'generated')
    assert.ok(res.events.some((event) => event.type === 'done'))
    assert.equal(imageCalls, 3)
    assert.match(String(res.headers['content-type']), /ndjson/)
  })

  it('uses procedural scenes and never calls the image API', async () => {
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', ENVIRONMENT_MODE: 'PROCEDURAL_360' },
      {
        imageFetch: async () => {
          imageCalls += 1
          throw new Error('image API must not be called in PROCEDURAL_360 mode')
        },
        directScenes: async ({ specification }) => ({
          scenes: Object.fromEntries(
            specification.rooms.map((room) => [
              room.id,
              {
                environment: 'space',
                timeOfDay: 'night',
                sky: 'stars',
                ground: 'rock',
                fog: 0.1,
                treeDensity: 0,
                lighting: 0.4,
                wind: 0.1,
                particles: 'sparks',
                colorMood: 'cool',
              },
            ])
          ),
          source: 'llm',
        }),
      }
    )

    const res = await post(handle, { body: { prompt: 'I want to explore space.' } })
    assert.equal(res.statusCode, 200)
    assert.equal(imageCalls, 0)
    assert.equal(res.payload.environmentMode, 'PROCEDURAL_360')
    assert.equal(res.payload.models.image, null)
    assert.equal(res.payload.generation.generatedAssets, 0)
    assert.equal(res.payload.resolved.rooms.length, 3)
    for (const room of res.payload.resolved.rooms) {
      assert.equal(room.panorama, null)
      assert.equal(room.procedural.environment, 'space')
      assert.equal(room.procedural.sky, 'stars')
    }
  })

  it('allows per-request IMAGE_GENERATION override with high-quality gpt-image-1', async () => {
    const { createMemoryImageStore } = await import('./images/store.js')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    let imageCalls = 0
    const { handle } = createHandler(
      { IMAGE_API_KEY: 'sk-image', ENVIRONMENT_MODE: 'PROCEDURAL_360' },
      {
        imageStore: createMemoryImageStore(),
        imageFetch: async (url, options) => {
          imageCalls += 1
          const payload = JSON.parse(options.body)
          assert.equal(payload.model, 'gpt-image-1')
          assert.equal(payload.quality, 'high')
          assert.equal(payload.size, '1536x1024')
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            async json() {
              return { data: [{ b64_json: png.toString('base64') }] }
            },
          }
        },
      }
    )

    const res = await post(handle, {
      body: { prompt: 'I want to explore space.', environmentMode: 'IMAGE_GENERATION' },
    })
    assert.equal(res.statusCode, 200)
    assert.equal(imageCalls, 3)
    assert.equal(res.payload.environmentMode, 'IMAGE_GENERATION')
    assert.equal(res.payload.models.image, 'gpt-image-1')
    assert.equal(res.payload.models.environmentMode, 'IMAGE_GENERATION')
    assert.match(res.payload.resolved.rooms[0].panorama.url, /^\/generated\/panoramas\//)
    assert.ok(res.payload.resolved.rooms.every((room) => room.panorama.source === 'generated'))
  })
})
