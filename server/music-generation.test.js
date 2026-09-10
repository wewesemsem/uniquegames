import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMusicComposeHandler } from './music-generation.js'
import { createMockReq, createMockRes } from './http-mocks.js'

describe('music compose handler', () => {
  it('uses only the music prompt and never requires a world prompt', async () => {
    const handle = createMusicComposeHandler(
      {},
      {
        config: {
          llmApiKey: 'test-key',
          llmBaseUrl: 'https://example.test/v1',
          llmModel: 'test-model',
          llmTimeoutMs: 5_000,
        },
        composeLlm: async ({ prompt }) => {
          assert.equal(prompt, 'thriller')
          return {
            specification: {
              label: 'thriller',
              bpm: 98,
              energy: 0.55,
              tension: 0.8,
              brightness: 0.3,
              density: 0.35,
              scale: 'minor',
              percussion: 'steady',
              drone: true,
              pad: 'soft',
              rootMidi: 50,
            },
            retries: 0,
          }
        },
        log: () => {},
      }
    )

    const req = createMockReq({
      method: 'POST',
      url: '/api/music/compose',
      body: { prompt: 'thriller' },
    })
    const res = createMockRes()
    await handle(req, res)
    assert.equal(res.statusCode, 200)
    const payload = JSON.parse(res.body)
    assert.equal(payload.director, 'llm')
    assert.equal(payload.specification.label, 'thriller')
    assert.equal(payload.specification.bpm, 98)
  })

  it('rejects extra keys so world fields cannot leak in', async () => {
    const handle = createMusicComposeHandler({}, { log: () => {} })
    const req = createMockReq({
      method: 'POST',
      url: '/api/music/compose',
      body: { prompt: 'thriller', worldPrompt: 'space' },
    })
    const res = createMockRes()
    await handle(req, res)
    assert.equal(res.statusCode, 400)
  })

  it('falls back to heuristic when LLM is unset', async () => {
    const handle = createMusicComposeHandler(
      {},
      {
        config: {
          llmApiKey: '',
          llmBaseUrl: 'https://example.test/v1',
          llmModel: 'test-model',
          llmTimeoutMs: 5_000,
        },
        log: () => {},
      }
    )
    const req = createMockReq({
      method: 'POST',
      url: '/api/music/compose',
      body: { prompt: 'thriller' },
    })
    const res = createMockRes()
    await handle(req, res)
    assert.equal(res.statusCode, 200)
    const payload = JSON.parse(res.body)
    assert.equal(payload.director, 'heuristic')
    assert.equal(payload.specification.label, 'thriller')
  })
})
