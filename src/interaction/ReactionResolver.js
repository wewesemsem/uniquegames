/**
 * Maps a structured reaction subject → procedural object need.
 * Prefer specialized generators; fall back to generic descriptors.
 * Never executes LLM code.
 */

import { resolveProceduralObject } from '../procedural/objects/ObjectResolver.js'

/** Known subjects → semantic object needs (safe structured data only). */
const SUBJECT_PRESETS = {
  mummy: {
    type: 'generic',
    description: 'Ancient mummy',
    tags: ['mummy', 'creature', 'undead'],
    category: 'creature',
    form: 'organic',
    appearance: {
      scale_hint: 'medium',
      color: 'earthy',
      surface: 'rough',
      emission: 0.05,
      roughness: 0.9,
      metalness: 0,
      transparency: 0,
    },
    geometry: { primary_form: 'organic', facets: 6, height: 1.8, width: 0.7 },
    behavior: { floating: false, clustered: false, count: 1 },
  },
  whale: {
    type: 'fish',
    description: 'Great whale',
    tags: ['whale', 'animal', 'ocean'],
    params: { count: 1, size: 'large', colors: ['#5a7a8a', '#8aa4b0'], movement: 'swim' },
  },
  butterfly: {
    type: 'bird',
    description: 'Butterfly',
    tags: ['butterfly', 'insect'],
    params: { count: 1, movement: 'flocking' },
  },
  bird: {
    type: 'bird',
    description: 'Bird',
    tags: ['bird'],
    params: { count: 3, movement: 'flocking' },
  },
  fish: {
    type: 'fish',
    description: 'Fish',
    tags: ['fish'],
    params: { count: 8, size: 'small', movement: 'schooling' },
  },
  jellyfish: {
    type: 'jellyfish',
    description: 'Jellyfish',
    tags: ['jellyfish'],
  },
  treasure: {
    type: 'generic',
    description: 'Glowing treasure',
    tags: ['treasure', 'artifact'],
    category: 'artifact',
    form: 'block',
    appearance: {
      scale_hint: 'small',
      color: 'warm',
      surface: 'glowing',
      emission: 0.85,
      roughness: 0.3,
      metalness: 0.4,
      transparency: 0.05,
    },
    geometry: { primary_form: 'block', facets: 4, height: 0.4, width: 0.5 },
  },
  artifact: {
    type: 'generic',
    description: 'Ancient artifact',
    tags: ['artifact'],
    category: 'artifact',
    form: 'block',
    appearance: {
      scale_hint: 'small',
      color: 'metallic',
      surface: 'glossy',
      emission: 0.35,
      roughness: 0.25,
      metalness: 0.7,
      transparency: 0,
    },
    geometry: { primary_form: 'block', facets: 6, height: 0.5, width: 0.4 },
  },
  crystal: {
    type: 'generic',
    description: 'Crystal shard',
    tags: ['crystal'],
    category: 'crystalline',
    form: 'crystalline',
    appearance: {
      scale_hint: 'medium',
      color: 'cool',
      surface: 'translucent',
      emission: 0.6,
      roughness: 0.15,
      metalness: 0.1,
      transparency: 0.4,
    },
    geometry: { primary_form: 'crystalline', facets: 10, height: 1.5, width: 0.6 },
  },
  asteroid: {
    type: 'asteroid',
    description: 'Asteroid fragment',
    tags: ['asteroid'],
  },
  spaceship: {
    type: 'spaceship',
    description: 'Scout craft',
    tags: ['ship'],
  },
}

const SPAWNING_TYPES = new Set([
  'spawn',
  'creature_appearance',
  'animal_appearance',
  'reveal',
  'open',
  'emerge',
])

export function resolveSubjectNeed(subject, reaction = {}) {
  const key = String(subject || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (!key) {
    return {
      type: 'generic',
      description: 'Procedural reaction object',
      tags: ['reaction'],
      category: 'prop',
      form: 'organic',
      appearance: {
        scale_hint: 'medium',
        color: 'vivid',
        surface: 'matte',
        emission: 0.2,
        roughness: 0.5,
        metalness: 0,
        transparency: 0,
      },
      geometry: { primary_form: 'organic', facets: 8, height: 1, width: 1 },
    }
  }

  if (SUBJECT_PRESETS[key]) {
    return { ...SUBJECT_PRESETS[key] }
  }

  // Fall through to generic procedural system for unknown subjects.
  return {
    type: key,
    description: key.replace(/_/g, ' '),
    tags: [key, 'reaction'],
    category: reaction.type === 'creature_appearance' ? 'creature' : reaction.type === 'animal_appearance' ? 'creature' : 'prop',
    form: 'organic',
    appearance: {
      scale_hint: 'medium',
      color: 'neutral',
      surface: 'matte',
      emission: 0.15,
      roughness: 0.55,
      metalness: 0,
      transparency: 0,
    },
    geometry: { primary_form: 'organic', facets: 8, height: 1.2, width: 0.8 },
  }
}

/**
 * Build one or more spawn descriptors for a reaction event.
 */
export function resolveReactionSpawns(event, sourceObject = null, now = 0) {
  const reaction = event?.reaction
  if (!reaction) return []

  const typesThatSpawn = SPAWNING_TYPES.has(reaction.type)
  const hasSubject = Boolean(reaction.subject)
  if (!typesThatSpawn && !hasSubject) {
    return []
  }
  // Non-spawn visual reactions (glow, particles, lighting) don't need meshes
  // unless a subject is explicitly provided.
  if (!typesThatSpawn && !['transform', 'move', 'fly', 'swim', 'walk'].includes(reaction.type)) {
    return []
  }

  const need = resolveSubjectNeed(reaction.subject || sourceObject?.type, reaction)
  const resolved = resolveProceduralObject(need)
  const count = Math.min(12, Math.max(1, reaction.count || 1))
  const baseScale = reaction.scale ?? (need.params?.size === 'large' ? 2.2 : 1)
  const offset = reaction.offset ?? [0, 0, 1.5]
  const origin = sourceObject?.position ?? [0, 0, -4]

  const spawns = []
  for (let i = 0; i < count; i += 1) {
    const jitter = count > 1 ? [(i - (count - 1) / 2) * 0.55, (i % 2) * 0.25, (i % 3) * 0.35] : [0, 0, 0]
    const position = [
      origin[0] + offset[0] + jitter[0],
      origin[1] + offset[1] + jitter[1],
      origin[2] + offset[2] + jitter[2],
    ]
    const scale = Array.isArray(baseScale)
      ? baseScale
      : [baseScale * (0.85 + (i % 3) * 0.08), baseScale, baseScale * (0.85 + (i % 2) * 0.1)]

    spawns.push({
      id: `${event.id}_spawn_${i}_${Math.floor(now)}`,
      eventId: event.id,
      type: resolved.type,
      kind: 'procedural',
      position,
      scale,
      rotation: [0, Math.atan2(offset[0] || 0.01, offset[2] || 0.01), 0],
      detail: 'medium',
      params: resolved.descriptor
        ? { ...(need.params ?? {}), descriptor: resolved.descriptor }
        : need.params,
      tags: need.tags,
      category: need.category || resolved.descriptor?.category,
      form: need.form || resolved.descriptor?.form,
      animation: reaction.animation,
      duration: reaction.duration ?? 4,
      startedAt: now,
      temporary: true,
    })
  }
  return spawns
}

export function reactionNeedsSpawn(reaction) {
  if (!reaction) return false
  if (SPAWNING_TYPES.has(reaction.type)) return true
  // move/fly/swim/walk with an explicit new subject still spawn
  if (
    reaction.subject &&
    ['fly', 'swim', 'walk'].includes(reaction.type) &&
    !['flee', 'bloom', 'glow_up', 'activate'].includes(reaction.animation)
  ) {
    return true
  }
  return false
}

export function reactionLighting(reaction) {
  if (!reaction) return null
  if (reaction.type === 'change_lighting' || reaction.type === 'glow' || reaction.lighting) {
    return {
      intensity: reaction.lighting?.intensity ?? (reaction.type === 'glow' ? 1.4 : 1.2),
      color: reaction.lighting?.color ?? '#ffc978',
    }
  }
  return null
}

export function reactionParticles(reaction) {
  if (!reaction) return null
  if (reaction.type === 'particles' || reaction.type === 'explode' || reaction.particles) {
    return reaction.particles || (reaction.type === 'explode' ? 'sparks' : 'dust')
  }
  return null
}
