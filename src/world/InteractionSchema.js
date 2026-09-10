/**
 * Scene-aware interaction + reaction specification.
 * LLM describes WHAT can be triggered and HOW the world reacts (safe enums) —
 * the engine owns event handling and procedural reactions. Never executable code.
 *
 * Pipeline: User Behavior → Interaction Detection → Scene Event →
 *           ReactionResolver → Procedural Reaction → Animated 3D Response
 */

import { z } from 'zod'
import { isEgyptComposition } from './egyptContext.js'

export const TRIGGER_TYPES = [
  'click',
  'tap',
  'vr_select',
  'gaze',
  'proximity',
  'approach',
  'enter_room',
  'timed',
  'after_event',
  'multi_interact',
]

/** Pointer-family triggers share the same input path (desktop/mobile/WebXR). */
export const POINTER_TRIGGERS = new Set(['click', 'tap', 'vr_select'])

export const REACTION_TYPES = [
  'spawn',
  'creature_appearance',
  'animal_appearance',
  'reveal',
  'disappear',
  'transform',
  'move',
  'fly',
  'swim',
  'walk',
  'emerge',
  'open',
  'close',
  'explode',
  'glow',
  'change_lighting',
  'particles',
  'sound',
  'chain_event',
]

export const REACTION_ANIMATIONS = [
  'appear',
  'emerge_from_door',
  'emerge',
  'swim_into_scene',
  'swim',
  'walk',
  'chase_player',
  'approach_player',
  'fly_in',
  'fly',
  'float_in',
  'open',
  'close',
  'bloom',
  'flee',
  'rise',
  'orbit_in',
  'glow_up',
  'burst',
  'activate',
]

export const INTERACTION_STATES = ['inactive', 'available', 'triggered', 'active', 'completed']

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

const clip = (value, max) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > max ? text.slice(0, max) : text
}

function clampNumber(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function sanitizeOffset(value) {
  if (!Array.isArray(value) || value.length < 3) return undefined
  return [
    clampNumber(value[0], -40, 40, 0),
    clampNumber(value[1], -20, 30, 0),
    clampNumber(value[2], -40, 40, 0),
  ]
}

export const ReactionSchema = z.object({
  type: z.enum(REACTION_TYPES),
  subject: z.string().trim().min(1).max(40).optional(),
  animation: z.enum(REACTION_ANIMATIONS).default('appear'),
  duration: z.number().min(0.5).max(30).default(4),
  once: z.boolean().optional(),
  count: z.number().int().min(1).max(12).default(1),
  offset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  scale: z.number().min(0.2).max(16).optional(),
  chain: z.string().trim().min(1).max(64).optional(),
  lighting: z
    .object({
      intensity: z.number().min(0).max(4).optional(),
      color: z.string().trim().min(1).max(24).optional(),
    })
    .optional(),
  particles: z.string().trim().min(1).max(40).optional(),
  sound: z.string().trim().min(1).max(40).optional(),
})

export const InteractionEventSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  target: z.string().trim().min(1).max(64),
  trigger: z.enum(TRIGGER_TYPES).default('click'),
  interactive: z.boolean().default(true),
  once: z.boolean().default(false),
  delay: z.number().min(0).max(120).default(0),
  proximity: z.number().min(0.5).max(40).default(4),
  gaze_duration: z.number().min(0.2).max(10).default(1.2),
  after_event: z.string().trim().min(1).max(64).optional(),
  multi_count: z.number().int().min(2).max(10).default(2),
  reaction: ReactionSchema,
})

export const InteractionsSchema = z.object({
  events: z.array(InteractionEventSchema).max(24).default([]),
})

export const DEFAULT_INTERACTIONS = Object.freeze({
  events: [],
})

export function sanitizeReaction(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      type: 'spawn',
      animation: 'appear',
      duration: 4,
      count: 1,
    }
  }
  const type = pick(raw.type, REACTION_TYPES, 'spawn')
  return ReactionSchema.parse({
    type,
    subject: raw.subject
      ? clip(raw.subject, 40)
          .toLowerCase()
          .replace(/[\s-]+/g, '_')
          .replace(/[^a-z0-9_]/g, '') || undefined
      : undefined,
    animation: pick(raw.animation, REACTION_ANIMATIONS, defaultAnimationFor(type)),
    duration: clampNumber(raw.duration, 0.5, 30, 4),
    once: raw.once === undefined ? undefined : Boolean(raw.once),
    count: Math.round(clampNumber(raw.count, 1, 12, 1)),
    offset: sanitizeOffset(raw.offset),
    scale: raw.scale !== undefined ? clampNumber(raw.scale, 0.2, 16, 1) : undefined,
    chain: raw.chain ? clip(raw.chain, 64) || undefined : undefined,
    lighting:
      raw.lighting && typeof raw.lighting === 'object'
        ? {
            intensity:
              raw.lighting.intensity !== undefined
                ? clampNumber(raw.lighting.intensity, 0, 4, 1)
                : undefined,
            color: raw.lighting.color ? clip(raw.lighting.color, 24) || undefined : undefined,
          }
        : undefined,
    particles: raw.particles ? clip(raw.particles, 40) || undefined : undefined,
    sound: raw.sound ? clip(raw.sound, 40) || undefined : undefined,
  })
}

function defaultAnimationFor(type) {
  if (type === 'emerge' || type === 'creature_appearance') return 'chase_player'
  if (type === 'swim' || type === 'animal_appearance') return 'swim_into_scene'
  if (type === 'fly') return 'fly_in'
  if (type === 'walk') return 'walk'
  if (type === 'open') return 'open'
  if (type === 'close') return 'close'
  if (type === 'glow' || type === 'change_lighting') return 'glow_up'
  if (type === 'explode' || type === 'particles') return 'burst'
  if (type === 'reveal') return 'appear'
  return 'appear'
}

export function sanitizeInteractionEvent(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const target = clip(raw.target, 64)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!target) return null

  const trigger = pick(raw.trigger, TRIGGER_TYPES, 'click')
  const reaction = sanitizeReaction(raw.reaction)
  const id =
    clip(raw.id, 64) ||
    `${target}_${trigger}_${reaction.type}_${index}`.replace(/[^a-z0-9_]+/g, '_').slice(0, 64)

  return InteractionEventSchema.parse({
    id,
    target,
    trigger,
    interactive: raw.interactive !== false,
    once: raw.once === true,
    delay: clampNumber(raw.delay, 0, 120, 0),
    proximity: clampNumber(raw.proximity ?? raw.radius, 0.5, 40, 4),
    gaze_duration: clampNumber(raw.gaze_duration ?? raw.gazeDuration, 0.2, 10, 1.2),
    after_event: raw.after_event || raw.afterEvent ? clip(raw.after_event || raw.afterEvent, 64) : undefined,
    multi_count: Math.round(clampNumber(raw.multi_count ?? raw.multiCount, 2, 10, 2)),
    reaction,
  })
}

export function sanitizeInteractions(raw) {
  if (!raw) return { events: [] }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.events) ? raw.events : []
  const events = list
    .map((item, index) => sanitizeInteractionEvent(item, index))
    .filter(Boolean)
    .slice(0, 24)
  return InteractionsSchema.parse({ events })
}

/**
 * Infer meaningful interactions from composition / biome.
 * Generic rules — not hard-coded runtime if/else for mummy vs whale.
 */
export function inferInteractions(composition = {}, options = {}) {
  if (options.static_scene || composition.static_scene) {
    return { events: [] }
  }

  const biome = composition.biome || 'generic'
  const vegetation = composition.vegetation || 'none'
  const features = composition.large_features || 'none'
  const life = composition.life || 'none'
  const events = []

  const add = (partial) => {
    events.push(sanitizeInteractionEvent(partial, events.length))
  }

  if (features === 'pyramids' || biome === 'desert_plateau') {
    add({
      id: 'pyramid_entrance_mummy',
      target: 'pyramid',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'creature_appearance',
        subject: 'mummy',
        animation: 'chase_player',
        duration: 12,
        scale: 2.6,
        particles: 'dust',
        lighting: { intensity: 3.2, color: '#ffb347' },
      },
    })
    add({
      id: 'statue_reveal',
      target: 'statue',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'spawn',
        subject: 'artifact',
        animation: 'appear',
        duration: 6,
        scale: 1.4,
        particles: 'sparks',
        lighting: { intensity: 2.4, color: '#ffe08a' },
      },
    })
  }

  if (isEgyptComposition(composition) && (biome === 'temple_court' || features === 'temples')) {
    add({
      id: 'sarcophagus_open',
      target: 'statue',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'open',
        subject: 'artifact',
        animation: 'open',
        duration: 4,
        offset: [0, 0.4, 1.2],
        scale: 0.6,
      },
    })
  }

  if (biome === 'tomb' || features === 'ruins') {
    add({
      id: 'torch_light',
      target: 'torch',
      trigger: 'proximity',
      proximity: 3,
      once: false,
      reaction: { type: 'change_lighting', animation: 'glow_up', duration: 6, lighting: { intensity: 1.8, color: '#ffb347' } },
    })
    add({
      id: 'door_mummy',
      target: 'ancient_door',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'creature_appearance',
        subject: 'mummy',
        animation: 'chase_player',
        duration: 12,
        scale: 2.4,
        particles: 'dust',
        lighting: { intensity: 3, color: '#ffb347' },
      },
    })
  }

  if (/ocean|coral|reef/.test(biome) || vegetation === 'coral_reef' || features === 'reef') {
    add({
      id: 'reef_whale',
      target: 'coral',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'animal_appearance',
        subject: 'whale',
        animation: 'swim_into_scene',
        duration: 8,
        offset: [12, 1.5, -8],
        scale: 2.4,
      },
    })
    add({
      id: 'jellyfish_flee',
      target: 'jellyfish',
      trigger: 'approach',
      proximity: 2.5,
      once: false,
      reaction: { type: 'move', subject: 'jellyfish', animation: 'flee', duration: 3 },
    })
    if (features === 'station' || biome === 'ocean_floor') {
      add({
        id: 'chest_open',
        target: 'crate',
        trigger: 'click',
        once: false,
        reaction: {
          type: 'open',
          subject: 'treasure',
          animation: 'open',
          duration: 4,
          offset: [0, 0.5, 0],
          scale: 0.5,
          particles: 'sparks',
        },
      })
    }
  }

  if (biome === 'meadow' || vegetation === 'meadow') {
    add({
      id: 'flowers_butterflies',
      target: 'flower',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'animal_appearance',
        subject: 'butterfly',
        animation: 'fly_in',
        duration: 6,
        count: 5,
        offset: [0, 0.8, 0],
        scale: 0.45,
      },
    })
    add({
      id: 'special_bloom',
      target: 'flower',
      trigger: 'approach',
      proximity: 2.2,
      once: true,
      reaction: { type: 'transform', subject: 'flower', animation: 'bloom', duration: 3 },
    })
  }

  if (biome === 'forest' || biome === 'jungle') {
    add({
      id: 'tree_birds',
      target: 'tree',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'animal_appearance',
        subject: 'bird',
        animation: 'fly_in',
        duration: 5,
        count: 4,
        offset: [0, 2, 0],
      },
    })
  }

  if (biome === 'orbital' || biome === 'lunar' || biome === 'deep_space' || features === 'ships' || features === 'station') {
    add({
      id: 'ship_activate',
      target: 'spaceship',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'spawn',
        subject: 'asteroid',
        animation: 'orbit_in',
        duration: 8,
        scale: 1.4,
        particles: 'sparks',
        lighting: { intensity: 2.8, color: '#7ec8ff' },
      },
    })
    add({
      id: 'planet_reveal',
      target: 'planet',
      trigger: 'gaze',
      gaze_duration: 1.5,
      once: true,
      reaction: {
        type: 'spawn',
        subject: 'asteroid',
        animation: 'orbit_in',
        duration: 6,
        offset: [3, 1, 2],
        scale: 0.6,
      },
    })
    add({
      id: 'asteroid_touch',
      target: 'asteroid',
      trigger: 'click',
      once: false,
      reaction: { type: 'particles', animation: 'burst', duration: 2, particles: 'sparks' },
    })
  }

  if (biome === 'alien' || vegetation === 'fungal' || features === 'crystals' || features === 'fungal_grove') {
    add({
      id: 'mushroom_pulse',
      target: 'generic',
      trigger: 'proximity',
      proximity: 3,
      once: false,
      reaction: { type: 'glow', animation: 'glow_up', duration: 3 },
    })
    add({
      id: 'crystal_spawn',
      target: 'generic',
      trigger: 'click',
      once: false,
      reaction: {
        type: 'spawn',
        subject: 'crystal',
        animation: 'appear',
        duration: 6,
        scale: 1.8,
        particles: 'sparks',
        lighting: { intensity: 2.6, color: '#a8e0ff' },
      },
    })
  }

  // Always give enter_room a subtle atmosphere beat when we have other events.
  if (events.length > 0) {
    add({
      id: 'room_enter_atmosphere',
      target: 'environment',
      trigger: 'enter_room',
      once: true,
      delay: 0.4,
      reaction: { type: 'particles', animation: 'appear', duration: 3, particles: 'dust' },
    })
  }

  return sanitizeInteractions({ events: events.filter(Boolean) })
}

/**
 * Match an interaction target selector against a placed object.
 */
export function matchObjectInteractions(object = {}, interactions = null) {
  if (!interactions?.events?.length) return []
  const type = String(object.type || '').toLowerCase()
  const id = String(object.id || '').toLowerCase()
  const tags = (object.tags || []).map((t) => String(t).toLowerCase())
  const form = String(object.form || object.params?.descriptor?.form || '').toLowerCase()
  const category = String(object.category || object.params?.descriptor?.category || '').toLowerCase()
  const name = String(object.name || '').toLowerCase()

  return interactions.events.filter((event) => {
    const t = String(event.target).toLowerCase()
    if (t === 'environment' || t === 'atmosphere' || t === 'room') return false
    if (t === type || t === id) return true
    if (id.includes(t) || type.includes(t)) return true
    if (tags.includes(t)) return true
    if (form && form === t) return true
    if (category && category === t) return true
    if (name && name.includes(t)) return true
    // Semantic aliases
    if (t === 'pyramid_entrance' && type === 'pyramid') return true
    if (t === 'coral_reef' && (type === 'coral' || tags.includes('reef'))) return true
    if (t === 'sarcophagus' && (type === 'statue' || tags.includes('sarcophagus'))) return true
    if (t === 'treasure_chest' && (type === 'crate' || tags.includes('chest'))) return true
    return false
  })
}

export function environmentInteractions(interactions = null) {
  if (!interactions?.events?.length) return []
  return interactions.events.filter((event) =>
    ['environment', 'atmosphere', 'room'].includes(String(event.target).toLowerCase())
  )
}

/** True if any pointer-family trigger is present for this object. */
export function objectIsInteractive(object = {}, interactions = null) {
  const matched = matchObjectInteractions(object, interactions)
  return matched.some((event) => event.interactive !== false)
}
