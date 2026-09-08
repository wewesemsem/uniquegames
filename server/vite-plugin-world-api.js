import { join } from 'node:path'
import { createWorldGenerationHandler } from './world-generation.js'
import { createGeneratedAssetsMiddleware } from './images/serve-generated.js'

function isWorldGenerate(req) {
  const path = req.url?.split('?')[0]
  return path === '/api/world/generate'
}

export function worldApiPlugin(env) {
  // Build once at plugin init. Restart `npm run dev` after changing server/*.js.
  const handle = createWorldGenerationHandler(env)
  const generatedRoot = join(process.cwd(), env.GENERATED_ASSET_DIR || 'public/generated')
  const serveGenerated = createGeneratedAssetsMiddleware(generatedRoot)

  async function middleware(req, res, next) {
    if (!isWorldGenerate(req)) {
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

    await handle(req, res)
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
