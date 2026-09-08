import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferGenericDescriptor,
  shouldUseGeneric,
  createGenericNeed,
} from '../procedural/objects/GenericDescriptor.js'
import { resolveProceduralObject } from '../procedural/objects/ObjectResolver.js'
import { buildWorld } from './WorldBuilder.js'
import { heuristicWorldFromPrompt } from './heuristicDirector.js'
import { composeRoom } from './SceneComposer.js'

describe('Generic procedural objects', () => {
  it('infers glowing mushroom descriptors without a specialized type', () => {
    const d = inferGenericDescriptor({
      type: 'mushroom',
      description: 'giant glowing bioluminescent mushroom',
      tags: ['alien', 'fungi'],
    })
    assert.equal(d.form, 'mushroom')
    assert.equal(d.category, 'organic_plant')
    assert.equal(d.appearance.scale_hint, 'giant')
    assert.equal(d.appearance.color, 'bioluminescent')
    assert.ok(d.appearance.emission > 0.5)
  })

  it('infers floating crystalline structures', () => {
    const d = inferGenericDescriptor({
      type: 'crystal_spire',
      description: 'floating translucent crystal city tower',
      category: 'floating_structure',
      behavior: { floating: true },
    })
    assert.equal(d.form, 'crystalline')
    assert.equal(d.behavior.floating, true)
    assert.ok(d.appearance.transparency > 0)
  })

  it('routes unknown types to generic and known types to specialized', () => {
    assert.equal(shouldUseGeneric({ type: 'mushroom' }), true)
    assert.equal(shouldUseGeneric({ type: 'pyramid' }), false)
    const mushroom = resolveProceduralObject({
      type: 'mushroom',
      description: 'glowing mushroom',
    })
    assert.equal(mushroom.type, 'generic')
    assert.ok(mushroom.descriptor)
    const pyramid = resolveProceduralObject({ type: 'pyramid', description: 'great pyramid' })
    assert.equal(pyramid.type, 'pyramid')
    assert.equal(pyramid.specialized, true)
  })

  it('createGenericNeed produces schema-safe objects', () => {
    const need = createGenericNeed({
      name: 'Alien cap',
      description: 'giant glowing mushroom',
      form: 'mushroom',
      category: 'organic_plant',
      appearance: { scale_hint: 'giant', color: 'bioluminescent', surface: 'glowing', emission: 0.9 },
    })
    assert.equal(need.type, 'generic')
    assert.equal(need.form, 'mushroom')
  })
})

describe('Alien composer hybrid', () => {
  it('composes glowing mushroom forests from alien composition', () => {
    const result = composeRoom(
      {
        id: 'room1',
        name: 'Grove',
        environment: { description: 'alien fungi', tags: ['alien'] },
        composition: {
          biome: 'alien',
          life: 'moderate',
          vegetation: 'fungal',
          large_features: 'fungal_grove',
          atmosphere: 'bioluminescent',
          density: 0.9,
          motif: 'giant glowing mushrooms',
        },
      },
      'alien_planet'
    )
    assert.ok(result.objects.some((o) => o.type === 'generic' && o.form === 'mushroom'))
    assert.ok(result.objects.some((o) => o.appearance?.emission > 0.5))
  })

  it('builds alien heuristic worlds with generic mushrooms', () => {
    const spec = heuristicWorldFromPrompt('alien planet with giant glowing mushrooms')
    assert.equal(spec.theme, 'alien_planet')
    const built = buildWorld(spec, { rooms: [] })
    const room = built.environments.room1
    assert.ok(room.objects.some((o) => o.type === 'generic'))
    assert.ok(room.objects.some((o) => o.params?.descriptor?.form === 'mushroom'))
  })
})
