import { assetCatalog, scoreCatalogEntry } from './AssetCatalog.js'
import { createAsset } from './AssetProvider.js'

const MIN_SCORE = 0.18

export function createCatalogAssetProvider(catalog = assetCatalog, options = {}) {
  const minScore = options.minScore ?? MIN_SCORE
  const kinds = options.kinds ?? null

  return {
    id: 'catalog',
    async resolve(request) {
      let best = null
      let bestScore = 0
      for (const entry of catalog) {
        if (kinds && !kinds.includes(entry.type)) {
          continue
        }
        if (entry.type !== request.kind) {
          continue
        }
        const score = scoreCatalogEntry(entry, request)
        if (score > bestScore) {
          best = entry
          bestScore = score
        }
      }

      if (!best || bestScore < minScore) {
        return { status: 'unavailable', reason: 'No catalog match.' }
      }

      return {
        status: 'resolved',
        asset: createAsset({
          id: best.id,
          kind: request.kind,
          source: 'catalog',
          url: best.url ?? null,
          primitive: best.primitive ?? null,
          description: best.description,
        }),
      }
    },
  }
}
