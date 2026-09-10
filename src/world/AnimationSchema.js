/**
 * Mandatory scene animation specification.
 * LLM describes WHAT moves and HOW (safe enums) —
 * the engine implements reusable behaviors. Never executable code.
 *
 * Rule: every scene has meaningful animation unless explicitly static.
 */

import { z } from 'zod'

export const BEHAVIOR_TYPES = [
  'swim',
  'sway',
  'fly',
  'float',
  'rise',
  'orbit',
  'pulse',
  'wave',
  'drift',
  'rotate',
  'flicker',
  'school',
]

export const SPEED_LEVELS = ['slow', 'medium', 'fast']
export const VARIATION_LEVELS = ['low', 'medium', 'high']
export const GROUP_BEHAVIORS = ['none', 'schooling', 'flocking', 'clustered']

/** Targets are semantic selectors — match object type, category, form, or env channel. */
export const COMMON_TARGETS = [
  'fish',
  'seaweed',
  'jellyfish',
  'coral',
  'bubbles',
  'particles',
  'light_rays',
  'sand',
  'dust',
  'pollen',
  'palm_tree',
  'tree',
  'flower',
  'bird',
  'torch',
  'generic',
  'mushroom',
  'atmosphere',
  'environment',
]

const pick = (value, allowed, fallback) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!text) return fallback
  if (allowed.includes(text)) return text
  const fuzzy = allowed.find((item) => text.includes(item) || item.includes(text))
  return fuzzy ?? fallback
}

export const AnimationBehaviorSchema = z.object({
  target: z.string().trim().min(1).max(40),
  behavior: z.enum(BEHAVIOR_TYPES),
  speed: z.enum(SPEED_LEVELS).default('medium'),
  variation: z.enum(VARIATION_LEVELS).default('medium'),
  group_behavior: z.enum(GROUP_BEHAVIORS).default('none'),
  amplitude: z.number().min(0).max(2).optional(),
})

export const AnimationSchema = z.object({
  required: z.boolean().default(true),
  static_scene: z.boolean().default(false),
  behaviors: z.array(AnimationBehaviorSchema).max(24).default([]),
})

export const DEFAULT_ANIMATION = Object.freeze({
  required: true,
  static_scene: false,
  behaviors: [
    { target: 'atmosphere', behavior: 'drift', speed: 'slow', variation: 'low', group_behavior: 'none' },
    { target: 'particles', behavior: 'drift', speed: 'slow', variation: 'medium', group_behavior: 'none' },
  ],
})

export function sanitizeAnimation(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ANIMATION, behaviors: [...DEFAULT_ANIMATION.behaviors] }
  }

  const staticScene = Boolean(raw.static_scene || raw.static === true)
  const behaviors = Array.isArray(raw.behaviors)
    ? raw.behaviors
        .filter((b) => b && typeof b === 'object')
        .slice(0, 24)
        .map((b) => ({
          target: String(b.target ?? 'atmosphere')
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_')
            .slice(0, 40) || 'atmosphere',
          behavior: pick(b.behavior, BEHAVIOR_TYPES, 'drift'),
          speed: pick(b.speed, SPEED_LEVELS, 'medium'),
          variation: pick(b.variation, VARIATION_LEVELS, 'medium'),
          group_behavior: pick(b.group_behavior ?? b.groupBehavior, GROUP_BEHAVIORS, 'none'),
          amplitude:
            typeof b.amplitude === 'number' && Number.isFinite(b.amplitude)
              ? Math.min(2, Math.max(0, b.amplitude))
              : undefined,
        }))
    : []

  if (staticScene) {
    return AnimationSchema.parse({ required: false, static_scene: true, behaviors: [] })
  }

  // Animation is mandatory — ensure at least atmospheric life.
  if (behaviors.length === 0) {
    return { ...DEFAULT_ANIMATION, behaviors: [...DEFAULT_ANIMATION.behaviors] }
  }

  return AnimationSchema.parse({
    required: true,
    static_scene: false,
    behaviors,
  })
}

/**
 * Infer a full animation block from composition / biome.
 * Architecture stays still; environment and life move.
 */
export function inferAnimation(composition = {}, options = {}) {
  if (options.static_scene || composition.static_scene) {
    return sanitizeAnimation({ static_scene: true, behaviors: [] })
  }

  const biome = composition.biome || 'generic'
  const vegetation = composition.vegetation || 'none'
  const life = composition.life || 'none'
  const atmosphere = composition.atmosphere || 'clear'
  const features = composition.large_features || 'none'
  const behaviors = []

  const add = (target, behavior, speed = 'medium', extras = {}) => {
    behaviors.push({
      target,
      behavior,
      speed,
      variation: extras.variation || 'medium',
      group_behavior: extras.group_behavior || 'none',
      amplitude: extras.amplitude,
    })
  }

  // Underwater ecosystems
  if (/ocean|coral|reef/.test(biome) || vegetation === 'seaweed' || vegetation === 'coral_reef') {
    if (life !== 'none') {
      add('fish', 'swim', 'medium', { variation: 'high', group_behavior: 'schooling' })
      add('jellyfish', 'float', 'slow', { variation: 'medium' })
      add('jellyfish', 'pulse', 'slow')
    }
    add('seaweed', 'sway', 'slow', { variation: 'medium' })
    add('coral', 'sway', 'slow', { variation: 'low', amplitude: 0.15 })
    add('bubbles', 'rise', 'slow')
    add('particles', 'drift', 'slow')
    add('light_rays', 'drift', 'slow', { variation: 'low' })
    add('atmosphere', 'wave', 'slow')
  } else if (
    biome === 'desert_plateau' ||
    biome === 'temple_court' ||
    biome === 'tomb' ||
    (/egypt|desert/.test(biome) && features !== 'temples')
  ) {
    add('sand', 'drift', 'slow')
    add('dust', 'drift', 'slow')
    add('particles', 'drift', 'slow')
    add('palm_tree', 'sway', 'slow', { variation: 'medium' })
    add('torch', 'flicker', 'fast', { variation: 'high' })
    add('bird', 'fly', 'medium', { group_behavior: 'flocking' })
    add('atmosphere', 'drift', 'slow')
    if (features === 'pyramids' || features === 'temples') {
      // Architecture stays static — no pyramid/temple behaviors on purpose.
    }
  } else if (features === 'temples') {
    add('particles', 'drift', 'slow')
    add('atmosphere', 'wave', 'slow')
    add('tree', 'sway', 'slow', { variation: 'low' })
    if (life !== 'none') {
      add('bird', 'fly', 'medium', { group_behavior: 'flocking' })
    }
  } else if (biome === 'meadow' || vegetation === 'meadow') {
    add('flower', 'sway', 'slow', { variation: 'medium' })
    add('tree', 'sway', 'slow', { variation: 'low' })
    add('pollen', 'drift', 'slow')
    add('particles', 'drift', 'slow')
    add('bird', 'fly', 'medium', { group_behavior: 'flocking' })
    add('atmosphere', 'wave', 'slow')
  } else if (biome === 'forest' || biome === 'jungle' || vegetation === 'forest' || vegetation === 'jungle') {
    add('tree', 'sway', 'slow', { variation: 'medium' })
    add('flower', 'sway', 'slow')
    add('bird', 'fly', 'medium', { group_behavior: 'flocking' })
    add('particles', 'drift', 'slow')
    add('atmosphere', 'drift', 'slow')
  } else if (biome === 'alien' || vegetation === 'fungal' || vegetation === 'alien') {
    add('generic', 'sway', 'slow', { variation: 'medium' })
    add('mushroom', 'pulse', 'slow', { variation: 'low' })
    add('particles', 'drift', 'slow')
    add('atmosphere', 'drift', 'medium')
    if (/float|crystal/i.test(composition.motif || '')) {
      add('generic', 'float', 'slow')
      add('generic', 'rotate', 'slow')
    }
  } else if (biome === 'orbital' || biome === 'lunar' || biome === 'deep_space') {
    add('spaceship', 'orbit', 'slow')
    add('asteroid', 'rotate', 'slow')
    add('planet', 'rotate', 'slow')
    add('particles', 'drift', 'slow')
    add('atmosphere', 'drift', 'slow')
  } else if (biome === 'urban') {
    add('particles', 'drift', 'medium')
    add('torch', 'flicker', 'fast')
    add('atmosphere', 'drift', 'slow')
  } else {
    add('particles', 'drift', 'slow')
    add('atmosphere', 'drift', 'slow')
    if (vegetation !== 'none') add('tree', 'sway', 'slow')
    if (life !== 'none') add('bird', 'fly', 'medium', { group_behavior: 'flocking' })
  }

  if (atmosphere === 'bioluminescent') {
    add('generic', 'pulse', 'slow', { variation: 'medium' })
    add('particles', 'drift', 'medium')
  }
  if (atmosphere === 'underwater_caustics') {
    add('light_rays', 'drift', 'slow')
  }
  if (atmosphere === 'pollen') {
    add('pollen', 'drift', 'slow')
  }
  if (atmosphere === 'dusty') {
    add('dust', 'drift', 'slow')
  }

  // Deduplicate by target+behavior
  const seen = new Set()
  const unique = behaviors.filter((b) => {
    const key = `${b.target}:${b.behavior}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return sanitizeAnimation({ required: true, static_scene: false, behaviors: unique })
}

export function speedToFactor(speed) {
  if (speed === 'slow') return 0.45
  if (speed === 'fast') return 1.85
  return 1
}

export function variationToFactor(variation) {
  if (variation === 'low') return 0.45
  if (variation === 'high') return 1.55
  return 1
}

/**
 * Pick the best matching behavior for a placed object.
 */
export function matchObjectAnimation(object = {}, animation = null) {
  if (!animation || animation.static_scene || !animation.behaviors?.length) {
    return null
  }
  const type = String(object.type || '').toLowerCase()
  const form = String(object.params?.descriptor?.form || object.form || '').toLowerCase()
  const category = String(object.params?.descriptor?.category || object.category || '').toLowerCase()
  const tags = (object.tags || object.params?.descriptor?.tags || []).map((t) => String(t).toLowerCase())

  const score = (target) => {
    const t = String(target).toLowerCase()
    if (t === type) return 100
    if (form && t === form) return 90
    if (category && t === category) return 70
    if (tags.includes(t)) return 60
    if (type === 'generic' && (t === 'mushroom' || t === 'generic') && (form === 'mushroom' || tags.includes('mushroom'))) {
      return 85
    }
    if (t === 'palm_tree' && type === 'palm_tree') return 100
    return 0
  }

  let best = null
  let bestScore = 0
  for (const behavior of animation.behaviors) {
    // Skip pure environment channels for mesh objects
    if (['bubbles', 'particles', 'sand', 'dust', 'pollen', 'light_rays', 'atmosphere', 'environment'].includes(behavior.target)) {
      continue
    }
    const s = score(behavior.target)
    if (s > bestScore) {
      bestScore = s
      best = behavior
    }
  }
  return bestScore > 0 ? best : null
}

/** Environment-channel behaviors (particles / atmosphere) for overlays. */
export function environmentAnimations(animation = null) {
  if (!animation || animation.static_scene) return []
  return (animation.behaviors || []).filter((b) =>
    ['bubbles', 'particles', 'sand', 'dust', 'pollen', 'light_rays', 'atmosphere', 'environment'].includes(b.target)
  )
}
