/**
 * High-level scene intent the LLM (or heuristic) may return.
 * SceneComposer expands this into dense procedural content —
 * not a per-species object dictionary.
 */

import { z } from 'zod'

export const BIOMES = [
  'ocean_floor',
  'coral_reef',
  'open_ocean',
  'desert_plateau',
  'temple_court',
  'tomb',
  'meadow',
  'forest',
  'jungle',
  'orbital',
  'lunar',
  'deep_space',
  'urban',
  'cave',
  'alien',
  'generic',
]

export const LIFE_LEVELS = ['none', 'sparse', 'moderate', 'abundant']
export const VEGETATION_KINDS = [
  'none',
  'sparse',
  'meadow',
  'forest',
  'jungle',
  'coral_reef',
  'desert_scrub',
  'seaweed',
  'fungal',
  'alien',
]
export const LARGE_FEATURE_KINDS = [
  'none',
  'rocks',
  'reef',
  'ruins',
  'pyramids',
  'temples',
  'station',
  'buildings',
  'ships',
  'crystals',
  'fungal_grove',
]
export const ATMOSPHERE_KINDS = [
  'clear',
  'underwater_caustics',
  'dusty',
  'misty',
  'starfield',
  'nebula',
  'godrays',
  'pollen',
  'bioluminescent',
]

const pick = (value, allowed, fallback) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (allowed.includes(text)) return text
  const fuzzy = allowed.find((item) => text.includes(item) || item.includes(text))
  return fuzzy ?? fallback
}

export const DEFAULT_COMPOSITION = Object.freeze({
  biome: 'generic',
  life: 'moderate',
  vegetation: 'sparse',
  large_features: 'rocks',
  atmosphere: 'clear',
  density: 0.55,
})

export const CompositionSchema = z.object({
  biome: z.enum(BIOMES).default(DEFAULT_COMPOSITION.biome),
  life: z.enum(LIFE_LEVELS).default(DEFAULT_COMPOSITION.life),
  vegetation: z.enum(VEGETATION_KINDS).default(DEFAULT_COMPOSITION.vegetation),
  large_features: z.enum(LARGE_FEATURE_KINDS).default(DEFAULT_COMPOSITION.large_features),
  atmosphere: z.enum(ATMOSPHERE_KINDS).default(DEFAULT_COMPOSITION.atmosphere),
  density: z.number().min(0).max(1).default(DEFAULT_COMPOSITION.density),
  /** Free-text motif for unknown concepts (e.g. "glowing mushrooms") — never code. */
  motif: z.string().trim().min(1).max(60).optional(),
})

export function sanitizeComposition(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_COMPOSITION }
  }
  const density =
    typeof raw.density === 'number' && Number.isFinite(raw.density)
      ? Math.min(1, Math.max(0, raw.density))
      : DEFAULT_COMPOSITION.density
  return CompositionSchema.parse({
    biome: pick(raw.biome, BIOMES, DEFAULT_COMPOSITION.biome),
    life: pick(raw.life, LIFE_LEVELS, DEFAULT_COMPOSITION.life),
    vegetation: pick(raw.vegetation, VEGETATION_KINDS, DEFAULT_COMPOSITION.vegetation),
    large_features: pick(raw.large_features, LARGE_FEATURE_KINDS, DEFAULT_COMPOSITION.large_features),
    atmosphere: pick(raw.atmosphere, ATMOSPHERE_KINDS, DEFAULT_COMPOSITION.atmosphere),
    density,
    motif:
      typeof raw.motif === 'string' && raw.motif.trim()
        ? raw.motif.trim().slice(0, 60).replace(/[<>`]/g, '')
        : undefined,
  })
}

/**
 * Infer composition from theme / room text when the LLM omits it.
 */
export function inferComposition({ theme = '', description = '', tags = [], roomId = '', roomName = '' } = {}) {
  const text = `${theme} ${description} ${tags.join(' ')} ${roomId} ${roomName}`.toLowerCase()

  if (/alien|extraterrestrial|mushroom|fungi|biolumines|exoplanet/.test(text)) {
    return sanitizeComposition({
      biome: 'alien',
      life: 'moderate',
      vegetation: /mushroom|fungi/.test(text) ? 'fungal' : 'alien',
      large_features: /crystal/.test(text) ? 'crystals' : 'fungal_grove',
      atmosphere: 'bioluminescent',
      density: 0.85,
      motif: /mushroom|fungi/.test(text)
        ? 'giant glowing mushrooms'
        : /crystal/.test(text)
          ? 'floating crystal spires'
          : 'alien flora',
    })
  }

  if (/crystal.*city|floating crystal|crystal spire/.test(text)) {
    return sanitizeComposition({
      biome: 'alien',
      life: 'sparse',
      vegetation: 'none',
      large_features: 'crystals',
      atmosphere: 'bioluminescent',
      density: 0.7,
      motif: 'floating crystal city',
    })
  }

  if (/space|orbit|galaxy|nasa|starship|cosmos|lunar|moon|mars/.test(text)) {
    if (/moon|lunar/.test(text) || roomId === 'room2') {
      return sanitizeComposition({
        biome: 'lunar',
        life: 'none',
        vegetation: 'none',
        large_features: 'rocks',
        atmosphere: 'starfield',
        density: 0.45,
      })
    }
    if (/deep|nebula/.test(text) || roomId === 'room3') {
      return sanitizeComposition({
        biome: 'deep_space',
        life: 'none',
        vegetation: 'none',
        large_features: 'ships',
        atmosphere: 'nebula',
        density: 0.5,
      })
    }
    return sanitizeComposition({
      biome: 'orbital',
      life: 'none',
      vegetation: 'none',
      large_features: 'station',
      atmosphere: 'starfield',
      density: 0.55,
    })
  }

  if (/underwater|ocean|sea|coral|reef|aquatic|atlantis|fish/.test(text)) {
    if (/city|habitat|station/.test(text) || roomId === 'room1') {
      return sanitizeComposition({
        biome: 'ocean_floor',
        life: 'moderate',
        vegetation: 'seaweed',
        large_features: 'station',
        atmosphere: 'underwater_caustics',
        density: 0.6,
      })
    }
    if (/city/.test(text) || roomId === 'room3') {
      return sanitizeComposition({
        biome: 'open_ocean',
        life: 'abundant',
        vegetation: 'coral_reef',
        large_features: 'buildings',
        atmosphere: 'underwater_caustics',
        density: 0.7,
      })
    }
    return sanitizeComposition({
      biome: 'coral_reef',
      life: 'abundant',
      vegetation: 'coral_reef',
      large_features: 'reef',
      atmosphere: 'underwater_caustics',
      density: 0.85,
    })
  }

  if (/egypt|pyramid|pharaoh|nile|sphinx|tomb|desert/.test(text)) {
    if (/tomb|passage|corridor/.test(text) || roomId === 'room3') {
      return sanitizeComposition({
        biome: 'tomb',
        life: 'none',
        vegetation: 'none',
        large_features: 'ruins',
        atmosphere: 'dusty',
        density: 0.45,
      })
    }
    if (/temple|court/.test(text) || roomId === 'room2') {
      return sanitizeComposition({
        biome: 'temple_court',
        life: 'sparse',
        vegetation: 'desert_scrub',
        large_features: 'temples',
        atmosphere: 'dusty',
        density: 0.65,
      })
    }
    return sanitizeComposition({
      biome: 'desert_plateau',
      life: 'sparse',
      vegetation: 'desert_scrub',
      large_features: 'pyramids',
      atmosphere: 'dusty',
      density: 0.7,
    })
  }

  if (/jungle|rainforest/.test(text)) {
    return sanitizeComposition({
      biome: 'jungle',
      life: 'abundant',
      vegetation: 'jungle',
      large_features: 'rocks',
      atmosphere: 'misty',
      density: 0.9,
    })
  }

  if (/forest|woods|grove/.test(text)) {
    return sanitizeComposition({
      biome: 'forest',
      life: 'moderate',
      vegetation: 'forest',
      large_features: 'rocks',
      atmosphere: 'godrays',
      density: 0.75,
    })
  }

  if (/flower|meadow|field|garden|bloom/.test(text)) {
    return sanitizeComposition({
      biome: 'meadow',
      life: 'moderate',
      vegetation: 'meadow',
      large_features: 'rocks',
      atmosphere: 'pollen',
      density: 0.85,
    })
  }

  if (/city|cyber|street|neon|urban/.test(text)) {
    return sanitizeComposition({
      biome: 'urban',
      life: 'sparse',
      vegetation: 'sparse',
      large_features: 'buildings',
      atmosphere: 'misty',
      density: 0.55,
    })
  }

  if (/cave|cavern|grotto/.test(text)) {
    return sanitizeComposition({
      biome: 'cave',
      life: 'sparse',
      vegetation: 'none',
      large_features: 'rocks',
      atmosphere: 'misty',
      density: 0.5,
    })
  }

  return sanitizeComposition({ ...DEFAULT_COMPOSITION })
}

export function resolveRoomComposition(room = {}, theme = '') {
  if (room.composition) {
    return sanitizeComposition(room.composition)
  }
  return inferComposition({
    theme,
    description: room.environment?.description ?? room.name ?? '',
    tags: room.environment?.tags ?? [],
    roomId: room.id,
    roomName: room.name,
  })
}
