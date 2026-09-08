import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inferComposition, resolveRoomComposition, sanitizeComposition } from './CompositionSchema.js'
import { composeRoom, mergeComposedObjects, compositionSceneOverlay } from './SceneComposer.js'
import { buildWorld } from './WorldBuilder.js'
import { heuristicWorldFromPrompt } from './heuristicDirector.js'

describe('CompositionSchema', () => {
  it('infers underwater coral reef composition', () => {
    const c = inferComposition({
      theme: 'underwater',
      description: 'sunlit coral reef',
      tags: ['reef', 'fish'],
      roomId: 'room2',
      roomName: 'Coral Reef',
    })
    assert.equal(c.biome, 'coral_reef')
    assert.equal(c.life, 'abundant')
    assert.equal(c.vegetation, 'coral_reef')
    assert.equal(c.atmosphere, 'underwater_caustics')
  })

  it('infers meadow from flower prompts', () => {
    const c = inferComposition({ theme: 'meadow', description: 'field of wildflowers' })
    assert.equal(c.biome, 'meadow')
    assert.equal(c.vegetation, 'meadow')
    assert.equal(c.atmosphere, 'pollen')
  })

  it('sanitizes unknown enum values', () => {
    const c = sanitizeComposition({ biome: 'not-real', life: 'lots', density: 2 })
    assert.equal(c.biome, 'generic')
    assert.ok(c.density <= 1)
  })
})

describe('SceneComposer', () => {
  it('expands underwater composition into fish, coral, and seaweed', () => {
    const room = {
      id: 'room2',
      name: 'Coral Reef',
      environment: { type: 'panorama', description: 'reef', tags: ['underwater'] },
      composition: {
        biome: 'coral_reef',
        life: 'abundant',
        vegetation: 'coral_reef',
        large_features: 'reef',
        atmosphere: 'underwater_caustics',
        density: 0.9,
      },
      objects: [],
    }
    const result = composeRoom(room, 'underwater')
    const types = new Set(result.objects.map((o) => o.type))
    assert.ok(types.has('fish'), 'expected fish schools')
    assert.ok(types.has('coral'), 'expected coral')
    assert.ok(types.has('rock') || types.has('seaweed') || types.has('jellyfish'), 'expected reef props')
    assert.ok(result.objects.some((o) => o.params?.count > 1), 'fish school should carry count params')
    assert.equal(result.scene.environment, 'ocean')
    assert.ok(result.scene.effects?.includes('caustics'))
  })

  it('expands meadow composition into flower patches', () => {
    const result = composeRoom(
      {
        id: 'room1',
        name: 'Field',
        environment: { description: 'flowers', tags: ['meadow'] },
        composition: {
          biome: 'meadow',
          life: 'moderate',
          vegetation: 'meadow',
          large_features: 'rocks',
          atmosphere: 'pollen',
          density: 0.85,
        },
      },
      'meadow'
    )
    assert.ok(result.objects.some((o) => o.type === 'flower'))
    assert.equal(compositionSceneOverlay(result.composition).particles, 'pollen')
  })

  it('keeps LLM landmarks when merging', () => {
    const merged = mergeComposedObjects(
      [{ type: 'habitat', description: 'LLM habitat', tags: ['landmark'] }],
      [
        { type: 'habitat', description: 'Composer habitat', tags: ['habitat', 'landmark'] },
        { type: 'fish', description: 'School', tags: ['fish'], params: { count: 12 } },
      ]
    )
    assert.equal(merged.filter((o) => o.type === 'habitat').length, 1)
    assert.ok(merged.some((o) => o.type === 'fish'))
  })
})

describe('buildWorld + composer', () => {
  it('builds a dense underwater world from heuristic composition', () => {
    const spec = heuristicWorldFromPrompt('put me under the sea')
    assert.equal(spec.theme, 'underwater')
    assert.ok(spec.rooms[1].composition)

    const built = buildWorld(spec, { rooms: [] })
    const reef = built.environments.room2
    assert.ok(reef.objects.length > 8, `expected dense reef, got ${reef.objects.length}`)
    assert.ok(reef.objects.some((o) => o.type === 'fish'))
    assert.ok(reef.procedural?.environment === 'ocean' || reef.procedural?.sky === 'underwater')
  })

  it('resolves composition from theme when omitted', () => {
    const room = {
      id: 'room1',
      name: 'Reef',
      environment: { type: 'panorama', description: 'underwater coral', tags: ['ocean'] },
      objects: [],
    }
    const c = resolveRoomComposition(room, 'underwater')
    assert.ok(/ocean|coral|reef/.test(c.biome))
  })
})
