import { createAsset } from './AssetProvider.js'
import { assetCache } from './AssetCache.js'
import { createCatalogAssetProvider } from './CatalogAssetProvider.js'
import { createExternalAssetProvider } from './ExternalAssetProvider.js'
import { createGeneratedAssetProvider } from './GeneratedAssetProvider.js'

const FALLBACK_COLOR = {
  panorama: null,
  model: '#7a8499',
}

function fallbackAsset(request, reason) {
  if (request.kind === 'panorama') {
    return createAsset({
      id: `fallback-pano-${request.theme ?? 'world'}`,
      kind: 'panorama',
      source: 'fallback',
      url: '/panoramas/room-2.jpg',
      description: `${request.description} (catalog fallback; ${reason})`,
    })
  }

  const primitive = /sphere|planet|orb|moon|rock/i.test(`${request.type} ${request.description}`)
    ? 'sphere'
    : 'box'

  return createAsset({
    id: `fallback-${primitive}-${request.type}`,
    kind: 'model',
    source: 'fallback',
    primitive,
    color: FALLBACK_COLOR.model,
    description: `${request.description} (placeholder primitive; ${reason})`,
  })
}

function providerCanHandle(provider, request) {
  if (typeof provider.canHandle === 'function') {
    return provider.canHandle(request)
  }
  return true
}

export function createAssetResolver(options = {}) {
  const providers = options.providers ?? [
    createCatalogAssetProvider(),
    createExternalAssetProvider(),
    createGeneratedAssetProvider(),
  ]
  const cache = options.cache ?? assetCache
  const cheapProviders = providers.filter((provider) => !provider.expensive)
  const generationProviders = providers.filter((provider) => provider.expensive)
  const log = options.log
  const requestId = options.requestId ?? null
  const maxGeneratedImages =
    options.maxGeneratedImages == null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(options.maxGeneratedImages) || 0)
  let generatedImages = 0

  function claimPanoramaSlot() {
    if (generatedImages >= maxGeneratedImages) {
      return false
    }
    generatedImages += 1
    return true
  }

  async function tryProviders(list, request) {
    let lastReason = 'No provider resolved the request.'
    for (const provider of list) {
      try {
        const result = await provider.resolve(request)
        if (result.status === 'resolved' && result.asset) {
          return { result, lastReason: null }
        }
        lastReason = result.reason ?? lastReason
      } catch {
        lastReason = 'Generation provider failed.'
      }
    }
    return { result: null, lastReason }
  }

  async function generateWithProviders(list, request, budget) {
    log?.('asset_generation_request', { requestId, kind: request.kind })
    const generated = await tryProviders(list, request)
    if (generated.result) {
      budget?.consume()
      cache.set(request, generated.result.asset)
      return { asset: generated.result.asset, generationRequest: null, source: 'generated' }
    }
    log?.('asset_generation_failed', {
      requestId,
      kind: request.kind,
      reason: generated.lastReason,
    })
    return { generationReason: generated.lastReason }
  }

  async function resolve(request) {
    const cached = cache.get(request)
    if (cached) {
      log?.('cache_hit', { requestId, kind: request.kind })
      return { asset: cached, generationRequest: null, source: 'cache' }
    }

    log?.('cache_miss', { requestId, kind: request.kind })

    const cheap = await tryProviders(cheapProviders, request)
    if (cheap.result) {
      cache.set(request, cheap.result.asset)
      return { asset: cheap.result.asset, generationRequest: null, source: cheap.result.asset.source }
    }

    const budget = options.generationBudget
    const generationLimiter = options.generationLimiter
    const subjectKey = options.subjectKey
    let generationReason = cheap.lastReason

    const configured = generationProviders.filter((provider) => provider.configured !== false)
    const applicable = configured.filter((provider) => providerCanHandle(provider, request))
    const panoramaAllowed = request.kind !== 'panorama' || claimPanoramaSlot()

    if (applicable.length > 0 && panoramaAllowed) {
      if (budget && !budget.canGenerate()) {
        log?.('asset_generation_rejected', { requestId, reason: 'budget', kind: request.kind })
        generationReason = 'Generation budget exhausted.'
      } else if (generationLimiter && subjectKey && options.generationPolicies?.length) {
        const rate = await generationLimiter.consume(subjectKey, options.generationPolicies)
        if (!rate.allowed) {
          log?.('asset_generation_rejected', {
            requestId,
            kind: request.kind,
            reason: 'rate_limit',
            retryAfter: rate.retryAfter,
          })
          generationReason = 'Asset generation rate limited.'
        } else {
          const generated = await generateWithProviders(applicable, request, budget)
          if (generated.asset) {
            return generated
          }
          generationReason = generated.generationReason
        }
      } else {
        const generated = await generateWithProviders(applicable, request, budget)
        if (generated.asset) {
          return generated
        }
        generationReason = generated.generationReason
      }
    } else if (applicable.length > 0 && request.kind === 'panorama') {
      generationReason = 'Extra panoramas use placeholders until IMAGE_GENERATION_COUNT is raised.'
      log?.('asset_generation_skipped', { requestId, kind: request.kind, limit: maxGeneratedImages })
    } else if (generationProviders.length > 0 && configured.length === 0) {
      const stub = await tryProviders(generationProviders, request)
      generationReason = stub.lastReason
      log?.('asset_generation_rejected', { requestId, reason: 'not_configured', kind: request.kind })
    }

    const asset = fallbackAsset(request, generationReason)
    cache.set(request, asset)
    return {
      asset,
      generationRequest: {
        request,
        reason: generationReason,
        skipped: Boolean(applicable.length > 0 && request.kind === 'panorama' && !panoramaAllowed),
      },
      source: 'fallback',
    }
  }

  async function resolveWorld(specification, { onRoom, onStatus } = {}) {
    const generationRequests = []
    const total = specification.rooms.length
    const rooms = new Array(total)

    async function resolveRoomAt(index, room) {
      await onStatus?.({
        index,
        total,
        message:
          index === 0
            ? 'Painting the first 360° view...'
            : index === total - 1
              ? 'Finishing the last room in the background...'
              : 'Painting more rooms in the background...',
      })

      const panoRequest = {
        kind: 'panorama',
        type: 'panorama',
        theme: specification.theme,
        description: room.environment.description,
        tags: room.environment.tags,
      }
      const panorama = await resolve(panoRequest)
      if (panorama.generationRequest) {
        generationRequests.push(panorama.generationRequest)
      }

      const objects = []
      for (const object of room.objects) {
        const objectRequest = {
          kind: 'model',
          type: object.type,
          theme: specification.theme,
          description: object.description,
          tags: object.tags,
        }
        const resolved = await resolve(objectRequest)
        if (resolved.generationRequest) {
          generationRequests.push(resolved.generationRequest)
        }
        objects.push({ need: object, asset: resolved.asset })
      }

      return {
        spec: room,
        panorama: panorama.asset,
        objects,
      }
    }

    // Unlock the player on room 1 as soon as its panorama is ready.
    rooms[0] = await resolveRoomAt(0, specification.rooms[0])
    await onRoom?.({ room: rooms[0], index: 0, total })

    // Rooms 2–N paint in parallel while the user explores room 1.
    if (total > 1) {
      await Promise.all(
        specification.rooms.slice(1).map(async (room, offset) => {
          const index = offset + 1
          rooms[index] = await resolveRoomAt(index, room)
          await onRoom?.({ room: rooms[index], index, total })
        })
      )
    }

    return { rooms, generationRequests, generation: budgetSnapshot() }
  }

  function budgetSnapshot() {
    return options.generationBudget?.snapshot?.() ?? null
  }

  return { resolve, resolveWorld }
}

export const assetResolver = createAssetResolver()
