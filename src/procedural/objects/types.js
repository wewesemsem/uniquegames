/**
 * Semantic procedural object types the LLM may request.
 * Aliases map free-form LLM strings → canonical types.
 */

export const PROCEDURAL_OBJECT_TYPES = [
  'pyramid',
  'temple',
  'obelisk',
  'column',
  'statue',
  'palm_tree',
  'desert_dune',
  'stone_wall',
  'hieroglyphic_panel',
  'torch',
  'ancient_door',
  'spaceship',
  'space_station',
  'planet',
  'asteroid',
  'lander',
  'rock',
  'tree',
  'crate',
  'console',
  'coral',
  'habitat',
  'ruins',
  'castle_tower',
  // Generic life / vegetation vocabulary (Scene Composer)
  'fish',
  'jellyfish',
  'seaweed',
  'flower',
  'bird',
  'generic',
  'box',
  'sphere',
]

const ALIASES = {
  pyramids: 'pyramid',
  great_pyramid: 'pyramid',
  sphinx: 'statue',
  pharaoh: 'statue',
  sculpture: 'statue',
  columns: 'column',
  pillar: 'column',
  pillars: 'column',
  palm: 'palm_tree',
  palms: 'palm_tree',
  palm_trees: 'palm_tree',
  dune: 'desert_dune',
  dunes: 'desert_dune',
  sand_dune: 'desert_dune',
  wall: 'stone_wall',
  walls: 'stone_wall',
  hieroglyph: 'hieroglyphic_panel',
  hieroglyphs: 'hieroglyphic_panel',
  panel: 'hieroglyphic_panel',
  door: 'ancient_door',
  gate: 'ancient_door',
  ship: 'spaceship',
  spacecraft: 'spaceship',
  starship: 'spaceship',
  station: 'space_station',
  orbital_station: 'space_station',
  moon: 'planet',
  rock_formation: 'rock',
  boulder: 'rock',
  asteroid_rock: 'asteroid',
  tree_oak: 'tree',
  forest_tree: 'tree',
  sarcophagus: 'statue',
  torch_wall: 'torch',
  beacon: 'torch',
  underwater_habitat: 'habitat',
  module: 'habitat',
  tower: 'castle_tower',
  keep: 'castle_tower',
  fish_school: 'fish',
  school: 'fish',
  fishes: 'fish',
  jelly: 'jellyfish',
  jellies: 'jellyfish',
  kelp: 'seaweed',
  algae: 'seaweed',
  wildflower: 'flower',
  wildflowers: 'flower',
  flowers: 'flower',
  bloom: 'flower',
  vegetation: 'flower',
  plant: 'flower',
  plants: 'flower',
  bird_flock: 'bird',
  flock: 'bird',
  birds: 'bird',
}

export function resolveObjectType(rawType = '', tags = [], description = '') {
  const text = `${rawType} ${tags.join(' ')} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  if (PROCEDURAL_OBJECT_TYPES.includes(rawType)) {
    return rawType
  }
  if (ALIASES[rawType]) {
    return ALIASES[rawType]
  }
  for (const [alias, type] of Object.entries(ALIASES)) {
    if (text.includes(alias)) {
      return type
    }
  }
  for (const type of PROCEDURAL_OBJECT_TYPES) {
    if (text.includes(type)) {
      return type
    }
  }
  if (/sphere|orb|globe|planet/.test(text)) return 'sphere'
  return 'box'
}

export function isLandmarkType(type) {
  return [
    'pyramid',
    'temple',
    'space_station',
    'spaceship',
    'castle_tower',
    'habitat',
    'desert_dune',
    'ruins',
  ].includes(type)
}
