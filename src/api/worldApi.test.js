import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, generateWorldSpecification } from './worldApi.js'

describe('worldApi', () => {
  it('maps HTTP 429 into a retryable ApiError', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: {
        get(name) {
          if (name === 'Retry-After') {
            return '12'
          }
          if (name === 'X-Request-ID') {
            return 'req-429'
          }
          return null
        },
      },
      async json() {
        return {
          error: 'rate_limit_exceeded',
          message: "You're sending requests too quickly. Please wait a moment.",
          retryAfter: 12,
        }
      },
    })

    try {
      await assert.rejects(
        () => generateWorldSpecification('I want to explore space.'),
        (error) => {
          assert.equal(error instanceof ApiError, true)
          assert.equal(error.status, 429)
          assert.equal(error.retryAfter, 12)
          assert.match(error.message, /too quickly/i)
          return true
        }
      )
    } finally {
      globalThis.fetch = original
    }
  })

  it('emits streamed rooms as ndjson events', async () => {
    const original = globalThis.fetch
    const events = [
      { type: 'status', message: 'Building your world...' },
      { type: 'world', specification: { theme: 'space' }, director: 'llm', models: { image: 'gpt-image-1' } },
      { type: 'room', index: 0, total: 2, room: { spec: { id: 'room1' }, panorama: { url: '/generated/a.png' } } },
      { type: 'room', index: 1, total: 2, room: { spec: { id: 'room2' }, panorama: { url: '/generated/b.png' } } },
      { type: 'done', generation: { generatedAssets: 2 } },
    ]
    const encoder = new TextEncoder()
    globalThis.fetch = async () => {
      let index = 0
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            if (String(name).toLowerCase() === 'content-type') {
              return 'application/x-ndjson; charset=utf-8'
            }
            return null
          },
        },
        body: new ReadableStream({
          pull(controller) {
            if (index >= events.length) {
              controller.close()
              return
            }
            controller.enqueue(encoder.encode(`${JSON.stringify(events[index])}\n`))
            index += 1
          },
        }),
      }
    }

    const seen = []
    try {
      const payload = await generateWorldSpecification('I want to explore space.', {
        onEvent: (event) => seen.push(event.type),
      })
      assert.deepEqual(seen, ['status', 'world', 'room', 'room', 'done'])
      assert.equal(payload.resolved.rooms.length, 2)
      assert.equal(payload.generation.generatedAssets, 2)
    } finally {
      globalThis.fetch = original
    }
  })

  it('does not wrap AbortError when the caller cancels', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async (_url, options) => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      options.signal?.throwIfAborted?.()
      throw error
    }
    try {
      await assert.rejects(
        () => generateWorldSpecification('I want to explore space.', { onEvent() {} }),
        (error) => {
          assert.equal(error.name, 'AbortError')
          assert.equal(error instanceof ApiError, false)
          return true
        }
      )
    } finally {
      globalThis.fetch = original
    }
  })
})
