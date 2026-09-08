import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGenerationBudget } from './generation-budget.js'
import { createAssetCache } from '../src/assets/AssetCache.js'
import { createAssetResolver } from '../src/assets/AssetResolver.js'
import { createAsset } from '../src/assets/AssetProvider.js'

function uniqueNeed(label) {
  return {
    kind: 'model',
    type: 'relic',
    theme: 'test',
    description: `zzzzunique ${label} relic artifact`,
    tags: ['zzzzunique', label],
  }
}

function createFakeGenerator() {
  let calls = 0
  return {
    id: 'generated',
    expensive: true,
    configured: true,
    get calls() {
      return calls
    },
    async resolve(request) {
      calls += 1
      return {
        status: 'resolved',
        asset: createAsset({
          id: `gen-${calls}`,
          kind: request.kind,
          source: 'generated',
          primitive: 'box',
          description: request.description,
        }),
      }
    },
  }
}

function createThrowingGenerator() {
  return {
    id: 'generated',
    expensive: true,
    configured: true,
    async resolve() {
      throw new Error('provider exploded')
    },
  }
}

describe('GenerationBudget', () => {
  it('allows generation while budget remains and stops when exhausted', async () => {
    const budget = createGenerationBudget({ requestId: 'r1', userKey: 'ip:1', maxGeneratedAssets: 2 })
    const generator = createFakeGenerator()
    const cache = createAssetCache()
    const resolver = createAssetResolver({
      cache,
      providers: [generator],
      generationBudget: budget,
    })

    const first = await resolver.resolve(uniqueNeed('one'))
    const second = await resolver.resolve(uniqueNeed('two'))
    const third = await resolver.resolve(uniqueNeed('three'))

    assert.equal(first.asset.source, 'generated')
    assert.equal(second.asset.source, 'generated')
    assert.equal(third.asset.source, 'fallback')
    assert.equal(generator.calls, 2)
    assert.equal(budget.generatedAssets, 2)
    assert.equal(budget.remaining, 0)
    assert.match(third.generationRequest.reason, /budget exhausted/i)
  })

  it('does not consume budget for cached assets', async () => {
    const budget = createGenerationBudget({ maxGeneratedAssets: 3 })
    const generator = createFakeGenerator()
    const cache = createAssetCache()
    const resolver = createAssetResolver({
      cache,
      providers: [generator],
      generationBudget: budget,
    })

    const need = uniqueNeed('cached')
    await resolver.resolve(need)
    await resolver.resolve(need)
    await resolver.resolve(need)

    assert.equal(generator.calls, 1)
    assert.equal(budget.generatedAssets, 1)
    assert.equal(budget.remaining, 2)
  })

  it('does not crash the world when a generation provider fails', async () => {
    const budget = createGenerationBudget({ maxGeneratedAssets: 5 })
    const resolver = createAssetResolver({
      cache: createAssetCache(),
      providers: [createThrowingGenerator()],
      generationBudget: budget,
    })

    const result = await resolver.resolve(uniqueNeed('boom'))
    assert.equal(result.asset.source, 'fallback')
    assert.match(result.generationRequest.reason, /failed/i)
    assert.equal(budget.generatedAssets, 0)
  })

  it('does not rate-limit kinds the generator cannot handle', async () => {
    const budget = createGenerationBudget({ maxGeneratedAssets: 5 })
    let limiterCalls = 0
    const generator = {
      id: 'pano-only',
      expensive: true,
      configured: true,
      canHandle(request) {
        return request.kind === 'panorama'
      },
      async resolve() {
        throw new Error('should not generate models')
      },
    }
    const resolver = createAssetResolver({
      cache: createAssetCache(),
      providers: [generator],
      generationBudget: budget,
      generationLimiter: {
        async consume() {
          limiterCalls += 1
          return { allowed: true }
        },
      },
      generationPolicies: [{ name: 'generation_per_minute', limit: 5, windowMs: 60_000 }],
      subjectKey: 'ip:test',
    })

    const result = await resolver.resolve(uniqueNeed('statue'))
    assert.equal(result.asset.source, 'fallback')
    assert.equal(limiterCalls, 0)
    assert.equal(budget.generatedAssets, 0)
  })

  it('generates only one panorama when maxGeneratedImages is 1', async () => {
    let calls = 0
    const generator = {
      id: 'pano',
      expensive: true,
      configured: true,
      canHandle(request) {
        return request.kind === 'panorama'
      },
      async resolve(request) {
        calls += 1
        return {
          status: 'resolved',
          asset: createAsset({
            id: `gen-${calls}`,
            kind: 'panorama',
            source: 'generated',
            url: `/generated/panoramas/${calls}.png`,
            description: request.description,
          }),
        }
      },
    }
    const resolver = createAssetResolver({
      cache: createAssetCache(),
      providers: [generator],
      maxGeneratedImages: 1,
    })
    const first = await resolver.resolve({
      kind: 'panorama',
      type: 'panorama',
      theme: 'space',
      description: 'unique first sky aaa',
      tags: ['a'],
    })
    const second = await resolver.resolve({
      kind: 'panorama',
      type: 'panorama',
      theme: 'space',
      description: 'unique second sky bbb',
      tags: ['b'],
    })
    assert.equal(first.asset.source, 'generated')
    assert.equal(second.asset.source, 'fallback')
    assert.equal(calls, 1)
  })
})
