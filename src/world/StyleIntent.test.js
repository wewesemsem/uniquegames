import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXOTIC_FORMS,
  RAINBOW_PALETTE,
  applyStyleToNeed,
  formsFromMotif,
  inferStyleIntent,
  paletteFromIntent,
} from './StyleIntent.js'
import { composeRoom } from './SceneComposer.js'
import { buildWorld } from './WorldBuilder.js'
import { heuristicWorldFromPrompt } from './heuristicDirector.js'
import { stoneColor } from '../procedural/objects/stoneColor.js'

describe('StyleIntent', () => {
  it('infers rainbow palette from colorful adjectives without theme hardcoding', () => {
    const intent = inferStyleIntent('rainbow egypt with colorful pyramids')
    assert.equal(intent.paletteMode, 'rainbow')
    assert.ok(intent.vivid)
    const palette = paletteFromIntent(intent)
    assert.deepEqual(palette, [...RAINBOW_PALETTE])
  })

  it('samples varied exotic forms unless motif forces mushrooms', () => {
    const varied = formsFromMotif('strange alien flora', 42, 12)
    const unique = new Set(varied)
    assert.ok(unique.size >= 3, `expected multiple forms, got ${[...unique]}`)
    assert.ok(varied.every((form) => EXOTIC_FORMS.includes(form)))

    const mushrooms = formsFromMotif('giant glowing mushrooms', 42, 8)
    assert.ok(mushrooms.every((form) => form === 'mushroom'))
  })

  it('applies palette params to specialized pyramid needs', () => {
    const intent = inferStyleIntent('rainbow desert pyramids')
    const styled = applyStyleToNeed(
      { type: 'pyramid', description: 'Great pyramid', tags: ['pyramid'] },
      intent,
      1,
      0
    )
    assert.ok(styled.params?.styled)
    assert.ok(Array.isArray(styled.params.colors))
    assert.equal(styled.params.colors[0], RAINBOW_PALETTE[0])
    assert.equal(styled.appearance.color, 'vivid')
  })
})

describe('Rainbow egypt objects', () => {
  it('styles heuristic egypt pyramids from a rainbow prompt', () => {
    const spec = heuristicWorldFromPrompt('rainbow egypt pyramids')
    assert.equal(spec.theme, 'ancient_egypt')
    assert.match(spec.prompt, /rainbow/i)
    const built = buildWorld(spec, { rooms: [] })
    const pyramids = built.environments.room1.objects.filter((o) => o.type === 'pyramid')
    assert.ok(pyramids.length >= 1)
    for (const pyramid of pyramids) {
      assert.ok(pyramid.params?.styled, 'pyramid should carry styled params')
      assert.ok(pyramid.params.colors?.length >= 3)
      assert.ok(
        pyramid.params.colors.some((c) => RAINBOW_PALETTE.includes(c)),
        'pyramid palette should include rainbow colors'
      )
    }
  })

  it('lets stoneColor use prompt palettes instead of sandstone', () => {
    const sand = stoneColor(1, 'limestone')
    const rainbow = stoneColor(1, 'limestone', {
      params: { colors: [...RAINBOW_PALETTE], styled: true },
      salt: 1,
    })
    assert.notEqual(rainbow, sand)
    assert.ok(RAINBOW_PALETTE.includes(rainbow))
  })
})

describe('Alien variety', () => {
  it('does not force mushrooms for alien space without fungi keywords', () => {
    const spec = heuristicWorldFromPrompt('alien space')
    assert.equal(spec.theme, 'alien_planet')
    const room = spec.rooms[0]
    assert.notEqual(room.composition?.vegetation, 'fungal')
    assert.equal(/mushroom/i.test(room.composition?.motif || ''), false)

    const composed = composeRoom(room, spec.theme, {
      seed: 99,
      prompt: 'alien space',
    })
    const generics = composed.objects.filter((o) => o.type === 'generic')
    assert.ok(generics.length >= 1)
    const forms = new Set(generics.map((o) => o.form))
    assert.ok(![...forms].every((f) => f === 'mushroom'), `expected non-mushroom variety, got ${[...forms]}`)
  })

  it('still uses mushrooms when the prompt asks for them', () => {
    const spec = heuristicWorldFromPrompt('alien planet with giant glowing mushrooms')
    assert.match(spec.rooms[0].composition?.motif || '', /mushroom/i)
    const built = buildWorld(spec, { rooms: [] })
    assert.ok(
      built.environments.room1.objects.some(
        (o) => o.type === 'generic' && (o.form === 'mushroom' || o.params?.descriptor?.form === 'mushroom')
      )
    )
  })

  it('varies alien fill across seeds', () => {
    const room = {
      id: 'room1',
      name: 'Alien Arrival',
      environment: { description: 'strange alien clearing', tags: ['alien'] },
      composition: {
        biome: 'alien',
        life: 'moderate',
        vegetation: 'alien',
        large_features: 'crystals',
        atmosphere: 'bioluminescent',
        density: 0.85,
        motif: 'strange alien flora',
      },
      objects: [],
    }
    const a = composeRoom(room, 'alien_planet', { seed: 11, prompt: 'alien space' })
    const b = composeRoom(room, 'alien_planet', { seed: 99, prompt: 'alien space' })
    const formsA = a.objects.filter((o) => o.type === 'generic').map((o) => o.form).join(',')
    const formsB = b.objects.filter((o) => o.type === 'generic').map((o) => o.form).join(',')
    const posA = JSON.stringify(a.objects.map((o) => o.position))
    const posB = JSON.stringify(b.objects.map((o) => o.position))
    assert.ok(formsA !== formsB || posA !== posB, 'different seeds should change forms or placement')
  })
})
