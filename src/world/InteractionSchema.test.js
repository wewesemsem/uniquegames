import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferInteractions,
  matchObjectInteractions,
  sanitizeInteractions,
  sanitizeInteractionEvent,
} from './InteractionSchema.js'
import { resolveReactionSpawns, resolveSubjectNeed, reactionNeedsSpawn } from '../interaction/ReactionResolver.js'
import { createSceneEventStore } from '../interaction/SceneEventStore.js'
import { reactionMotion } from '../procedural/animation/reactionMotion.js'
import { composeRoom } from './SceneComposer.js'
import { buildWorld } from './WorldBuilder.js'
import { heuristicWorldFromPrompt } from './heuristicDirector.js'

describe('InteractionSchema', () => {
  it('infers egypt pyramid mummy interaction', () => {
    const interactions = inferInteractions({
      biome: 'desert_plateau',
      large_features: 'pyramids',
      vegetation: 'desert_scrub',
      life: 'sparse',
    })
    assert.ok(interactions.events.length >= 2)
    const mummy = interactions.events.find((e) => e.reaction?.subject === 'mummy')
    assert.ok(mummy)
    assert.equal(mummy.target, 'pyramid')
    assert.equal(mummy.trigger, 'click')
    assert.equal(mummy.once, true)
    assert.equal(mummy.reaction.animation, 'chase_player')
  })

  it('infers underwater coral → whale', () => {
    const interactions = inferInteractions({
      biome: 'coral_reef',
      vegetation: 'coral_reef',
      large_features: 'reef',
      life: 'abundant',
    })
    const whale = interactions.events.find((e) => e.reaction?.subject === 'whale')
    assert.ok(whale)
    assert.equal(whale.target, 'coral')
    assert.equal(whale.reaction.animation, 'swim_into_scene')
  })

  it('infers meadow flower butterflies', () => {
    const interactions = inferInteractions({
      biome: 'meadow',
      vegetation: 'meadow',
      life: 'moderate',
    })
    const butterflies = interactions.events.find((e) => e.reaction?.subject === 'butterfly')
    assert.ok(butterflies)
  })

  it('sanitizes LLM interaction payloads without code', () => {
    const event = sanitizeInteractionEvent({
      target: 'Pyramid Entrance',
      trigger: 'CLICK',
      reaction: {
        type: 'creature_appearance',
        subject: 'Mummy!',
        animation: 'emerge_from_door',
        duration: 99,
        once: true,
      },
    })
    assert.equal(event.target, 'pyramid_entrance')
    assert.equal(event.trigger, 'click')
    assert.equal(event.reaction.subject, 'mummy')
    assert.equal(event.reaction.duration, 30)
  })

  it('matches pyramid_entrance alias to pyramid objects', () => {
    const interactions = sanitizeInteractions({
      events: [
        {
          target: 'pyramid_entrance',
          trigger: 'click',
          reaction: { type: 'creature_appearance', subject: 'mummy', animation: 'emerge_from_door' },
        },
      ],
    })
    const matched = matchObjectInteractions({ type: 'pyramid', id: 'room1-pyramid', tags: ['pyramid'] }, interactions)
    assert.equal(matched.length, 1)
  })
})

describe('ReactionResolver', () => {
  it('resolves mummy as a readable statue mesh outside large landmarks', () => {
    const need = resolveSubjectNeed('mummy')
    assert.equal(need.category, 'creature')
    assert.equal(need.type, 'statue')
    const spawns = resolveReactionSpawns(
      {
        id: 'test',
        reaction: {
          type: 'creature_appearance',
          subject: 'mummy',
          animation: 'chase_player',
          duration: 4,
          count: 1,
          offset: [0, 0, 2],
          scale: 2.6,
        },
      },
      { id: 'pyr', type: 'pyramid', position: [0, 0, -14], scale: [5.5, 5.5, 5.5] },
      1000
    )
    assert.equal(spawns.length, 1)
    assert.equal(spawns[0].type, 'statue')
    assert.ok(spawns[0].temporary)
    const dz = Math.abs(spawns[0].position[2] - -14)
    const dx = Math.abs(spawns[0].position[0] - 0)
    assert.ok(Math.hypot(dx, dz) > 5, 'spawn should clear the pyramid volume')
  })

  it('resolves whale to fish generator', () => {
    const need = resolveSubjectNeed('whale')
    assert.equal(need.type, 'fish')
    assert.equal(reactionNeedsSpawn({ type: 'animal_appearance', subject: 'whale' }), true)
  })

  it('does not spawn for glow-only reactions', () => {
    assert.equal(reactionNeedsSpawn({ type: 'glow', animation: 'glow_up' }), false)
  })
})

describe('SceneEventStore', () => {
  it('respects once:true and prevents duplicate spawns', () => {
    const store = createSceneEventStore()
    const interactions = inferInteractions({
      biome: 'desert_plateau',
      large_features: 'pyramids',
    })
    const objects = [
      {
        id: 'room1-pyramid',
        type: 'pyramid',
        position: [0, 0, -14],
        interactions: interactions.events.filter((e) => e.target === 'pyramid'),
      },
    ]
    store.resetRoom('room1', interactions, objects)
    const now = 1_000_000
    const first = store.triggerByObject('room1-pyramid', 'click', { sourceObject: objects[0], now })
    assert.equal(first, true)
    const snap1 = store.getSnapshot()
    assert.ok(snap1.spawns.length >= 1)
    const second = store.triggerByObject('room1-pyramid', 'click', {
      sourceObject: objects[0],
      now: now + 100,
    })
    assert.equal(second, false)
    assert.equal(store.getEventState('pyramid_entrance_mummy'), 'active')
    store.tick(now + 13000)
    assert.equal(store.getEventState('pyramid_entrance_mummy'), 'completed')
  })
})

describe('reactionMotion', () => {
  it('eases emerge and swim animations', () => {
    const emerge = reactionMotion('emerge_from_door', 0.5, 1)
    assert.ok(emerge.scale[1] > 0.4)
    const swim = reactionMotion('swim_into_scene', 0.2, 2)
    assert.ok(Math.abs(swim.position[0]) > 1)
    const swimStart = reactionMotion('swim_into_scene', 0, 1)
    assert.ok(Math.abs(swimStart.position[0]) > 5)
  })

  it('marks chase animations for player follow', () => {
    const chase = reactionMotion('chase_player', 0.4, 3)
    assert.ok(chase.chase > 2)
    const approach = reactionMotion('approach_player', 0.4, 3)
    assert.ok(approach.chase > 0)
    assert.ok(approach.chase < chase.chase)
  })
})

describe('composeRoom + buildWorld interactions', () => {
  it('attaches interactive events to egypt worlds', () => {
    const spec = heuristicWorldFromPrompt('ancient egypt pyramids desert')
    const composed = composeRoom(spec.rooms[0], spec.theme)
    assert.ok(composed.interactions.events.length > 0)
    const world = buildWorld(spec, { rooms: [] })
    const room = world.environments[spec.rooms[0].id]
    assert.ok(room.interactions.events.length > 0)
    const interactive = room.objects.filter((o) => o.interactive)
    assert.ok(interactive.length >= 1, 'expected at least one interactive object')
  })

  it('attaches coral interactions for underwater worlds', () => {
    const spec = heuristicWorldFromPrompt('underwater coral reef ocean')
    const world = buildWorld(spec, { rooms: [] })
    const room = Object.values(world.environments)[0]
    assert.ok(room.interactions.events.some((e) => e.reaction?.subject === 'whale' || e.target === 'coral'))
  })
})
