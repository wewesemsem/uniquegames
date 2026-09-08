import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inferAnimation, matchObjectAnimation, sanitizeAnimation } from './AnimationSchema.js'
import { behaviorMotion } from '../procedural/animation/behaviors.js'
import { composeRoom } from './SceneComposer.js'
import { buildWorld } from './WorldBuilder.js'
import { heuristicWorldFromPrompt } from './heuristicDirector.js'

describe('AnimationSchema', () => {
  it('requires underwater life animation by default', () => {
    const anim = inferAnimation({
      biome: 'coral_reef',
      life: 'abundant',
      vegetation: 'coral_reef',
      large_features: 'reef',
      atmosphere: 'underwater_caustics',
    })
    assert.equal(anim.required, true)
    assert.equal(anim.static_scene, false)
    const targets = anim.behaviors.map((b) => b.target)
    assert.ok(targets.includes('fish'))
    assert.ok(targets.includes('seaweed'))
    assert.ok(targets.includes('bubbles'))
    assert.ok(anim.behaviors.some((b) => b.target === 'fish' && b.group_behavior === 'schooling'))
  })

  it('keeps egypt architecture still while environment moves', () => {
    const anim = inferAnimation({
      biome: 'desert_plateau',
      life: 'sparse',
      vegetation: 'desert_scrub',
      large_features: 'pyramids',
      atmosphere: 'dusty',
    })
    const targets = anim.behaviors.map((b) => b.target)
    assert.ok(targets.includes('sand') || targets.includes('dust') || targets.includes('particles'))
    assert.ok(targets.includes('palm_tree') || targets.includes('torch') || targets.includes('bird'))
    assert.ok(!targets.includes('pyramid'))
  })

  it('allows explicit static scenes', () => {
    const anim = sanitizeAnimation({ static_scene: true, behaviors: [{ target: 'fish', behavior: 'swim' }] })
    assert.equal(anim.static_scene, true)
    assert.equal(anim.behaviors.length, 0)
  })

  it('matches object animation by type', () => {
    const anim = inferAnimation({ biome: 'coral_reef', life: 'abundant', vegetation: 'coral_reef' })
    const matched = matchObjectAnimation({ type: 'fish', tags: ['fish'] }, anim)
    assert.ok(matched)
    assert.equal(matched.behavior, 'swim')
  })
})

describe('behaviorMotion', () => {
  it('produces finite swim offsets', () => {
    const m = behaviorMotion(
      { behavior: 'swim', speed: 'medium', variation: 'high', group_behavior: 'schooling' },
      1.5,
      3
    )
    assert.ok(m.position.every((n) => Number.isFinite(n)))
    assert.ok(m.rotation.every((n) => Number.isFinite(n)))
  })
})

describe('composeRoom animation', () => {
  it('attaches mandatory animation to underwater rooms', () => {
    const result = composeRoom(
      {
        id: 'room2',
        name: 'Reef',
        environment: { description: 'coral reef', tags: ['underwater'] },
        composition: {
          biome: 'coral_reef',
          life: 'abundant',
          vegetation: 'coral_reef',
          large_features: 'reef',
          atmosphere: 'underwater_caustics',
          density: 0.9,
        },
      },
      'underwater'
    )
    assert.ok(result.animation?.behaviors?.length >= 3)
  })

  it('builds worlds with per-object animation bindings', () => {
    const spec = heuristicWorldFromPrompt('put me under the sea')
    const built = buildWorld(spec, { rooms: [] })
    assert.ok(built.environments.room2.animation?.behaviors?.length)
    const fish = built.environments.room2.objects.find((o) => o.type === 'fish')
    assert.ok(fish)
    assert.ok(fish.animation)
    assert.equal(fish.animation.behavior, 'swim')
  })
})
