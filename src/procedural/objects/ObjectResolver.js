import { resolveObjectType, isLandmarkType, PROCEDURAL_OBJECT_TYPES } from './types.js'
import { inferGenericDescriptor, shouldUseGeneric } from './GenericDescriptor.js'

/**
 * Maps a semantic object need → specialized type OR generic descriptor.
 *
 * Level 1: known types → specialized generators
 * Level 2: unknown concepts → safe generic procedural descriptor
 */
export function resolveProceduralObject(need = {}) {
  const raw = String(need.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (shouldUseGeneric(need) || raw === 'generic') {
    const descriptor = inferGenericDescriptor(need)
    return {
      type: 'generic',
      descriptor,
      specialized: false,
    }
  }

  const type = resolveObjectType(need.type, need.tags ?? [], need.description ?? need.name ?? '')
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
