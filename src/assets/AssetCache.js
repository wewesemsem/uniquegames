export function assetRequestKey(request) {
  const tags = [...(request.tags ?? [])].map((tag) => tag.toLowerCase()).sort()
  return JSON.stringify({
    kind: request.kind,
    type: request.type,
    theme: request.theme ?? '',
    description: (request.description ?? '').toLowerCase().trim(),
    tags,
  })
}

export function createAssetCache() {
  const memory = new Map()

  return {
    keyFor: assetRequestKey,
    get(request) {
      return memory.get(assetRequestKey(request)) ?? null
    },
    set(request, asset) {
      memory.set(assetRequestKey(request), asset)
      return asset
    },
    clear() {
      memory.clear()
    },
  }
}

export const assetCache = createAssetCache()
