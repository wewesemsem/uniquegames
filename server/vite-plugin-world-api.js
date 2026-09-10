import { join } from 'node:path'
import { createMusicComposeHandler } from './music-generation.js'
import { createWorldGenerationHandler } from './world-generation.js'
import { createGeneratedAssetsMiddleware } from './images/serve-generated.js'

function requestPath(req) {
  return req.url?.split('?')[0]
}

function isWorldGenerate(req) {
  return requestPath(req) === '/api/world/generate'
}

function isMusicCompose(req) {
  return requestPath(req) === '/api/music/compose'
}

export function worldApiPlugin(env) {
  // Build once at plugin init. Restart `npm run dev` after changing server/*.js.
  const handle = createWorldGenerationHandler(env)
  const handleMusic = createMusicComposeHandler(env)
  const generatedRoot = join(process.cwd(), env.GENERATED_ASSET_DIR || 'public/generated')
  const serveGenerated = createGeneratedAssetsMiddleware(generatedRoot)

  async function middleware(req, res, next) {
    const worldRoute = isWorldGenerate(req)
    const musicRoute = isMusicCompose(req)
    if (!worldRoute && !musicRoute) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed.' }))
      return
    }

    await (musicRoute ? handleMusic : handle)(req, res)
  }

  return {
    name: 'world-api',
    configureServer(server) {
      server.middlewares.use(serveGenerated)
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveGenerated)
      server.middlewares.use(middleware)
    },
  }
}
