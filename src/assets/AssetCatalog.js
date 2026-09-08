/**
 * Known, reusable assets. This is a cache/optimization layer, not a limit
 * on what the user may request.
 */
export const assetCatalog = [
  {
    id: 'pano-warm',
    type: 'panorama',
    url: '/panoramas/room-1.jpg',
    tags: ['desert', 'egypt', 'temple', 'sand', 'warm', 'interior', 'ancient'],
    description: 'Warm interior / desert-toned panoramic environment',
  },
  {
    id: 'pano-cool',
    type: 'panorama',
    url: '/panoramas/room-2.jpg',
    tags: ['space', 'moon', 'station', 'city', 'cool', 'cyberpunk', 'underwater', 'ocean'],
    description: 'Cool blue panoramic environment',
  },
  {
    id: 'pano-green',
    type: 'panorama',
    url: '/panoramas/room-3.jpg',
    tags: ['forest', 'garden', 'nature', 'reef', 'underwater', 'jungle'],
    description: 'Green outdoor panoramic environment',
  },
  {
    id: 'prim-box',
    type: 'model',
    primitive: 'box',
    tags: ['box', 'crate', 'statue', 'sarcophagus', 'pyramid', 'building', 'console', 'torch', 'door'],
    description: 'Placeholder box primitive',
  },
  {
    id: 'prim-sphere',
    type: 'model',
    primitive: 'sphere',
    tags: ['sphere', 'planet', 'orb', 'rock', 'moon', 'lamp'],
    description: 'Placeholder sphere primitive',
  },
]

export function tokenize(...parts) {
  return [
    ...new Set(
      parts
        .flat()
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2)
    ),
  ]
}

export function scoreCatalogEntry(entry, request) {
  const haystack = new Set(tokenize(entry.tags, entry.description, entry.id))
  const tagNeedles = tokenize(request.tags)
  const otherNeedles = tokenize(request.description, request.type)

  function overlap(needles) {
    if (needles.length === 0) {
      return 0
    }
    let hits = 0
    for (const needle of needles) {
      if (haystack.has(needle)) {
        hits += 1
      }
    }
    return hits / needles.length
  }

  return overlap(tagNeedles) * 0.75 + overlap(otherNeedles) * 0.25
}
