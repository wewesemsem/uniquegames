import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertWorldSizeLimits,
  parseWorldSpecification,
  safeParseWorldSpecification,
  sanitizeWorldCandidate,
} from './WorldSpecification.js'

const validRoom = (id = 'room1') => ({
  id,
  name: 'Temple',
  environment: { type: 'panorama', description: 'Ancient temple interior', tags: ['egypt'] },
  objects: [{ type: 'statue', description: 'Stone statue', tags: ['statue'] }],
  hotspots: [],
})

describe('WorldSpecification', () => {
  it('parses a valid world', () => {
    const spec = parseWorldSpecification({
      theme: 'egypt',
      description: 'An exploration of ancient Egypt',
      rooms: [validRoom('room1'), validRoom('room2'), validRoom('room3')],
    })
    assert.equal(spec.rooms.length, 3)
  })

  it('rejects invented URLs', () => {
    const result = safeParseWorldSpecification({
      theme: 'hack',
      description: 'test',
      rooms: [
        {
          ...validRoom(),
          environment: { type: 'panorama', description: 'https://evil.example/pano.jpg', tags: [] },
        },
      ],
    })
    assert.equal(result.success, false)
  })

  it('rejects too many rooms', () => {
    assert.throws(
      () =>
        assertWorldSizeLimits(
          {
            theme: 'big',
            description: 'too big',
            rooms: [validRoom('room1'), validRoom('room2'), validRoom('room3'), validRoom('room4')],
          },
          { maxRooms: 3, maxObjectsPerRoom: 20, maxHotspotsPerRoom: 10 }
        ),
      /max rooms/i
    )
  })

  it('clamps tiny object scales instead of rejecting the world', () => {
    const sanitized = sanitizeWorldCandidate({
      theme: 'egypt',
      description: 'An exploration of ancient Egypt',
      rooms: [
        {
          ...validRoom('room1'),
          objects: [
            { type: 'torch', description: 'A small torch', tags: [], scale: 0.05 },
            { type: 'pyramid', description: 'Great pyramid', tags: [], scale: [0.01, 5, 0.01] },
          ],
        },
      ],
    })
    assert.equal(sanitized.rooms[0].objects[0].scale, 0.2)
    assert.deepEqual(sanitized.rooms[0].objects[1].scale, [0.2, 5, 0.2])

    const parsed = parseWorldSpecification(sanitized)
    assert.equal(parsed.rooms[0].objects[0].scale, 0.2)
    assert.deepEqual(parsed.rooms[0].objects[1].scale, [0.2, 5, 0.2])
  })

  it('rejects too many objects and hotspots', () => {
    assert.throws(
      () =>
        assertWorldSizeLimits(
          {
            theme: 'big',
            description: 'too many objects',
            rooms: [
              {
                ...validRoom(),
                objects: Array.from({ length: 21 }, (_, index) => ({
                  type: 'box',
                  description: `Box ${index}`,
                  tags: [],
                })),
              },
            ],
          },
          { maxRooms: 3, maxObjectsPerRoom: 20, maxHotspotsPerRoom: 10 }
        ),
      /max objects/i
    )

    assert.throws(
      () =>
        assertWorldSizeLimits(
          {
            theme: 'big',
            description: 'too many hotspots',
            rooms: [
              {
                ...validRoom(),
                hotspots: Array.from({ length: 11 }, (_, index) => ({
                  id: `h${index}`,
                  label: 'Go',
                  targetRoom: 'room2',
                  description: 'Travel',
                })),
              },
            ],
          },
          { maxRooms: 3, maxObjectsPerRoom: 20, maxHotspotsPerRoom: 10 }
        ),
      /max hotspots/i
    )
  })
})
