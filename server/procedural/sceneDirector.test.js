import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SCENE_CONFIGURATION,
  parseSceneConfiguration,
  sceneFromDescription,
} from '../../src/world/SceneConfiguration.js'
import { directProceduralScenes, heuristicScenesForSpecification } from './sceneDirector.js'
import { spaceSpec } from '../http-mocks.js'

describe('SceneConfiguration', () => {
  it('parses a valid rich scene and fills defaults', () => {
    const scene = parseSceneConfiguration({
      environment: 'space',
      timeOfDay: 'night',
      sky: 'nebula',
      ground: 'none',
      terrain: 'none',
      fog: 0.1,
      treeDensity: 0,
      lighting: 0.55,
      lightingStyle: 'dramatic',
      wind: 0.05,
      particles: 'stars',
      colorMood: 'cool',
      starDensity: 0.9,
      planetCount: 4,
      nebula: 0.85,
      structures: ['spaceship'],
      earthVisible: false,
      animationSpeed: 0.4,
      effects: ['aurora'],
    })
    assert.equal(scene.environment, 'space')
    assert.equal(scene.planetCount, 4)
    assert.equal(scene.structures[0], 'spaceship')
    assert.equal(scene.nebula, 0.85)
  })

  it('rejects invented keys and out-of-range values', () => {
    assert.throws(() => parseSceneConfiguration({ ...DEFAULT_SCENE_CONFIGURATION, fog: 2 }))
    assert.throws(() => parseSceneConfiguration({ ...DEFAULT_SCENE_CONFIGURATION, evil: true }))
    assert.throws(() =>
      parseSceneConfiguration({
        ...DEFAULT_SCENE_CONFIGURATION,
        structures: ['laser_cannon'],
      })
    )
  })

  it('builds distinct heuristic space rooms', () => {
    const orbital = sceneFromDescription('Orbital space station', 'space', {
      id: 'room1',
      name: 'Orbital Station',
    })
    const moon = sceneFromDescription('lunar landscape with Earth', 'space', {
      id: 'room2',
      name: 'Moon Surface',
    })
    const deep = sceneFromDescription('Deep space nebula', 'space', {
      id: 'room3',
      name: 'Deep Space',
    })
    assert.equal(orbital.environment, 'space')
    assert.ok(orbital.structures.includes('space_station'))
    assert.equal(moon.terrain, 'lunar')
    assert.equal(moon.earthVisible, true)
    assert.ok(deep.nebula >= 0.8)
    assert.ok(deep.structures.includes('spaceship'))
  })

  it('builds underwater and egypt variants', () => {
    const reef = sceneFromDescription('sunlit coral reef', 'underwater', { id: 'room2', name: 'Coral Reef' })
    const temple = sceneFromDescription('Ancient Egyptian temple', 'ancient_egypt', {
      id: 'room1',
      name: 'Temple',
    })
    assert.equal(reef.environment, 'ocean')
    assert.equal(reef.particles, 'bubbles')
    assert.equal(temple.environment, 'egypt')
    assert.ok(temple.structures.includes('temple') || temple.structures.includes('columns'))
  })
})

describe('procedural scene director', () => {
  it('returns heuristic scenes without an API key', async () => {
    const result = await directProceduralScenes({
      specification: spaceSpec(),
      prompt: 'I want to explore space.',
      apiKey: '',
      log: () => {},
      requestId: 'test',
    })
    assert.equal(result.source, 'heuristic')
    assert.ok(result.scenes.room1)
    assert.equal(result.scenes.room1.environment, 'space')
  })

  it('falls back to heuristic scenes when the LLM fails', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('upstream down')
    }
    try {
      const result = await directProceduralScenes({
        specification: spaceSpec(),
        prompt: 'I want to explore space.',
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        log: () => {},
        requestId: 'test',
      })
      assert.equal(result.source, 'heuristic')
      assert.equal(Object.keys(result.scenes).length, 3)
    } finally {
      globalThis.fetch = original
    }
  })

  it('heuristicScenesForSpecification covers every room id with distinct looks', () => {
    const scenes = heuristicScenesForSpecification(spaceSpec())
    assert.deepEqual(Object.keys(scenes).sort(), ['room1', 'room2', 'room3'])
    assert.notDeepEqual(scenes.room1.structures, scenes.room2.structures)
  })
})
