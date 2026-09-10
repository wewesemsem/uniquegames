import { resolveObjectType, isLandmarkType, PROCEDURAL_OBJECT_TYPES } from './types.js'
import { inferGenericDescriptor, shouldUseGeneric } from './GenericDescriptor.js'
import { isEgyptContext } from '../../world/egyptContext.js'

/**
 * Maps a semantic object need → specialized type OR generic descriptor.
 *
 * Level 1: known types → specialized generators
 * Level 2: unknown concepts → safe generic procedural descriptor
 *
 * Specialized `temple` mesh is Ancient Egypt only. Other temples → generic motif.
 */
export function resolveProceduralObject(need = {}) {
  const raw = String(need.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  const contextText = `${need.type ?? ''} ${need.name ?? ''} ${need.description ?? ''} ${(need.tags ?? []).join(' ')}`

  if (shouldUseGeneric(need) || raw === 'generic') {
    const descriptor = inferGenericDescriptor(need)
    return {
      type: 'generic',
      descriptor,
      specialized: false,
    }
  }

  const type = resolveObjectType(need.type, need.tags ?? [], need.description ?? need.name ?? '')

  if (type === 'temple' && !isEgyptContext(contextText)) {
    const descriptor = inferGenericDescriptor({
      ...need,
      type: 'generic',
      category: need.category || 'structure',
      form: need.form || 'block',
      description: need.description || need.name || 'cultural temple',
      appearance: need.appearance || {
        scale_hint: 'giant',
        color: 'earthy',
        surface: 'matte',
        emission: 0,
        roughness: 0.75,
        metalness: 0,
        transparency: 0,
      },
      geometry: need.geometry || { primary_form: 'block', facets: 8, height: 5, width: 4 },
    })
    return { type: 'generic', descriptor, specialized: false }
  }

  // If alias resolution fell through to box for a clearly exotic word, prefer generic.
  if (
    type === 'box' &&
    raw &&
    !PROCEDURAL_OBJECT_TYPES.includes(raw) &&
    !/box|cube|crate|console/.test(`${raw} ${need.description ?? ''}`)
  ) {
    const descriptor = inferGenericDescriptor(need)
    return { type: 'generic', descriptor, specialized: false }
  }

  return { type, specialized: true }
}

export { resolveObjectType, isLandmarkType, PROCEDURAL_OBJECT_TYPES } from './types.js'
export {
  inferGenericDescriptor,
  shouldUseGeneric,
  createGenericNeed,
  sanitizeGenericDescriptor,
} from './GenericDescriptor.js'
