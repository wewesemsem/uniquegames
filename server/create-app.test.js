import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyCorsHeaders, parseCorsOrigins, resolveCorsOrigin } from './cors.js'
import { createApp } from './create-app.js'
import { createMockReq, createMockRes } from './http-mocks.js'

describe('cors', () => {
  it('defaults to allow any origin when CORS_ORIGINS is empty', () => {
    assert.deepEqual(parseCorsOrigins({}), ['*'])
    assert.equal(resolveCorsOrigin('https://app.netlify.app', ['*']), '*')
  })

  it('allows only listed origins when configured', () => {
    const origins = parseCorsOrigins({
      CORS_ORIGINS: 'https://app.netlify.app, http://localhost:5173',
    })
    assert.deepEqual(origins, ['https://app.netlify.app', 'http://localhost:5173'])
    assert.equal(resolveCorsOrigin('https://app.netlify.app', origins), 'https://app.netlify.app')
    assert.equal(resolveCorsOrigin('https://evil.example', origins), null)
  })

  it('ignores trailing slashes on configured origins', () => {
    const origins = parseCorsOrigins({
      CORS_ORIGINS: 'https://3dworldgames.netlify.app/',
    })
    assert.deepEqual(origins, ['https://3dworldgames.netlify.app'])
    assert.equal(
      resolveCorsOrigin('https://3dworldgames.netlify.app', origins),
      'https://3dworldgames.netlify.app'
    )
  })
})

describe('createApp', () => {
  it('serves health and world generate with CORS', async () => {
    const handle = async (_req, res) => {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, specification: { theme: 'test' } }))
    }
    const app = createApp(
      { CORS_ORIGINS: 'https://app.netlify.app' },
      {
        handle,
        serveGenerated: (_req, _res, next) => next(),
      }
    )

    const healthReq = createMockReq({
      method: 'GET',
      url: '/health',
      body: null,
      headers: { origin: 'https://app.netlify.app' },
    })
    const healthRes = createMockRes()
    app(healthReq, healthRes)
    assert.equal(healthRes.statusCode, 200)
    assert.equal(healthRes.headers['access-control-allow-origin'], 'https://app.netlify.app')
    assert.equal(JSON.parse(healthRes.body).ok, true)

    const optionsReq = createMockReq({
      method: 'OPTIONS',
      url: '/api/world/generate',
      body: null,
      headers: { origin: 'https://app.netlify.app' },
    })
    const optionsRes = createMockRes()
    app(optionsReq, optionsRes)
    assert.equal(optionsRes.statusCode, 204)

    const postReq = createMockReq({
      method: 'POST',
      body: { prompt: 'hello' },
      headers: { origin: 'https://app.netlify.app' },
    })
    const postRes = createMockRes()
    await new Promise((resolve) => {
      const originalEnd = postRes.end.bind(postRes)
      postRes.end = (...args) => {
        originalEnd(...args)
        resolve()
      }
      app(postReq, postRes)
    })
    assert.equal(postRes.statusCode, 200)
    assert.equal(JSON.parse(postRes.body).ok, true)
  })

  it('rejects disallowed origins', () => {
    const app = createApp(
      { CORS_ORIGINS: 'https://app.netlify.app' },
      {
        handle: async () => {},
        serveGenerated: (_req, _res, next) => next(),
      }
    )
    const req = createMockReq({
      method: 'POST',
      body: { prompt: 'hello' },
      headers: { origin: 'https://evil.example' },
    })
    const res = createMockRes()
    app(req, res)
    assert.equal(res.statusCode, 403)
  })
})

describe('applyCorsHeaders', () => {
  it('sets wildcard when allowed', () => {
    const req = { headers: { origin: 'https://anywhere.example' } }
    const headers = {}
    const res = {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value
      },
    }
    assert.equal(applyCorsHeaders(req, res, ['*']), true)
    assert.equal(headers['access-control-allow-origin'], '*')
  })
})
