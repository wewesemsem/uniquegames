/**
 * Procedural world score — original Web Audio synthesis only.
 * Each Explore regenerates a unique composition from a MusicSpecification
 * (LLM music prompt → BPM / scale / energy, etc.). No samples or vendor audio.
 */

import {
  heuristicMusicSpecification,
  sanitizeMusicSpecification,
} from './MusicSpecification.js'

export const MUSIC_MOODS = ['fun', 'horror', 'mellow']

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12
const FADE_SEC = 0.75
const STEPS_PER_BAR = 16
const BARS_PER_LOOP = 8
const LOOP_STEPS = STEPS_PER_BAR * BARS_PER_LOOP
const MUTE_KEY = 'uniquegames-world-music-muted'
const ENABLED_KEY = 'uniquegames-world-music-enabled'
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA=='

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  whole_tone: [0, 2, 4, 6, 8, 10],
  chromatic_sparse: [0, 1, 6, 7, 11],
}

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function buildPalette(spec) {
  const intervals = SCALE_INTERVALS[spec.scale] ?? SCALE_INTERVALS.minor
  const root = spec.rootMidi
  const degrees = []
  for (let octave = -1; octave <= 2; octave += 1) {
    for (const interval of intervals) {
      const midi = root + octave * 12 + interval
      if (midi >= 36 && midi <= 88) {
        degrees.push(midiToFreq(midi))
      }
    }
  }
  const bass = degrees.filter((f) => f < 140).slice(0, 8)
  const mid = degrees.filter((f) => f >= 140 && f < 400)
  const high = degrees.filter((f) => f >= 400)
  const melodyPool = [...mid, ...high].slice(0, 18)
  const chordRoots = []
  for (let i = 0; i < Math.min(6, intervals.length); i += 1) {
    const r = root + intervals[i]
    const third = intervals[(i + 2) % intervals.length]
    const fifth = intervals[(i + 4) % intervals.length]
    const chord = [midiToFreq(r), midiToFreq(root + third), midiToFreq(root + fifth)]
    if (spec.tension > 0.7 && intervals.length > 4) {
      chord[1] = midiToFreq(root + intervals[(i + 1) % intervals.length] + (spec.scale === 'phrygian' ? 12 : 0))
    }
    chordRoots.push(chord)
  }
  return {
    bass: bass.length ? bass : [midiToFreq(root), midiToFreq(root + 7)],
    chordRoots: chordRoots.length ? chordRoots : [[midiToFreq(root), midiToFreq(root + 3), midiToFreq(root + 7)]],
    melody: melodyPool.length ? melodyPool : [midiToFreq(root + 12), midiToFreq(root + 16)],
    accents: (high.length ? high : melodyPool).slice(0, 10),
  }
}

export function normalizeMood(mood) {
  const key = String(mood || '')
    .trim()
    .toLowerCase()
  if (MUSIC_MOODS.includes(key)) return key
  if (/horror|scary|dark|spook|fear|creep/.test(key)) return 'horror'
  if (/mellow|calm|chill|soft|ambient|relax|peaceful/.test(key)) return 'mellow'
  if (/fun|happy|upbeat|bright|adventure|play/.test(key)) return 'fun'
  return 'fun'
}

function specFromMoodOrSpec(moodOrSpec) {
  if (moodOrSpec && typeof moodOrSpec === 'object' && moodOrSpec.bpm != null) {
    return sanitizeMusicSpecification(moodOrSpec)
  }
  return heuristicMusicSpecification(String(moodOrSpec ?? ''))
}

/** Mulberry32 — deterministic PRNG from a 32-bit seed. */
export function createRng(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length]
}

function chance(rng, p) {
  return rng() < p
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

function hashSeed(text) {
  const raw = `${String(text || '')}:${Date.now()}:${Math.random()}`
  let h = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function buildMelody(rng, scale, density) {
  const steps = new Array(LOOP_STEPS).fill(null)
  let lastIdx = Math.floor(scale.length / 2)
  for (let step = 0; step < LOOP_STEPS; step += 1) {
    if (!chance(rng, density)) continue
    const jump = randInt(rng, -2, 2)
    lastIdx = Math.max(0, Math.min(scale.length - 1, lastIdx + jump))
    steps[step] = scale[lastIdx]
    if (chance(rng, 0.35) && step + 1 < LOOP_STEPS) {
      steps[step + 1] = null
    }
  }
  return steps
}

/**
 * Build a fresh loop from a MusicSpecification (or legacy mood string).
 * Pure + seeded so tests can assert variety.
 */
export function generateScore(moodOrSpec, seed = Date.now()) {
  const spec = specFromMoodOrSpec(moodOrSpec)
  const palette = buildPalette(spec)
  const rng = createRng(seed >>> 0)
  const bpmJitter = randInt(rng, -3, 3)
  const bpm = Math.min(180, Math.max(48, Math.round(spec.bpm + bpmJitter)))

  const chords = []
  const bass = []
  const bassOff = []
  for (let bar = 0; bar < BARS_PER_LOOP; bar += 1) {
    const chord = pick(rng, palette.chordRoots).slice()
    if (spec.tension > 0.7 && chord.length >= 2 && chance(rng, 0.55)) {
      chord.push(chord[1] * (chance(rng, 0.5) ? 1.498 : 1.414))
    }
    chords.push(chord)
    bass.push(pick(rng, palette.bass))
    bassOff.push(pick(rng, palette.bass))
  }

  const melody = buildMelody(rng, palette.melody, Math.min(0.55, 0.08 + spec.density * 0.55))
  const accents = Array.from({ length: BARS_PER_LOOP }, () => pick(rng, palette.accents))
  const bells = Array.from({ length: BARS_PER_LOOP }, () => pick(rng, palette.accents))

  let kickBeats = []
  let rimBeats = []
  let shakerEvery = 0
  if (spec.percussion === 'busy') {
    kickBeats = [0, 8]
    rimBeats = [4, 12]
    shakerEvery = 2
  } else if (spec.percussion === 'steady') {
    kickBeats = spec.energy > 0.55 ? [0, 8] : [0]
    rimBeats = chance(rng, 0.5) ? [8] : [4]
    shakerEvery = 4
  } else if (spec.percussion === 'sparse') {
    kickBeats = chance(rng, 0.6) ? [0] : [0, 10]
    rimBeats = chance(rng, 0.35) ? [8] : []
    shakerEvery = chance(rng, 0.4) ? 8 : 0
  }

  const pizzBeats =
    spec.density > 0.45 ? [6, 14] : spec.tension > 0.6 ? [4, 12] : chance(rng, 0.5) ? [8] : []
  const bellBeats = spec.brightness > 0.6 ? [3, 11] : spec.tension > 0.65 ? [7, 15] : [8]

  const flourish =
    spec.energy > 0.65
      ? {
          bars: [6, 7],
          beats: [2, 5, 9, 13],
          notes: Array.from({ length: 8 }, () => pick(rng, palette.melody.slice(-6))),
        }
      : null

  const level = 0.14 + spec.energy * 0.12

  return {
    id: seed >>> 0,
    mood: spec.label,
    bpm,
    level,
    chords,
    bass,
    bassOff,
    melody,
    accents,
    bells,
    kickBeats,
    rimBeats,
    shakerEvery,
    pizzBeats,
    bellBeats,
    flourish,
    params: {
      energy: spec.energy,
      tension: spec.tension,
      brightness: spec.brightness,
      density: spec.density,
      drone: spec.drone,
      pad: spec.pad,
      percussion: spec.percussion,
      scale: spec.scale,
      label: spec.label,
    },
    specification: spec,
  }
}

function readBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}

function writeBool(key, value) {
  try {
    localStorage.setItem(key, String(!!value))
  } catch {
    // ignore
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function WorldMusicEngine() {
  this.ctx = null
  this.master = null
  this.musicGain = null
  this.timer = null
  this.nextStepTime = 0
  this.currentStep = 0
  this.playing = false
  this.muted = readBool(MUTE_KEY, false)
  this.userPaused = !readBool(ENABLED_KEY, true)
  this.unlocked = false
  this.mood = 'fun'
  this.score = generateScore('fun', 1)
  this.listeners = []
  this._noiseBuffer = null
  this._silentEl = null
  this._sessionWired = false
  this._visibilityWired = false
}

WorldMusicEngine.prototype.getPreset = function () {
  return {
    bpm: this.score?.bpm || 100,
    level: this.score?.level || 0.2,
  }
}

WorldMusicEngine.prototype.stepDuration = function () {
  return 60 / this.getPreset().bpm / 4
}

WorldMusicEngine.prototype.getState = function () {
  return {
    playing: this.playing && !this.userPaused,
    muted: this.muted,
    unlocked: this.unlocked,
    mood: this.mood,
    scoreId: this.score?.id ?? null,
    reducedMotion: prefersReducedMotion(),
  }
}

WorldMusicEngine.prototype.subscribe = function (fn) {
  this.listeners.push(fn)
  return () => {
    this.listeners = this.listeners.filter((l) => l !== fn)
  }
}

WorldMusicEngine.prototype.emit = function () {
  const state = this.getState()
  this.listeners.forEach((fn) => fn(state))
}

WorldMusicEngine.prototype.ensureContext = function () {
  if (this.ctx) return this.ctx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  this.promotePlaybackSession()
  this.ctx = new Ctx()
  this.master = this.ctx.createGain()
  this.master.gain.value = 1
  this.master.connect(this.ctx.destination)
  this.musicGain = this.ctx.createGain()
  this.musicGain.gain.value = 0
  this.musicGain.connect(this.master)
  this.wireContextLifecycle()
  return this.ctx
}

WorldMusicEngine.prototype.promotePlaybackSession = function () {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'playback'
    }
  } catch {
    // ignore
  }
}

WorldMusicEngine.prototype.primeHtmlAudioUnlock = function () {
  try {
    if (!this._silentEl) {
      this._silentEl = new Audio(SILENT_WAV)
      this._silentEl.setAttribute('playsinline', '')
      this._silentEl.setAttribute('webkit-playsinline', '')
      this._silentEl.loop = true
      this._silentEl.volume = 0.01
      this._silentEl.muted = false
    }
    const playPromise = this._silentEl.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {})
    }
  } catch {
    // ignore
  }
}

WorldMusicEngine.prototype.primeWebAudioUnlock = function (ctx) {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // ignore
  }
}

WorldMusicEngine.prototype.wireContextLifecycle = function () {
  if (this._sessionWired || !this.ctx) return
  this._sessionWired = true
  const self = this
  this.ctx.addEventListener('statechange', () => {
    if (self.ctx && self.ctx.state === 'running') {
      self.unlocked = true
    } else if (self.ctx && self.ctx.state === 'suspended' && self.playing) {
      self.unlocked = false
      self.emit()
    }
  })
  if (!this._visibilityWired && typeof document !== 'undefined') {
    this._visibilityWired = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (self.userPaused || self.muted || prefersReducedMotion()) return
      if (!self.playing && !self.unlocked) return
      self.resumeContext().then((ok) => {
        if (ok && self.playing && !self.userPaused && !self.muted) {
          self.fadeMusicTo(self.effectiveLevel(), 0.35)
        }
      })
    })
  }
}

WorldMusicEngine.prototype.resumeContext = function () {
  this.promotePlaybackSession()
  this.primeHtmlAudioUnlock()
  const ctx = this.ensureContext()
  if (!ctx) return Promise.resolve(false)
  this.primeWebAudioUnlock(ctx)

  const finish = () => {
    const running = ctx.state === 'running'
    this.unlocked = running
    return running
  }

  if (ctx.state === 'running') return Promise.resolve(finish())

  return ctx
    .resume()
    .then(finish)
    .catch(() => {
      this.unlocked = false
      return false
    })
}

WorldMusicEngine.prototype.getNoise = function () {
  if (this._noiseBuffer) return this._noiseBuffer
  const ctx = this.ctx
  const len = ctx.sampleRate * 0.2
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  this._noiseBuffer = buffer
  return buffer
}

WorldMusicEngine.prototype.fadeMusicTo = function (value, seconds) {
  if (!this.musicGain) return
  const now = this.ctx.currentTime
  const g = this.musicGain.gain
  g.cancelScheduledValues(now)
  g.setValueAtTime(Math.max(g.value, 0.0001), now)
  if (value <= 0) {
    g.exponentialRampToValueAtTime(0.0001, now + seconds)
  } else {
    g.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + seconds)
  }
}

WorldMusicEngine.prototype.effectiveLevel = function () {
  if (this.muted || this.userPaused || prefersReducedMotion()) return 0
  return this.getPreset().level
}

WorldMusicEngine.prototype.playPluck = function (freq, when, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = (gain || 0.08) * 0.9
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const amp = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = 'triangle'
  osc2.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  osc2.frequency.setValueAtTime(freq * 2, when)
  osc2.detune.setValueAtTime(4, when)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(g, when + 0.012)
  amp.gain.exponentialRampToValueAtTime(g * 0.35, when + 0.12)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.55)
  osc.connect(filter)
  osc2.connect(amp)
  filter.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc2.start(when)
  osc.stop(when + 0.6)
  osc2.stop(when + 0.6)
}

WorldMusicEngine.prototype.playBell = function (freq, when, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = gain || 0.05
  const osc = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  const amp = ctx.createGain()
  osc.type = 'sine'
  mod.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  mod.frequency.setValueAtTime(freq * 3.2, when)
  modGain.gain.setValueAtTime(freq * 1.4, when)
  modGain.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
  mod.connect(modGain)
  modGain.connect(osc.frequency)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(g, when + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.7)
  osc.connect(amp)
  amp.connect(out)
  mod.start(when)
  osc.start(when)
  mod.stop(when + 0.75)
  osc.stop(when + 0.75)
}

WorldMusicEngine.prototype.playPizz = function (freq, when, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = gain || 0.045
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, when)
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(freq * 2.2, when)
  filter.Q.setValueAtTime(4, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(g, when + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.22)
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc.stop(when + 0.25)
}

WorldMusicEngine.prototype.playBass = function (freq, when, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = gain || 0.1
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(g, when + 0.02)
  amp.gain.exponentialRampToValueAtTime(g * 0.5, when + 0.2)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.45)
  osc.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc.stop(when + 0.5)
}

WorldMusicEngine.prototype.playPad = function (freqs, when, dur, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = (gain || 0.03) / Math.max(freqs.length, 1)
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, when)
    osc.detune.setValueAtTime(idx === 1 ? -6 : idx === 2 ? 5 : 0, when)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(900 + (this.score?.params?.brightness ?? 0.5) * 900, when)
    amp.gain.setValueAtTime(0.0001, when)
    amp.gain.linearRampToValueAtTime(g, when + 0.35)
    amp.gain.setValueAtTime(g, when + dur - 0.4)
    amp.gain.linearRampToValueAtTime(0.0001, when + dur)
    osc.connect(filter)
    filter.connect(amp)
    amp.connect(out)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  })
}

WorldMusicEngine.prototype.playDrone = function (freq, when, dur, gain) {
  const ctx = this.ctx
  const out = this.musicGain
  const g = gain || 0.04
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const amp = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = 'sawtooth'
  osc2.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  osc2.frequency.setValueAtTime(freq * 1.01, when)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(420, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.linearRampToValueAtTime(g, when + 0.8)
  amp.gain.setValueAtTime(g, when + dur - 0.9)
  amp.gain.linearRampToValueAtTime(0.0001, when + dur)
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc2.start(when)
  osc.stop(when + dur + 0.02)
  osc2.stop(when + dur + 0.02)
}

WorldMusicEngine.prototype.playKick = function (when, gain = 0.07) {
  const ctx = this.ctx
  const out = this.musicGain
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, when)
  osc.frequency.exponentialRampToValueAtTime(48, when + 0.12)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.22)
  osc.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc.stop(when + 0.25)
}

WorldMusicEngine.prototype.playRim = function (when) {
  const ctx = this.ctx
  const out = this.musicGain
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(780, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(0.035, when + 0.002)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  osc.connect(amp)
  amp.connect(out)
  osc.start(when)
  osc.stop(when + 0.06)
}

WorldMusicEngine.prototype.playShaker = function (when, gain = 0.028) {
  const ctx = this.ctx
  const out = this.musicGain
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const amp = ctx.createGain()
  src.buffer = this.getNoise()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime((this.score?.params?.brightness ?? 0.5) > 0.45 ? 6000 : 1800, when)
  filter.Q.setValueAtTime(0.8, when)
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.07)
  src.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  src.start(when)
  src.stop(when + 0.08)
}

WorldMusicEngine.prototype.scheduleStep = function (step, when) {
  const score = this.score
  if (!score) return

  const bar = Math.floor(step / STEPS_PER_BAR) % BARS_PER_LOOP
  const beat = step % STEPS_PER_BAR
  const loopCycle = Math.floor(step / LOOP_STEPS)
  const stepDur = this.stepDuration()
  const params = score.params ?? {}
  const energy = params.energy ?? 0.5
  const tension = params.tension ?? 0.4
  const brightness = params.brightness ?? 0.5
  const padMode = params.pad ?? 'soft'
  const useDrone = Boolean(params.drone)

  if (beat === 0) {
    const chord = score.chords[bar]
    if (useDrone || tension > 0.7) {
      this.playDrone(chord[0], when, stepDur * STEPS_PER_BAR, 0.03 + tension * 0.03)
    }
    if (padMode !== 'none') {
      const padGain = padMode === 'thick' ? 0.04 : 0.03 + (1 - tension) * 0.01
      this.playPad(chord, when, stepDur * STEPS_PER_BAR, padGain)
    }
  }

  if (energy > 0.6) {
    if (beat === 0 || beat === 8) this.playBass(score.bass[bar], when, 0.09 + energy * 0.04)
    if (beat === 4 || beat === 12) this.playBass(score.bassOff[bar], when, 0.06 + energy * 0.02)
  } else if (energy > 0.35) {
    if (beat === 0) this.playBass(score.bass[bar], when, 0.08)
  } else if (beat === 0 && bar % 4 === 0) {
    this.playBass(score.bass[bar], when, 0.1)
  }

  if (score.kickBeats.includes(beat)) {
    this.playKick(when, 0.06 + tension * 0.04)
  }
  if (score.rimBeats.includes(beat)) this.playRim(when)
  if (score.shakerEvery > 0 && beat % score.shakerEvery === 0) {
    this.playShaker(when, 0.012 + brightness * 0.02)
  }

  const mel = score.melody[step % LOOP_STEPS]
  if (mel) {
    const gain = 0.035 + energy * 0.04
    if (tension > 0.65 || brightness < 0.35) this.playPizz(mel, when, gain)
    else this.playPluck(mel, when, gain)
  }

  if (score.pizzBeats.includes(beat)) {
    this.playPizz(score.accents[bar], when, 0.03 + tension * 0.02)
  }
  if (score.bellBeats.includes(beat)) {
    this.playBell(score.bells[bar], when, 0.022 + brightness * 0.02)
  }

  if (score.flourish && loopCycle % 2 === 1) {
    const { bars, beats, notes } = score.flourish
    if (bars.includes(bar) && beats.includes(beat)) {
      const idx = (bar === bars[1] ? 4 : 0) + Math.floor(beat / 4)
      this.playBell(notes[idx % notes.length], when, 0.04)
    }
  }
}

WorldMusicEngine.prototype.scheduler = function () {
  if (!this.playing || this.userPaused) return
  const ctx = this.ctx
  const stepDur = this.stepDuration()
  while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    this.scheduleStep(this.currentStep, this.nextStepTime)
    this.nextStepTime += stepDur
    this.currentStep += 1
  }
}

WorldMusicEngine.prototype.restartTransportClock = function () {
  this.currentStep = 0
  if (this.ctx) {
    this.nextStepTime = this.ctx.currentTime + 0.05
  }
}

WorldMusicEngine.prototype.regenerateScore = function (moodOrSpec) {
  const seedText =
    moodOrSpec && typeof moodOrSpec === 'object'
      ? `${moodOrSpec.label || 'score'}:${moodOrSpec.bpm}:${moodOrSpec.scale}`
      : moodOrSpec
  this.score = generateScore(moodOrSpec, hashSeed(seedText || 'fun'))
  this.mood = this.score.params?.label || this.score.mood || 'score'
  this.restartTransportClock()
  this.emit()
  return this.score
}

WorldMusicEngine.prototype.startTransport = function () {
  if (this.timer) {
    this.playing = true
    this.fadeMusicTo(this.effectiveLevel(), FADE_SEC)
    this.emit()
    return
  }
  this.playing = true
  this.nextStepTime = this.ctx.currentTime + 0.05
  this.scheduler()
  this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS)
  this.fadeMusicTo(this.effectiveLevel(), FADE_SEC)
  this.emit()
}

WorldMusicEngine.prototype.stopTransport = function (fade) {
  this.playing = false
  if (this.timer) {
    clearInterval(this.timer)
    this.timer = null
  }
  this.fadeMusicTo(0, fade != null ? fade : FADE_SEC)
  this.emit()
}

WorldMusicEngine.prototype.setMood = function (mood) {
  this.mood = normalizeMood(mood)
  this.emit()
}

WorldMusicEngine.prototype.playFromSpec = function (specification) {
  this.regenerateScore(specification)
  this.play()
}

WorldMusicEngine.prototype.playForMood = function (mood) {
  // Always mint a new score so Explore never replays the same loop.
  this.regenerateScore(mood)
  this.play()
}

WorldMusicEngine.prototype.play = function () {
  this.userPaused = false
  writeBool(ENABLED_KEY, true)
  if (prefersReducedMotion()) {
    this.emit()
    return
  }
  this.resumeContext().then((ok) => {
    if (!ok || this.userPaused) {
      this.emit()
      return
    }
    if (this.muted) {
      this.emit()
      return
    }
    this.startTransport()
  })
}

WorldMusicEngine.prototype.pause = function () {
  this.userPaused = true
  writeBool(ENABLED_KEY, false)
  this.stopTransport(FADE_SEC)
  if (this._silentEl) {
    try {
      this._silentEl.pause()
    } catch {
      // ignore
    }
  }
}

WorldMusicEngine.prototype.togglePlay = function () {
  if (this.playing && !this.userPaused) this.pause()
  else this.play()
}

WorldMusicEngine.prototype.setMuted = function (muted) {
  this.muted = !!muted
  writeBool(MUTE_KEY, this.muted)
  if (!this.muted && this.playing && !this.userPaused) {
    this.resumeContext().then((ok) => {
      if (ok) this.fadeMusicTo(this.effectiveLevel(), 0.5)
      this.emit()
    })
    return
  }
  if (this.playing && !this.userPaused) {
    this.fadeMusicTo(this.effectiveLevel(), 0.5)
  }
  this.emit()
}

WorldMusicEngine.prototype.toggleMute = function () {
  this.setMuted(!this.muted)
}

let sharedEngine = null

export function getWorldMusicEngine() {
  if (!sharedEngine) sharedEngine = new WorldMusicEngine()
  return sharedEngine
}
