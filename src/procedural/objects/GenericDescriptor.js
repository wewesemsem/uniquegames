/**
 * Safe procedural object descriptors for unknown concepts.
 * The LLM fills category / form / material / behavior — never code.
 * Specialized generators still win when the type is known.
 */

import { z } from 'zod'
import { PROCEDURAL_OBJECT_TYPES } from './types.js'

export const OBJECT_CATEGORIES = [
  'organic_plant',
  'rock_formation',
  'structure',
  'vehicle',
  'creature',
  'artifact',
  'floating_structure',
  'crystalline',
  'vegetation',
  'prop',
]

export const PRIMARY_FORMS = [
  'mushroom',
  'crystalline',
  'spire',
  'dome',
  'blob',
  'cluster',
  'arch',
  'tower',
  'platform',
  'crystal',
  'organic',
  'block',
  'sphere',
  'ring',
  'tree_like',
  'rock',
]

export const SCALE_HINTS = ['tiny', 'small', 'medium', 'large', 'giant']
export const COLOR_HINTS = [
  'neutral',
  'warm',
  'cool',
  'vivid',
  'bioluminescent',
  'metallic',
  'earthy',
  'dark',
  'pastel',
]
export const SURFACE_HINTS = ['matte', 'glossy', 'rough', 'glowing', 'translucent', 'crystalline']

const unit = z.number().min(0).max(1)

export const GenericAppearanceSchema = z.object({
  scale_hint: z.enum(SCALE_HINTS).default('medium'),
  color: z.enum(COLOR_HINTS).default('neutral'),
  surface: z.enum(SURFACE_HINTS).default('matte'),
  emission: unit.default(0),
  roughness: unit.default(0.7),
  metalness: unit.default(0),
  transparency: unit.default(0),
  hue: z.number().min(0).max(360).optional(),
})

export const GenericGeometrySchema = z.object({
  primary_form: z.enum(PRIMARY_FORMS).default('organic'),
  facets: z.number().int().min(3).max(24).default(8),
  height: z.number().min(0.2).max(80).default(1),
  width: z.number().min(0.2).max(80).default(1),
})

export const GenericBehaviorSchema = z.object({
  floating: z.boolean().default(false),
  clustered: z.boolean().default(false),
  count: z.number().int().min(1).max(24).default(1),
})

export const GenericDescriptorSchema = z.object({
  category: z.enum(OBJECT_CATEGORIES).default('prop'),
  form: z.enum(PRIMARY_FORMS).optional(),
  appearance: GenericAppearanceSchema.default({}),
  geometry: GenericGeometrySchema.default({}),
  behavior: GenericBehaviorSchema.default({}),
})

function pick(value, allowed, fallback) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!text) return fallback
  if (allowed.includes(text)) return text
  const fuzzy = allowed.find((item) => text.includes(item) || item.includes(text))
  return fuzzy ?? fallback
}

function clip(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function clamp01(n, fallback = 0) {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(1, Math.max(0, v))
}

const COLOR_HEX = {
  neutral: '#9aa3ad',
  warm: '#d4a574',
  cool: '#7eb8d4',
  vivid: '#ff5e7a',
  bioluminescent: '#66ffe0',
  metallic: '#a8b0bc',
  earthy: '#8a6a45',
  dark: '#3a3f48',
  pastel: '#e8c4e0',
}

/**
 * Infer a safe generic descriptor from free-form LLM object fields.
 */
export function inferGenericDescriptor(need = {}) {
  const text = `${need.type ?? ''} ${need.name ?? ''} ${need.description ?? ''} ${(need.tags ?? []).join(' ')} ${need.form ?? ''} ${need.category ?? ''}`
    .toLowerCase()

  const explicit = need.appearance || need.geometry || need.behavior || need.category || need.form
    ? need
    : null

  let category = pick(need.category, OBJECT_CATEGORIES, null)
  let form = pick(need.form ?? need.geometry?.primary_form, PRIMARY_FORMS, null)

  if (!category) {
    if (/mushroom|fungi|fungus|toadstool|plant|flower|tree|vine|moss|kelp|seaweed/.test(text)) {
      category = 'organic_plant'
    } else if (/crystal|gem|quartz|mineral/.test(text)) {
      category = 'crystalline'
    } else if (/float|hover|levitat/.test(text) && /city|tower|island|structure|palace/.test(text)) {
      category = 'floating_structure'
    } else if (/building|tower|temple|ruin|wall|arch|city|spire/.test(text)) {
      category = 'structure'
    } else if (/ship|car|vehicle|craft|rover/.test(text)) {
      category = 'vehicle'
    } else if (/creature|beast|animal|insect|bird|fish/.test(text)) {
      category = 'creature'
    } else if (/rock|boulder|stone|cliff/.test(text)) {
      category = 'rock_formation'
    } else if (/artifact|relic|obelisk|totem|idol/.test(text)) {
      category = 'artifact'
    } else {
      category = 'prop'
    }
  }

  if (!form) {
    if (/mushroom|toadstool|fungi/.test(text)) form = 'mushroom'
    else if (/crystal|crystalline|gem/.test(text)) form = 'crystalline'
    else if (/spire|needle|obelisk/.test(text)) form = 'spire'
    else if (/dome|cupola/.test(text)) form = 'dome'
    else if (/arch/.test(text)) form = 'arch'
    else if (/tower/.test(text)) form = 'tower'
    else if (/ring|torus|halo/.test(text)) form = 'ring'
    else if (/tree/.test(text)) form = 'tree_like'
    else if (/rock|boulder/.test(text)) form = 'rock'
    else if (/sphere|orb|ball/.test(text)) form = 'sphere'
    else if (category === 'organic_plant') form = 'organic'
    else if (category === 'crystalline' || category === 'floating_structure') form = 'crystalline'
    else if (category === 'structure') form = 'block'
    else form = 'blob'
  }

  let scale_hint = pick(need.appearance?.scale_hint ?? need.scale_hint, SCALE_HINTS, null)
  if (!scale_hint) {
    if (/giant|colossal|huge|massive|enormous/.test(text)) scale_hint = 'giant'
    else if (/large|tall|big/.test(text)) scale_hint = 'large'
    else if (/tiny|miniature|small/.test(text)) scale_hint = 'small'
    else scale_hint = 'medium'
  }

  let color = pick(need.appearance?.color ?? need.color, COLOR_HINTS, null)
  if (!color) {
    if (/biolumines|glow|neon|lumin/.test(text)) color = 'bioluminescent'
    else if (/metal|chrome|steel/.test(text)) color = 'metallic'
    else if (/alien|purple|violet|magenta/.test(text)) color = 'vivid'
    else if (/crystal|ice|blue/.test(text)) color = 'cool'
    else if (/gold|sand|warm|amber/.test(text)) color = 'warm'
    else color = 'neutral'
  }

  let surface = pick(need.appearance?.surface ?? need.surface, SURFACE_HINTS, null)
  if (!surface) {
    if (/glow|emissive|biolumines/.test(text)) surface = 'glowing'
    else if (/crystal|glass|translucent/.test(text)) surface = 'translucent'
    else if (/gloss|shiny|polished/.test(text)) surface = 'glossy'
    else if (/rough|rocky/.test(text)) surface = 'rough'
    else surface = 'matte'
  }

  const glowing = surface === 'glowing' || color === 'bioluminescent' || /glow|biolumines/.test(text)
  const floating =
    Boolean(need.behavior?.floating) ||
    category === 'floating_structure' ||
    /float|hover|levitat/.test(text)

  const appearance = {
    scale_hint,
    color,
    surface,
    emission: clamp01(need.appearance?.emission, glowing ? 0.75 : 0),
    roughness: clamp01(need.appearance?.roughness, surface === 'glossy' || surface === 'crystalline' ? 0.25 : 0.7),
    metalness: clamp01(need.appearance?.metalness, color === 'metallic' ? 0.65 : 0),
    transparency: clamp01(
      need.appearance?.transparency,
      surface === 'translucent' || surface === 'crystalline' ? 0.45 : 0
    ),
    hue: typeof need.appearance?.hue === 'number' ? need.appearance.hue : undefined,
  }

  const geometry = {
    primary_form: form,
    facets: Math.min(24, Math.max(3, Math.round(Number(need.geometry?.facets) || (form === 'crystalline' ? 12 : 8)))),
    height: Math.min(80, Math.max(0.2, Number(need.geometry?.height) || (scale_hint === 'giant' ? 4 : 1))),
    width: Math.min(80, Math.max(0.2, Number(need.geometry?.width) || (scale_hint === 'giant' ? 3 : 1))),
  }

  const behavior = {
    floating,
    clustered: Boolean(need.behavior?.clustered) || /forest|grove|field|cluster|colony/.test(text),
    count: Math.min(24, Math.max(1, Math.round(Number(need.behavior?.count) || (explicit?.behavior?.count ?? 1)))),
  }

  return GenericDescriptorSchema.parse({
    category,
    form,
    appearance,
    geometry,
    behavior,
  })
}

export function sanitizeGenericDescriptor(raw) {
  if (!raw || typeof raw !== 'object') {
    return inferGenericDescriptor({})
  }
  return inferGenericDescriptor(raw)
}

export function descriptorBaseColor(appearance = {}) {
  if (typeof appearance.hue === 'number' && Number.isFinite(appearance.hue)) {
    return `hsl(${appearance.hue} 65% 55%)`
  }
  return COLOR_HEX[appearance.color] || COLOR_HEX.neutral
}

export function scaleHintMultiplier(hint) {
  if (hint === 'tiny') return 0.35
  if (hint === 'small') return 0.65
  if (hint === 'large') return 1.8
  if (hint === 'giant') return 3.4
  return 1
}

/**
 * True when we should use the generic procedural builder instead of a specialized mesh.
 */
export function shouldUseGeneric(need = {}) {
  const raw = clip(need.type, 40).toLowerCase().replace(/[\s-]+/g, '_')
  if (raw === 'generic' || raw === 'procedural' || raw === 'custom') return true
  if (need.category || need.form || need.appearance || need.geometry || need.behavior) {
    if (!PROCEDURAL_OBJECT_TYPES.includes(raw)) return true
  }
  if (!raw) return true
  if (PROCEDURAL_OBJECT_TYPES.includes(raw)) return false
  // Unknown type string → generic path (mushroom, crystal_spire, …)
  return true
}

export function createGenericNeed(partial = {}) {
  const descriptor = sanitizeGenericDescriptor(partial)
  return {
    type: 'generic',
    name: clip(partial.name, 80) || descriptor.form,
    description: clip(partial.description, 240) || `${descriptor.form} ${descriptor.category}`,
    tags: Array.isArray(partial.tags) ? partial.tags.slice(0, 12) : [descriptor.category, descriptor.form],
    category: descriptor.category,
    form: descriptor.form,
    appearance: descriptor.appearance,
    geometry: descriptor.geometry,
    behavior: descriptor.behavior,
    position: partial.position,
    scale: partial.scale,
    rotation: partial.rotation,
    detail: partial.detail,
  }
}
