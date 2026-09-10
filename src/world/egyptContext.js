/**
 * Egyptian temple meshes / biomes are Egypt-only.
 * Other cultural temples use generic procedural motifs.
 */

export const EGYPT_CONTEXT_RE =
  /egypt|egyptian|pyramid|pharaoh|nile|sphinx|giza|hieroglyph|sarcophagus|cleopatra|anubis|luxor|karnak/

/** Biomes that are Egypt-coded end-to-end in this app. */
export const EGYPT_BIOMES = new Set(['desert_plateau', 'temple_court', 'tomb'])

export function isEgyptContext(text = '') {
  return EGYPT_CONTEXT_RE.test(String(text).toLowerCase())
}

export function compositionContextText(composition = {}, extra = {}) {
  const tags = Array.isArray(extra.tags) ? extra.tags.join(' ') : extra.tags || ''
  return [
    extra.theme,
    extra.description,
    extra.name,
    tags,
    composition.motif,
    composition.biome,
    composition.large_features,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Theme / description / tags / motif only — ignores egypt-coded biome names. */
export function egyptSignalText(composition = {}, extra = {}) {
  const tags = Array.isArray(extra.tags) ? extra.tags.join(' ') : extra.tags || ''
  return [extra.theme, extra.description, extra.name, tags, composition.motif].filter(Boolean).join(' ').toLowerCase()
}

/**
 * True when composition / theme clearly means Ancient Egypt.
 * Bare "temple" language without Egypt signals is not Egypt.
 */
export function isEgyptComposition(composition = {}, extra = {}) {
  if (isEgyptContext(egyptSignalText(composition, extra))) return true
  const biome = composition.biome || ''
  // After demotion, temple_court only remains for Egypt-directed rooms.
  if (biome === 'desert_plateau' || biome === 'tomb' || biome === 'temple_court') return true
  return false
}

/**
 * Rewrite LLM/heuristic temple_court → generic cultural temples unless Egypt is signaled.
 */
export function demoteNonEgyptTempleComposition(composition = {}, extra = {}) {
  if (!composition || typeof composition !== 'object') return composition
  if (isEgyptContext(egyptSignalText(composition, extra))) return composition

  const biome = composition.biome || ''
  const features = composition.large_features || 'none'
  if (biome !== 'temple_court' && features !== 'temples') return composition

  const signal = egyptSignalText(composition, extra)
  return {
    ...composition,
    biome: biome === 'temple_court' ? 'generic' : biome,
    vegetation:
      biome === 'temple_court' && composition.vegetation === 'desert_scrub'
        ? 'sparse'
        : composition.vegetation,
    atmosphere:
      biome === 'temple_court' && composition.atmosphere === 'dusty' ? 'misty' : composition.atmosphere,
    large_features: 'temples',
    motif: composition.motif || inferTempleMotif(signal),
  }
}

export function hasNonEgyptTempleCulture(text = '') {
  return /japan|japanese|shinto|torii|pagoda|sakura|zen|asia|asian|china|chinese|korea|korean|thai|bali|hindu|buddha|buddhist|india|indian|maya|mayan|aztec|inca|greek|greece|roman|rome|nordic|celtic|persian|mosque|cathedral|gothic|stupa|angkor|khmer/.test(
    String(text).toLowerCase()
  )
}

export function inferTempleMotif(text = '') {
  const t = String(text).toLowerCase()
  if (/japan|japanese|shinto|torii|sakura|zen/.test(t)) return 'japanese shrine courtyard'
  if (/china|chinese|pagoda/.test(t)) return 'chinese pagoda court'
  if (/korea|korean/.test(t)) return 'korean temple courtyard'
  if (/hindu|india|indian/.test(t)) return 'hindu temple courtyard'
  if (/buddha|buddhist|stupa/.test(t)) return 'buddhist temple courtyard'
  if (/maya|mayan/.test(t)) return 'mayan temple plaza'
  if (/aztec|inca/.test(t)) return 'mesoamerican temple plaza'
  if (/greek|greece|acropolis/.test(t)) return 'greek temple ruins'
  if (/roman|rome/.test(t)) return 'roman temple court'
  if (/mosque|persian/.test(t)) return 'ornate sanctuary court'
  if (/cathedral|gothic/.test(t)) return 'cathedral courtyard'
  if (/shrine|sanctuary|temple|pagoda|torii/.test(t)) return 'cultural temple courtyard'
  return 'cultural temple courtyard'
}
