import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assetRequestKey } from '../../src/assets/AssetCache.js'
import { createAsset } from '../../src/assets/AssetProvider.js'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

function extensionFor(bytes, contentType = '') {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return 'png'
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'jpg'
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49) {
    return 'webp'
  }
  if (contentType.includes('png')) {
    return 'png'
  }
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return 'jpg'
  }
  return 'png'
}

export function createGeneratedImageStore({
  rootDir = join(process.cwd(), 'public', 'generated'),
  publicPath = '/generated',
} = {}) {
  const panoramaDir = join(rootDir, 'panoramas')
  mkdirSync(panoramaDir, { recursive: true })

  function fileId(request) {
    return createHash('sha256').update(assetRequestKey(request)).digest('hex').slice(0, 24)
  }

  function get(request) {
    if (request.kind !== 'panorama') {
      return null
    }
    const id = fileId(request)
    for (const ext of ['png', 'jpg', 'webp']) {
      const path = join(panoramaDir, `${id}.${ext}`)
      if (existsSync(path)) {
        const version = Math.floor(statSync(path).mtimeMs)
        return createAsset({
          id: `generated-${id}`,
          kind: 'panorama',
          source: 'generated-cache',
          url: `${publicPath}/panoramas/${id}.${ext}?v=${version}`,
          description: request.description,
        })
      }
    }
    return null
  }

  function save(request, bytes, contentType) {
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error('Generated image exceeded size limit.')
    }
    const id = fileId(request)
    const ext = extensionFor(bytes, contentType)
    mkdirSync(panoramaDir, { recursive: true })
    const path = join(panoramaDir, `${id}.${ext}`)
    writeFileSync(path, bytes)
    const version = Math.floor(statSync(path).mtimeMs)
    return createAsset({
      id: `generated-${id}`,
      kind: 'panorama',
      source: 'generated',
      url: `${publicPath}/panoramas/${id}.${ext}?v=${version}`,
      description: request.description,
    })
  }

  function read(path) {
    return readFileSync(path)
  }

  return { get, save, read, fileId, panoramaDir }
}

export function createMemoryImageStore() {
  const files = new Map()
  return {
    get(request) {
      if (request.kind !== 'panorama') {
        return null
      }
      return files.get(assetRequestKey(request)) ?? null
    },
    save(request, bytes) {
      if (bytes.length > MAX_IMAGE_BYTES) {
        throw new Error('Generated image exceeded size limit.')
      }
      const id = fileIdFromRequest(request)
      const asset = createAsset({
        id: `generated-${id}`,
        kind: 'panorama',
        source: 'generated',
        url: `/generated/panoramas/${id}.png`,
        description: request.description,
      })
      files.set(assetRequestKey(request), asset)
      return asset
    },
  }
}

function fileIdFromRequest(request) {
  return createHash('sha256').update(assetRequestKey(request)).digest('hex').slice(0, 24)
}
