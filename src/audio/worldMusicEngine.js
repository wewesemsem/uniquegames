/**
 * Procedural world score — original Web Audio synthesis only.
 * Each Explore regenerates a unique composition for the chosen mood.
 * No samples or third-party audio assets.
 */

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

const N = {
  C2: 65.41,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  Fs2: 92.5,
  G2: 98.0,
  Ab2: 103.83,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185.0,
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  Eb4: 311.13,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  Ab4: 415.3,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  Eb5: 622.25,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
}

const PRESETS = {
  fun: { bpmMin: 108, bpmMax: 128, level: 0.22 },
  horror: { bpmMin: 58, bpmMax: 78, level: 0.18 },
  mellow: { bpmMin: 68, bpmMax: 88, level: 0.2 },
}

const SCALES = {
  fun: {
    bass: [N.G2, N.A2, N.B2, N.C3, N.D3, N.E3],
    chordRoots: [
      [N.G3, N.B3, N.D4],
      [N.C3, N.E3, N.G3],
      [N.D3, N.Fs3, N.A3],
      [N.E3, N.G3, N.B3],
      [N.A3, N.C4, N.E4],
    ],
    melody: [N.G3, N.A3, N.B3, N.C4, N.D4, N.E4, N.Fs4, N.G4, N.A4, N.B4, N.C5, N.D5, N.E5, N.G5],
    accents: [N.D4, N.E4, N.G4, N.A4, N.B4, N.D5, N.E5],
  },
  horror: {
    bass: [N.C2, N.D2, N.Eb2, N.F2, N.Fs2, N.Ab2, N.Bb2],
    chordRoots: [
      [N.D2, N.Ab2],
      [N.Eb2, N.A2],
      [N.C2, N.Fs2],
      [N.Bb2, N.E3],
      [N.F2, N.B2],
      [N.Ab2, N.D3],
    ],
    melody: [N.D3, N.Eb3, N.F3, N.Fs3, N.Ab3, N.A3, N.Bb3, N.B3, N.C4, N.D4, N.Eb4, N.Fs4, N.Ab4],
    accents: [N.Eb3, N.Fs3, N.Ab3, N.Bb3, N.E4, N.Fs4, N.Ab4],
  },
  mellow: {
    bass: [N.A2, N.C3, N.D3, N.E2, N.F2, N.G2],
    chordRoots: [
      [N.A3, N.C4, N.E4],
      [N.F3, N.A3, N.C4],
      [N.G3, N.B3, N.D4],
      [N.E3, N.G3, N.B3],
      [N.D3, N.F3, N.A3],
    ],
    melody: [N.A3, N.B3, N.C4, N.D4, N.E4, N.F4, N.G4, N.A4, N.B4, N.C5, N.D5, N.E5],
    accents: [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5],
  },
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
    // Occasional rest after a hit for phrasing
    if (chance(rng, 0.35) && step + 1 < LOOP_STEPS) {
      steps[step + 1] = null
    }
  }
  return steps
}

/**
 * Build a fresh loop for the mood. Pure + seeded so tests can assert variety.
 */
export function generateScore(mood, seed = Date.now()) {
  const normalized = normalizeMood(mood)
  const preset = PRESETS[normalized]
  const palette = SCALES[normalized]
  const rng = createRng(seed >>> 0)
  const bpm = randInt(rng, preset.bpmMin, preset.bpmMax)

  const chords = []
  const bass = []
  const bassOff = []
  for (let bar = 0; bar < BARS_PER_LOOP; bar += 1) {
    const chord = pick(rng, palette.chordRoots).slice()
    if (normalized === 'horror' && chord.length === 2) {
      chord.push(chord[1] * (chance(rng, 0.5) ? 1.498 : 1.414))
    }
    chords.push(chord)
    bass.push(pick(rng, palette.bass))
    bassOff.push(pick(rng, palette.bass))
  }

  const density = normalized === 'fun' ? 0.28 : normalized === 'horror' ? 0.12 : 0.14
  const melody = buildMelody(rng, palette.melody, density)
  const accents = Array.from({ length: BARS_PER_LOOP }, () => pick(rng, palette.accents))
  const bells = Array.from({ length: BARS_PER_LOOP }, () => pick(rng, palette.accents))

  const kickBeats =
    normalized === 'fun'
      ? [0, 8]
      : normalized === 'horror'
        ? chance(rng, 0.5)
          ? [0, 10]
          : [0, 9]
        : chance(rng, 0.4)
          ? [0]
          : []

  const rimBeats = normalized === 'fun' ? [4, 12] : normalized === 'horror' && chance(rng, 0.4) ? [8] : []
  const shakerEvery = normalized === 'fun' ? 2 : normalized === 'mellow' ? 8 : chance(rng, 0.5) ? 4 : 0
  const pizzBeats =
    normalized === 'fun'
      ? [6, 14]
      : normalized === 'horror'
        ? [4, 12]
        : chance(rng, 0.5)
          ? [8]
          : []
  const bellBeats =
    normalized === 'fun' ? [3, 11] : normalized === 'horror' ? [7, 15] : [8]

  const flourish =
    normalized === 'fun'
      ? {
          bars: [6, 7],
          beats: [2, 5, 9, 13],
          notes: Array.from({ length: 8 }, () => pick(rng, palette.melody.slice(-6))),
        }
      : null

  return {
    id: seed >>> 0,
    mood: normalized,
    bpm,
    level: preset.level,
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
  }
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
    bpm: this.score?.bpm || PRESETS[this.mood].bpmMin,
    level: this.score?.level || PRESETS[this.mood].level,
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
    filter.frequency.setValueAtTime(this.mood === 'horror' ? 700 : 1200, when)
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
  filter.frequency.setValueAtTime(this.mood === 'horror' ? 1800 : 6000, when)
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
  const mood = score.mood

  if (beat === 0) {
    const chord = score.chords[bar]
    if (mood === 'horror') {
      this.playDrone(chord[0], when, stepDur * STEPS_PER_BAR, 0.045)
      this.playPad(chord, when, stepDur * STEPS_PER_BAR, 0.028)
    } else {
      const padGain = mood === 'mellow' ? 0.036 : 0.032
      this.playPad(chord, when, stepDur * STEPS_PER_BAR, padGain)
    }
  }

  if (mood === 'fun') {
    if (beat === 0 || beat === 8) this.playBass(score.bass[bar], when, 0.11)
    if (beat === 4 || beat === 12) this.playBass(score.bassOff[bar], when, 0.07)
  } else if (mood === 'mellow') {
    if (beat === 0) this.playBass(score.bass[bar], when, 0.08)
  } else if (beat === 0 && bar % 4 === 0) {
    this.playBass(score.bass[bar], when, 0.12)
  }

  if (score.kickBeats.includes(beat)) {
    this.playKick(when, mood === 'horror' ? 0.09 : 0.07)
  }
  if (score.rimBeats.includes(beat)) this.playRim(when)
  if (score.shakerEvery > 0 && beat % score.shakerEvery === 0) {
    const shakerGain = mood === 'fun' ? 0.028 : mood === 'horror' ? 0.018 : 0.012
    this.playShaker(when, shakerGain)
  }

  const mel = score.melody[step % LOOP_STEPS]
  if (mel) {
    const gain = mood === 'fun' ? 0.07 : mood === 'horror' ? 0.04 : 0.045
    if (mood === 'horror') this.playPizz(mel, when, gain)
    else this.playPluck(mel, when, gain)
  }

  if (score.pizzBeats.includes(beat)) {
    this.playPizz(score.accents[bar], when, mood === 'horror' ? 0.035 : 0.04)
  }
  if (score.bellBeats.includes(beat)) {
    this.playBell(score.bells[bar], when, mood === 'mellow' ? 0.03 : 0.028)
  }

  if (score.flourish && loopCycle % 2 === 1) {
    const { bars, beats, notes } = score.flourish
    if (bars.includes(bar) && beats.includes(beat)) {
      const idx = (bar === bars[1] ? 4 : 0) + Math.floor(beat / 4)
      this.playBell(notes[idx % notes.length], when, 0.045)
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

WorldMusicEngine.prototype.regenerateScore = function (moodText) {
  const mood = normalizeMood(moodText ?? this.mood)
  this.mood = mood
  this.score = generateScore(mood, hashSeed(moodText || mood))
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
