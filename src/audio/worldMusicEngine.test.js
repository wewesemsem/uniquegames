import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { heuristicMusicSpecification, sanitizeMusicSpecification } from './MusicSpecification.js'
import { MUSIC_MOODS, generateScore, normalizeMood } from './worldMusicEngine.js'

describe('normalizeMood', () => {
  it('accepts known moods', () => {
    for (const mood of MUSIC_MOODS) {
      assert.equal(normalizeMood(mood), mood)
      assert.equal(normalizeMood(mood.toUpperCase()), mood)
    }
  })

  it('maps free-text synonyms', () => {
    assert.equal(normalizeMood('scary dungeon'), 'horror')
    assert.equal(normalizeMood('chill vibes'), 'mellow')
    assert.equal(normalizeMood('upbeat adventure'), 'fun')
  })

  it('defaults unknown text to fun', () => {
    assert.equal(normalizeMood(''), 'fun')
    assert.equal(normalizeMood('xyz'), 'fun')
  })
})

describe('MusicSpecification', () => {
  it('builds thriller-like params from music prompt alone', () => {
    const spec = heuristicMusicSpecification('thriller')
    assert.equal(spec.label, 'thriller')
    assert.ok(spec.bpm >= 90 && spec.bpm <= 110)
    assert.ok(spec.tension >= 0.6)
    assert.equal(spec.scale, 'minor')
  })

  it('invents a vibe for nonsense without defaulting everything to fun', () => {
    const a = heuristicMusicSpecification('sfjdhskaj')
    const b = heuristicMusicSpecification('zzzxqq')
    assert.ok(a.bpm >= 48 && a.bpm <= 180)
    assert.ok(b.bpm >= 48 && b.bpm <= 180)
    assert.notEqual(a.label, 'fun')
  })

  it('sanitizes LLM-shaped payloads', () => {
    const spec = sanitizeMusicSpecification({
      label: 'noir chase',
      bpm: 104,
      energy: 0.6,
      tension: 0.8,
      brightness: 0.3,
      density: 0.4,
      scale: 'phrygian',
      percussion: 'steady',
      drone: true,
      pad: 'soft',
      rootMidi: 49,
    })
    assert.equal(spec.scale, 'phrygian')
    assert.equal(spec.percussion, 'steady')
  })
})

describe('generateScore', () => {
  it('creates different scores for different seeds', () => {
    const a = generateScore('fun', 11)
    const b = generateScore('fun', 99)
    assert.notEqual(a.id, b.id)
    assert.notDeepEqual(a.melody, b.melody)
  })

  it('is deterministic for the same seed', () => {
    const a = generateScore('horror', 42)
    const b = generateScore('horror', 42)
    assert.deepEqual(a, b)
  })

  it('uses MusicSpecification bpm and params', () => {
    const spec = sanitizeMusicSpecification({
      label: 'thriller',
      bpm: 98,
      energy: 0.55,
      tension: 0.75,
      brightness: 0.35,
      density: 0.32,
      scale: 'minor',
      percussion: 'steady',
      drone: true,
      pad: 'soft',
      rootMidi: 50,
    })
    const score = generateScore(spec, 7)
    assert.equal(score.specification.bpm, 98)
    assert.ok(score.bpm >= 95 && score.bpm <= 101)
    assert.equal(score.params.tension, 0.75)
    assert.equal(score.melody.length, 128)
    assert.equal(score.chords.length, 8)
  })
})
