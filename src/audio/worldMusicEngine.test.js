import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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

  it('stays in mood with varied bpm', () => {
    const scores = Array.from({ length: 8 }, (_, i) => generateScore('mellow', i + 1))
    for (const score of scores) {
      assert.equal(score.mood, 'mellow')
      assert.ok(score.bpm >= 68 && score.bpm <= 88)
      assert.equal(score.melody.length, 128)
      assert.equal(score.chords.length, 8)
    }
  })
})
