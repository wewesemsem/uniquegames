/**
 * Prompt-driven visual style for procedural objects.
 * Infers palettes / appearance from free-text adjectives — not theme-specific recipes.
 */

import { hash01 } from '../procedural/objects/hash.js'

export const RAINBOW_PALETTE = Object.freeze([
  '#ff3355',
  '#ff8c00',
  '#ffd400',
  '#33cc66',
  '#3399ff',
  '#8b5cf6',
  '#ff66cc',
])

export const NEON_PALETTE = Object.freeze([
  '#39ff14',
  '#ff00ff',
  '#00f5ff',
  '#ffe600',
  '#ff2a6d',
  '#7b61ff',
])

export const GOLD_PALETTE = Object.freeze(['#f5d76e', '#e6b422', '#fff1a8', '#c9a227', '#ffe08a'])

export const ICE_PALETTE = Object.freeze(['#e8f6ff', '#b8dfff', '#7ec8e3', '#d0e8f8', '#9ad0f0'])

/** Forms used when alien / exotic fill must vary without hardcoding mushrooms. */
export const EXOTIC_FORMS = Object.freeze([
  'mushroom',
  'crystalline',
  'spire',
  'blob',
  'organic',
  'tree_like',
  'cluster',
  'dome',
  'ring',
  'crystal',
])

export function hashSeed(text) {
  let hash = 2166136261
  for (const char of String(text ?? '')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * @param {string} text
 * @returns {{
 *   paletteMode: 'none'|'rainbow'|'neon'|'gold'|'ice'|'vivid',
 *   colorHint: string|null,
 *   emission: number,
 *   vivid: boolean,
 * }}
 */
export function inferStyleIntent(text) {
  const t = String(text ?? '').toLowerCase()
  const rainbow =
    /rainbow|prism|spectrum|iridescent|chromatic|multicolou?r|multi[- ]?color|colorful|colourful/.test(t)
  const neon = /neon|cyber|synthwave/.test(t)
  const glow = /biolumines|glowing|lumin|fluores|emissive/.test(t)
  const gold = /golden|gold[- ]?plated|gilded|auric/.test(t)
  const ice = /ice|frozen|glacial|crystal blue|sapphire/.test(t)
  const vivid = rainbow || neon || /vivid|psychedelic|technicolor|painted|stained[- ]?glass/.test(t)

  let paletteMode = 'none'
  if (rainbow) paletteMode = 'rainbow'
  else if (neon) paletteMode = 'neon'
  else if (gold) paletteMode = 'gold'
  else if (ice) paletteMode = 'ice'
  else if (vivid || glow) paletteMode = 'vivid'

  let colorHint = null
  if (rainbow || vivid) colorHint = 'vivid'
  else if (neon || glow) colorHint = 'bioluminescent'
  else if (gold) colorHint = 'warm'
  else if (ice) colorHint = 'cool'

  return {
    paletteMode,
    colorHint,
    emission: neon || glow ? 0.75 : rainbow ? 0.35 : 0,
    vivid: Boolean(vivid || rainbow || neon || glow),
  }
}

export function paletteFromIntent(intent, seed = 1) {
  if (!intent || intent.paletteMode === 'none') return null
  if (intent.paletteMode === 'rainbow') return [...RAINBOW_PALETTE]
  if (intent.paletteMode === 'neon') return [...NEON_PALETTE]
  if (intent.paletteMode === 'gold') return [...GOLD_PALETTE]
  if (intent.paletteMode === 'ice') return [...ICE_PALETTE]
  if (intent.paletteMode === 'vivid') {
    return Array.from({ length: 6 }, (_, i) => {
      const hue = Math.floor(hash01(seed, i + 3) * 360)
      return `hsl(${hue} 72% 55%)`
    })
  }
  return null
}

/**
 * Forms mentioned explicitly in motif/text win; otherwise sample a varied pool.
 */
export function formsFromMotif(motif, seed, count, { preferFungal = false } = {}) {
  const text = String(motif ?? '').toLowerCase()
  const forced = []
  if (/mushroom|toadstool|fungi|fungus/.test(text)) forced.push('mushroom')
  if (/crystal|gem|quartz|mineral/.test(text)) forced.push('crystalline', 'crystal')
  if (/spire|needle|obelisk/.test(text)) forced.push('spire')
  if (/dome|cupola/.test(text)) forced.push('dome')
  if (/ring|halo|torus/.test(text)) forced.push('ring')
  if (/tree|forest|branch/.test(text)) forced.push('tree_like')
  if (/blob|amoeba|organic mass/.test(text)) forced.push('blob')
  if (/cluster|colony/.test(text)) forced.push('cluster')

  const pool = forced.length
    ? forced
    : preferFungal
      ? ['mushroom', 'organic', 'cluster', 'blob', 'tree_like', 'dome']
      : [...EXOTIC_FORMS]

  const forms = []
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(hash01(seed, i * 17 + 5) * pool.length) % pool.length
    forms.push(pool[idx])
  }
  return forms
}

const STRUCTURE_TYPES = new Set([
  'pyramid',
  'temple',
  'obelisk',
  'column',
  'statue',
  'ruins',
  'castle_tower',
  'stone_wall',
  'hieroglyphic_panel',
  'ancient_door',
])

/**
 * Attach palette / appearance so specialized meshes and generics can tint from the prompt.
 */
export function applyStyleToNeed(need, intent, seed = 1, index = 0) {
  if (!need || !intent || (!intent.vivid && intent.paletteMode === 'none')) {
    return need
  }

  const palette = paletteFromIntent(intent, seed + index)
  const appearance = { ...(need.appearance || {}) }
  if (intent.colorHint && !appearance.color) {
    appearance.color = intent.colorHint
  }
  if (intent.emission > 0 && !(appearance.emission > 0.05)) {
    appearance.emission = intent.emission
  }
  if (typeof appearance.hue !== 'number' && intent.vivid) {
    appearance.hue = Math.floor(hash01(seed, index + 41) * 360)
  }
  if (intent.vivid && !appearance.surface) {
    appearance.surface = intent.emission > 0.5 ? 'glowing' : 'glossy'
  }

  const params = { ...(need.params || {}) }
  if (palette?.length) {
    params.colors = palette
    params.styled = true
  }

  const next = {
    ...need,
    appearance,
    params,
  }

  if (palette?.length && (STRUCTURE_TYPES.has(String(need.type)) || need.type === 'generic')) {
    next.color = palette[index % palette.length]
  }

  return next
}

export function styleContextText(parts = []) {
  return parts.filter(Boolean).join(' ')
}
