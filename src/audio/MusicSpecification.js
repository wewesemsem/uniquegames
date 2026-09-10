import { z } from 'zod'

export const MUSIC_SCALES = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'pentatonic',
  'whole_tone',
  'chromatic_sparse',
]

export const MUSIC_PERCUSSION = ['none', 'sparse', 'steady', 'busy']
export const MUSIC_PADS = ['none', 'soft', 'thick']

const MusicSpecificationSchema = z.object({
  label: z.string().trim().min(1).max(48),
  bpm: z.number().min(48).max(180),
  energy: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  brightness: z.number().min(0).max(1),
  density: z.number().min(0).max(1),
  scale: z.enum(MUSIC_SCALES),
  percussion: z.enum(MUSIC_PERCUSSION),
  drone: z.boolean(),
  pad: z.enum(MUSIC_PADS),
  rootMidi: z.number().int().min(36).max(72),
})

function clamp01(value, fallback = 0.5) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

function clamp(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function clip(value, max, fallback = '') {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  return text.length > max ? text.slice(0, max) : text
}

function pickEnum(value, allowed, fallback) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (allowed.includes(key)) return key
  const fuzzy = allowed.find((item) => key.includes(item) || item.includes(key))
  return fuzzy ?? fallback
}

export function sanitizeMusicSpecification(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const candidate = {
    label: clip(raw.label, 48, 'score') || 'score',
    bpm: Math.round(clamp(raw.bpm, 48, 180, 96)),
    energy: clamp01(raw.energy, 0.5),
    tension: clamp01(raw.tension, 0.4),
    brightness: clamp01(raw.brightness, 0.5),
    density: clamp01(raw.density, 0.35),
    scale: pickEnum(raw.scale, MUSIC_SCALES, 'minor'),
    percussion: pickEnum(raw.percussion, MUSIC_PERCUSSION, 'sparse'),
    drone: typeof raw.drone === 'boolean' ? raw.drone : clamp01(raw.tension, 0.4) >= 0.65,
    pad: pickEnum(raw.pad, MUSIC_PADS, 'soft'),
    rootMidi: Math.round(clamp(raw.rootMidi, 36, 72, 50)),
  }
  return MusicSpecificationSchema.parse(candidate)
}

export function parseMusicSpecification(input) {
  return sanitizeMusicSpecification(input)
}

export function safeParseMusicSpecification(input) {
  try {
    return { success: true, data: sanitizeMusicSpecification(input) }
  } catch (error) {
    return { success: false, error }
  }
}

/**
 * Local fallback when the music LLM is unavailable.
 * Uses only the music-field text — never the world prompt.
 */
export function heuristicMusicSpecification(prompt = '') {
  const text = String(prompt ?? '')
    .trim()
    .toLowerCase()

  if (!text) {
    return sanitizeMusicSpecification({
      label: 'fun',
      bpm: 118,
      energy: 0.7,
      tension: 0.25,
      brightness: 0.7,
      density: 0.45,
      scale: 'major',
      percussion: 'steady',
      drone: false,
      pad: 'soft',
      rootMidi: 55,
    })
  }

  if (/horror|scary|dark|spook|fear|creep|haunt|dread/.test(text)) {
    return sanitizeMusicSpecification({
      label: 'horror',
      bpm: 66,
      energy: 0.3,
      tension: 0.9,
      brightness: 0.2,
      density: 0.18,
      scale: 'phrygian',
      percussion: 'sparse',
      drone: true,
      pad: 'thick',
      rootMidi: 48,
    })
  }

  if (/thriller|suspense|tense|spy|noir|chase|pulse/.test(text)) {
    return sanitizeMusicSpecification({
      label: 'thriller',
      bpm: 98,
      energy: 0.55,
      tension: 0.75,
      brightness: 0.35,
      density: 0.32,
      scale: 'minor',
      percussion: 'steady',
      drone: true,
      pad: 'soft',
      rootMidi: 50,
    })
  }

  if (/mellow|calm|chill|soft|ambient|relax|peaceful|lofi|lo-fi|rain/.test(text)) {
    return sanitizeMusicSpecification({
      label: 'mellow',
      bpm: 78,
      energy: 0.35,
      tension: 0.2,
      brightness: 0.55,
      density: 0.2,
      scale: 'dorian',
      percussion: 'sparse',
      drone: false,
      pad: 'soft',
      rootMidi: 57,
    })
  }

  if (/fun|happy|upbeat|bright|adventure|play|party|dance|pop/.test(text)) {
    return sanitizeMusicSpecification({
      label: 'fun',
      bpm: 120,
      energy: 0.8,
      tension: 0.2,
      brightness: 0.75,
      density: 0.5,
      scale: 'major',
      percussion: 'busy',
      drone: false,
      pad: 'soft',
      rootMidi: 55,
    })
  }

  if (/jazz|swing/.test(text)) {
    return sanitizeMusicSpecification({
      label: 'jazz',
      bpm: 112,
      energy: 0.55,
      tension: 0.35,
      brightness: 0.6,
      density: 0.4,
      scale: 'dorian',
      percussion: 'steady',
      drone: false,
      pad: 'soft',
      rootMidi: 53,
    })
  }

  // Nonsense / unknown: invent a stable but prompt-seeded vibe from char codes.
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const u = () => {
    hash += 0x6d2b79f5
    let r = Math.imul(hash ^ (hash >>> 15), 1 | hash)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const scales = MUSIC_SCALES
  const percussion = MUSIC_PERCUSSION
  const pads = MUSIC_PADS
  return sanitizeMusicSpecification({
    label: clip(text.replace(/\s+/g, '_'), 48, 'invented') || 'invented',
    bpm: Math.round(64 + u() * 80),
    energy: u(),
    tension: u(),
    brightness: u(),
    density: 0.15 + u() * 0.5,
    scale: scales[Math.floor(u() * scales.length)],
    percussion: percussion[Math.floor(u() * percussion.length)],
    drone: u() > 0.45,
    pad: pads[Math.floor(u() * pads.length)],
    rootMidi: Math.round(42 + u() * 24),
  })
}
