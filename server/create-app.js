import { join } from 'node:path'
import { applyCorsHeaders, parseCorsOrigins } from './cors.js'
import { sendJson } from './http.js'
import { createGeneratedAssetsMiddleware } from './images/serve-generated.js'
import { createWorldGenerationHandler } from './world-generation.js'

function requestPath(req) {
  return String(req.url || '').split('?')[0]
}

function isWorldGenerate(path) {
  return path === '/api/world/generate'
}

function isHealth(path) {
  return path === '/health' || path === '/api/health'
}

/**
 * Shared Node request listener for Heroku (and any non-Vite host).
 */
export function createApp(env = process.env, deps = {}) {
  const handle = deps.handle ?? createWorldGenerationHandler(env)
  const generatedRoot =
    deps.generatedRoot ?? join(process.cwd(), env.GENERATED_ASSET_DIR || 'public/generated')
  const serveGenerated = deps.serveGenerated ?? createGeneratedAssetsMiddleware(generatedRoot)
  const origins = deps.origins ?? parseCorsOrigins(env)

  return function app(req, res) {
    const path = requestPath(req)
    const corsOk = applyCorsHeaders(req, res, origins)

    if (req.method === 'OPTIONS') {
      res.statusCode = corsOk ? 204 : 403
      res.end()
      return
    }

    if (!corsOk && req.headers?.origin) {
      sendJson(res, 403, { error: 'cors_denied', message: 'Origin not allowed.' })
      return
    }

    if (isHealth(path)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
      }
      sendJson(res, 200, { ok: true })
      return
    }

    serveGenerated(req, res, () => {
      if (!isWorldGenerate(path)) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method_not_allowed', message: 'Method not allowed.' })
        return
      }

      Promise.resolve(handle(req, res)).catch((error) => {
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: 'internal_error',
            message: error?.message || 'Internal server error.',
          })
        }
      })
    })
  }
}
