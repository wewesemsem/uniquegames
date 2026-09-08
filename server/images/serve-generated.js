import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, extname } from 'node:path'

const GENERATED_PATH = /^\/generated\/panoramas\/([A-Za-z0-9._-]+)\.(png|jpg|jpeg|webp)$/i
const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export function generatedFileFromUrl(urlPath, rootDir) {
  const path = String(urlPath || '').split('?')[0]
  const match = GENERATED_PATH.exec(path)
  if (!match) {
    return null
  }
  const root = normalize(rootDir)
  const filePath = normalize(join(root, 'panoramas', `${match[1]}.${match[2].toLowerCase()}`))
  if (!filePath.startsWith(root)) {
    return null
  }
  return filePath
}

/**
 * Serve runtime-generated panoramas from disk.
 * Vite's public-file list often misses gitignored files written after startup,
 * so TextureLoader would otherwise receive index.html and fail.
 */
export function createGeneratedAssetsMiddleware(rootDir) {
  const root = normalize(rootDir)

  return function serveGeneratedAssets(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    const filePath = generatedFileFromUrl(req.url, root)
    if (!filePath) {
      next()
      return
    }
    if (!existsSync(filePath)) {
      res.statusCode = 404
      res.setHeader('Cache-Control', 'no-store')
      res.end()
      return
    }

    const stat = statSync(filePath)
    res.statusCode = 200
    res.setHeader('Content-Type', TYPES[extname(filePath)] || 'application/octet-stream')
    res.setHeader('Content-Length', String(stat.size))
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(filePath).pipe(res)
  }
}
