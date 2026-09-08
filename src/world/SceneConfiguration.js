import { z } from 'zod'

/**
 * Structured scene parameters for the procedural 360° renderer.
 * The LLM acts as scene director: it may only fill this schema —
 * never code, URLs, CSS, or executable fields.
 */

export const ENVIRONMENT_TYPES = [
  'forest',
  'desert',
  'ocean',
  'space',
  'mountain',
  'city',
  'cave',
  'meadow',
  'snow',
  'swamp',
  'egypt',
]

export const TIME_OF_DAY = ['dawn', 'day', 'sunset', 'dusk', 'night']
export const SKY_TYPES = ['clear', 'cloudy', 'overcast', 'stormy', 'stars', 'nebula', 'underwater']
export const GROUND_TYPES = ['grass', 'sand', 'rock', 'snow', 'water', 'dirt', 'metal', 'lunar', 'none']
export const TERRAIN_TYPES = ['none', 'flat', 'hilly', 'lunar', 'desert', 'ocean_floor', 'rocky', 'metal']
export const PARTICLE_TYPES = [
  'none',
  'fireflies',
  'snow',
  'dust',
  'rain',
  'sparks',
  'bubbles',
  'stars',
  'sand',
  'pollen',
]
export const COLOR_MOODS = ['warm', 'cool', 'neutral', 'eerie', 'vivid']
export const LIGHTING_STYLES = ['neutral', 'cool', 'warm', 'low', 'dramatic']
export const STRUCTURE_TYPES = [
  'space_station',
  'spaceship',
  'lander',
  'pyramid',
  'temple',
  'obelisk',
  'columns',
  'coral',
  'reef',
  'habitat',
  'ruins',
  'rock_arch',
]
export const EFFECT_TYPES = ['none', 'aurora', 'caustics', 'dust', 'heat_haze', 'godrays', 'embers']

const unit = z.number().min(0).max(1)
const intIn = (min, max) => z.number().int().min(min).max(max)

export const SceneConfigurationSchema = z
  .object({
    environment: z.enum(ENVIRONMENT_TYPES).default('meadow'),
    timeOfDay: z.enum(TIME_OF_DAY).default('day'),
    sky: z.enum(SKY_TYPES).default('clear'),
    ground: z.enum(GROUND_TYPES).default('grass'),
    terrain: z.enum(TERRAIN_TYPES).default('flat'),
    fog: unit.default(0.2),
    treeDensity: unit.default(0.4),
    lighting: unit.default(0.75),
    lightingStyle: z.enum(LIGHTING_STYLES).default('neutral'),
    wind: unit.default(0.25),
    particles: z.enum(PARTICLE_TYPES).default('none'),
    colorMood: z.enum(COLOR_MOODS).default('neutral'),
    /** 0–1 → ~0–1500 procedural stars in the surround. */
    starDensity: unit.default(0),
    planetCount: intIn(0, 6).default(0),
    nebula: unit.default(0),
    structures: z.array(z.enum(STRUCTURE_TYPES)).max(4).default([]),
    earthVisible: z.boolean().default(false),
    animationSpeed: unit.default(0.35),
    effects: z.array(z.enum(EFFECT_TYPES)).max(3).default([]),
  })
  .strict()

export const RoomSceneMapSchema = z.record(z.string(), SceneConfigurationSchema)

export const DEFAULT_SCENE_CONFIGURATION = Object.freeze({
  environment: 'meadow',
  timeOfDay: 'day',
  sky: 'clear',
  ground: 'grass',
  terrain: 'flat',
  fog: 0.2,
  treeDensity: 0.45,
  lighting: 0.8,
  lightingStyle: 'neutral',
  wind: 0.2,
  particles: 'none',
  colorMood: 'neutral',
  starDensity: 0,
  planetCount: 0,
  nebula: 0,
  structures: [],
  earthVisible: false,
  animationSpeed: 0.35,
  effects: [],
})

export function parseSceneConfiguration(raw) {
  return SceneConfigurationSchema.parse(raw)
}

export function safeParseSceneConfiguration(raw) {
  return SceneConfigurationSchema.safeParse(raw)
}

function pick(text, map, fallback) {
  for (const [needle, value] of map) {
    if (text.includes(needle)) {
      return value
    }
  }
  return fallback
}

function spaceVariant(text, roomId) {
  if (text.includes('moon') || text.includes('lunar') || roomId === 'room2') {
    return {
      sky: 'stars',
      ground: 'lunar',
      terrain: 'lunar',
      starDensity: 0.45,
      planetCount: 1,
      nebula: 0.08,
      structures: ['lander'],
      earthVisible: true,
      lightingStyle: 'low',
      lighting: 0.4,
      particles: 'dust',
      fog: 0.04,
      treeDensity: 0,
      effects: ['dust'],
    }
  }
  if (text.includes('nebula') || text.includes('deep') || roomId === 'room3') {
    return {
      sky: 'nebula',
      ground: 'none',
      terrain: 'none',
      starDensity: 0.95,
      planetCount: 4,
      nebula: 0.9,
      structures: ['spaceship'],
      earthVisible: false,
      lightingStyle: 'dramatic',
      lighting: 0.55,
      particles: 'stars',
      fog: 0.12,
      treeDensity: 0,
      effects: ['aurora'],
    }
  }
  return {
    sky: 'stars',
    ground: 'metal',
    terrain: 'metal',
    starDensity: 0.65,
    planetCount: 2,
    nebula: 0.22,
    structures: ['space_station'],
    earthVisible: false,
    lightingStyle: 'cool',
    lighting: 0.7,
    particles: 'stars',
    fog: 0.06,
    treeDensity: 0,
    effects: [],
  }
}

function oceanVariant(text, roomId) {
  if (text.includes('reef') || text.includes('coral') || roomId === 'room2') {
    return {
      sky: 'underwater',
      ground: 'sand',
      terrain: 'ocean_floor',
      starDensity: 0,
      planetCount: 0,
      nebula: 0.15,
      structures: ['coral', 'reef'],
      lightingStyle: 'warm',
      lighting: 0.75,
      particles: 'bubbles',
      fog: 0.35,
      treeDensity: 0,
      effects: ['caustics', 'godrays'],
      timeOfDay: 'day',
      colorMood: 'vivid',
    }
  }
  if (text.includes('city') || roomId === 'room3') {
    return {
      sky: 'underwater',
      ground: 'metal',
      terrain: 'ocean_floor',
      structures: ['habitat'],
      lightingStyle: 'dramatic',
      lighting: 0.55,
      particles: 'bubbles',
      fog: 0.4,
      treeDensity: 0,
      effects: ['caustics'],
      timeOfDay: 'dusk',
      colorMood: 'cool',
      starDensity: 0,
      planetCount: 0,
      nebula: 0.1,
    }
  }
  return {
    sky: 'underwater',
    ground: 'metal',
    terrain: 'metal',
    structures: ['habitat'],
    lightingStyle: 'cool',
    lighting: 0.6,
    particles: 'bubbles',
    fog: 0.3,
    treeDensity: 0,
    effects: ['caustics'],
    timeOfDay: 'day',
    colorMood: 'cool',
    starDensity: 0,
    planetCount: 0,
    nebula: 0.05,
  }
}

function egyptVariant(text, roomId) {
  if (text.includes('tomb') || text.includes('passage') || text.includes('corridor') || roomId === 'room3') {
    return {
      environment: 'egypt',
      sky: 'clear',
      ground: 'rock',
      terrain: 'rocky',
      structures: ['columns'],
      lightingStyle: 'low',
      lighting: 0.4,
      particles: 'dust',
      fog: 0.32,
      treeDensity: 0,
      effects: ['embers'],
      timeOfDay: 'dusk',
      colorMood: 'eerie',
      starDensity: 0,
      planetCount: 0,
      nebula: 0,
    }
  }
  if (text.includes('temple') || text.includes('court') || roomId === 'room2') {
    return {
      environment: 'egypt',
      sky: 'clear',
      ground: 'sand',
      terrain: 'desert',
      structures: ['temple', 'columns', 'obelisk'],
      lightingStyle: 'warm',
      lighting: 0.75,
      particles: 'dust',
      fog: 0.18,
      treeDensity: 0,
      effects: ['godrays'],
      timeOfDay: 'sunset',
      colorMood: 'warm',
      starDensity: 0,
      planetCount: 0,
      nebula: 0,
    }
  }
  // Giza / desert plateau default
  return {
    environment: 'egypt',
    sky: 'clear',
    ground: 'sand',
    terrain: 'desert',
    structures: ['pyramid', 'obelisk'],
    lightingStyle: 'warm',
    lighting: 0.92,
    particles: 'sand',
    fog: 0.12,
    treeDensity: 0,
    effects: ['heat_haze', 'dust'],
    timeOfDay: 'day',
    colorMood: 'warm',
    starDensity: 0,
    planetCount: 0,
    nebula: 0,
  }
}

/**
 * Keyword heuristic when the LLM is unavailable or returns invalid JSON.
 * Still returns a validated SceneConfiguration. Uses room id/name so the
 * three rooms of a theme stay visually distinct.
 */
export function sceneFromDescription(description = '', theme = '', roomMeta = {}) {
  const roomId = String(roomMeta.id ?? '')
  const text = `${theme} ${roomMeta.name ?? ''} ${description}`.toLowerCase()

  const environment = pick(
    text,
    [
      ['egypt', 'egypt'],
      ['pyramid', 'egypt'],
      ['pharaoh', 'egypt'],
      ['space', 'space'],
      ['moon', 'space'],
      ['orbit', 'space'],
      ['nebula', 'space'],
      ['mars', 'desert'],
      ['desert', 'desert'],
      ['dune', 'desert'],
      ['underwater', 'ocean'],
      ['ocean', 'ocean'],
      ['sea', 'ocean'],
      ['reef', 'ocean'],
      ['forest', 'forest'],
      ['jungle', 'forest'],
      ['woods', 'forest'],
      ['mountain', 'mountain'],
      ['cliff', 'mountain'],
      ['city', 'city'],
      ['street', 'city'],
      ['cave', 'cave'],
      ['snow', 'snow'],
      ['ice', 'snow'],
      ['swamp', 'swamp'],
      ['marsh', 'swamp'],
    ],
    'meadow'
  )

  if (environment === 'space') {
    const variant = spaceVariant(text, roomId)
    return parseSceneConfiguration({
      environment: 'space',
      timeOfDay: 'night',
      colorMood: 'cool',
      wind: 0.05,
      animationSpeed: 0.4,
      earthVisible: false,
      ...variant,
    })
  }

  if (environment === 'ocean') {
    const variant = oceanVariant(text, roomId)
    return parseSceneConfiguration({
      environment: 'ocean',
      wind: 0.15,
      animationSpeed: 0.45,
      earthVisible: false,
      ...variant,
    })
  }

  if (environment === 'egypt') {
    const variant = egyptVariant(text, roomId)
    return parseSceneConfiguration({
      wind: 0.35,
      animationSpeed: 0.25,
      earthVisible: false,
      ...variant,
    })
  }

  const timeOfDay = pick(
    text,
    [
      ['night', 'night'],
      ['midnight', 'night'],
      ['sunset', 'sunset'],
      ['dusk', 'dusk'],
      ['dawn', 'dawn'],
      ['sunrise', 'dawn'],
    ],
    'day'
  )

  const sky = pick(
    text,
    [
      ['storm', 'stormy'],
      ['rain', 'stormy'],
      ['overcast', 'overcast'],
      ['cloud', 'cloudy'],
      ['star', 'stars'],
      ['clear', 'clear'],
    ],
    timeOfDay === 'night' ? 'stars' : 'clear'
  )

  const ground = pick(
    text,
    [
      ['sand', 'sand'],
      ['desert', 'sand'],
      ['snow', 'snow'],
      ['ice', 'snow'],
      ['rock', 'rock'],
      ['stone', 'rock'],
      ['water', 'water'],
      ['metal', 'metal'],
      ['dirt', 'dirt'],
      ['grass', 'grass'],
    ],
    environment === 'desert'
      ? 'sand'
      : environment === 'snow'
        ? 'snow'
        : environment === 'city'
          ? 'metal'
          : 'grass'
  )

  const particles = pick(
    text,
    [
      ['firefly', 'fireflies'],
      ['snow', 'snow'],
      ['dust', 'dust'],
      ['sandstorm', 'sand'],
      ['rain', 'rain'],
      ['spark', 'sparks'],
      ['pollen', 'pollen'],
    ],
    timeOfDay === 'night' && environment === 'forest' ? 'fireflies' : environment === 'snow' ? 'snow' : 'none'
  )

  const colorMood = pick(
    text,
    [
      ['eerie', 'eerie'],
      ['horror', 'eerie'],
      ['warm', 'warm'],
      ['sunset', 'warm'],
      ['cool', 'cool'],
      ['vivid', 'vivid'],
    ],
    timeOfDay === 'sunset' || timeOfDay === 'dawn' ? 'warm' : timeOfDay === 'night' ? 'cool' : 'neutral'
  )

  return parseSceneConfiguration({
    environment,
    timeOfDay,
    sky,
    ground,
    terrain: environment === 'desert' ? 'desert' : environment === 'mountain' ? 'rocky' : environment === 'city' ? 'metal' : 'flat',
    fog: environment === 'swamp' || sky === 'stormy' ? 0.45 : 0.22,
    treeDensity: environment === 'forest' ? 0.75 : environment === 'meadow' ? 0.35 : environment === 'desert' ? 0.05 : 0.4,
    lighting: timeOfDay === 'night' ? 0.35 : timeOfDay === 'dusk' ? 0.5 : timeOfDay === 'sunset' ? 0.7 : 0.85,
    lightingStyle: timeOfDay === 'night' ? 'low' : timeOfDay === 'sunset' || timeOfDay === 'dawn' ? 'warm' : 'neutral',
    wind: sky === 'stormy' ? 0.7 : 0.25,
    particles,
    colorMood,
    starDensity: sky === 'stars' || timeOfDay === 'night' ? 0.55 : 0,
    planetCount: 0,
    nebula: 0,
    structures: environment === 'city' ? ['habitat'] : environment === 'cave' ? ['ruins'] : [],
    earthVisible: false,
    animationSpeed: 0.35,
    effects: sky === 'stormy' ? ['dust'] : [],
  })
}
