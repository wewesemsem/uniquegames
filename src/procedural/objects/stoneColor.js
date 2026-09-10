/**
 * Shared material color resolution for specialized stone meshes.
 * Prompt-driven palettes win over limestone/sandstone defaults.
 */

import { hash01 } from './hash.js'

const STONE = ['#c9b896', '#b8a57a', '#d2c09a', '#a89878', '#c4b08c']
const SAND = ['#d2b48c', '#c4a574', '#e0c9a0', '#b8956a']

function stylePalette(params) {
  if (Array.isArray(params?.colors) && params.colors.length > 0) {
    return params.colors
  }
  return null
}

/** Prefer prompt-driven palette / tint; fall back to stone materials. */
export function stoneColor(seed, material, style = {}) {
  const { params, color, salt = 1 } = style
  const palette = stylePalette(params)
  if (palette) {
    return palette[Math.floor(hash01(seed, salt) * palette.length) % palette.length]
  }
  if (params?.styled && color) {
    return color
  }
  if (material === 'limestone' || !material) {
    return STONE[Math.floor(hash01(seed, 1) * STONE.length)]
  }
  if (material === 'sandstone') return SAND[Math.floor(hash01(seed, 2) * SAND.length)]
  if (material === 'basalt') return '#4a4a52'
  if (material === 'metal') return '#8a93a3'
  return STONE[0]
}
