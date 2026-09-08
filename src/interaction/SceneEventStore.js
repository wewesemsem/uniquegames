/**
 * Stateful scene-event store.
 * Tracks interaction lifecycle: inactive → available → triggered → active → completed.
 * Prevents duplicate spawns and cleans up temporary procedural objects.
 */

import { POINTER_TRIGGERS } from '../world/InteractionSchema.js'
import {
  reactionLighting,
  reactionNeedsSpawn,
  reactionParticles,
  resolveReactionSpawns,
} from './ReactionResolver.js'

const COOLDOWN_MS = 900

export function createSceneEventStore() {
  let events = new Map()
  let objectIndex = new Map() // objectId → eventIds[]
  let targetIndex = new Map() // target selector → eventIds[]
  let spawns = []
  let effects = {
    lighting: null,
    particles: null,
    sound: null,
    objectFx: new Map(), // objectId → { animation, until, emissive }
  }
  let roomId = null
  let listeners = new Set()
  let multiCounts = new Map()
  let gazeProgress = new Map()
  let proximityLatched = new Set()
  let timersStarted = new Set()

  function emit() {
    for (const listener of listeners) listener()
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot() {
    return {
      roomId,
      spawns: spawns.slice(),
      effects: {
        lighting: effects.lighting,
        particles: effects.particles,
        sound: effects.sound,
        objectFx: Object.fromEntries(effects.objectFx),
      },
      events: [...events.values()].map((e) => ({
        id: e.spec.id,
        state: e.state,
        triggerCount: e.triggerCount,
      })),
    }
  }

  function resetRoom(nextRoomId, interactions, objects = []) {
    // Cleanup previous temporary spawns
    spawns = []
    effects = { lighting: null, particles: null, sound: null, objectFx: new Map() }
    events = new Map()
    objectIndex = new Map()
    targetIndex = new Map()
    multiCounts = new Map()
    gazeProgress = new Map()
    proximityLatched = new Set()
    timersStarted = new Set()
    roomId = nextRoomId

    const list = interactions?.events ?? []
    for (const spec of list) {
      events.set(spec.id, {
        spec,
        state: 'available',
        triggerCount: 0,
        activatedAt: 0,
        completesAt: 0,
        sourceObjectId: null,
      })
      const key = String(spec.target).toLowerCase()
      if (!targetIndex.has(key)) targetIndex.set(key, [])
      targetIndex.get(key).push(spec.id)
    }

    for (const object of objects) {
      const matched = (object.interactions ?? []).map((e) => e.id).filter((id) => events.has(id))
      if (matched.length) {
        objectIndex.set(object.id, matched)
        for (const id of matched) {
          const entry = events.get(id)
          if (entry && !entry.sourceObjectId) {
            entry.sourceObjectId = object.id
            entry.sourceObject = object
          }
        }
      }
    }

    // enter_room + timed will be kicked by the system component
    emit()
  }

  function setState(id, state) {
    const entry = events.get(id)
    if (!entry) return
    entry.state = state
  }

  function canTrigger(entry, now) {
    if (!entry) return false
    if (entry.state === 'inactive') return false
    if (entry.spec.once && (entry.state === 'completed' || entry.state === 'active' || entry.triggerCount > 0)) {
      return false
    }
    if (entry.state === 'active' && entry.spec.once) return false
    if (entry.lastTriggerAt && now - entry.lastTriggerAt < COOLDOWN_MS) return false
    if (entry.spec.trigger === 'after_event') {
      const prior = events.get(entry.spec.after_event)
      if (!prior || prior.state !== 'completed') return false
    }
    return true
  }

  function activate(eventId, { sourceObject = null, now = performance.now(), force = false } = {}) {
    const entry = events.get(eventId)
    if (!entry) return false
    if (!force && !canTrigger(entry, now)) return false

    const reaction = entry.spec.reaction
    const once = reaction.once !== undefined ? reaction.once : entry.spec.once
    entry.triggerCount += 1
    entry.lastTriggerAt = now
    entry.activatedAt = now
    entry.completesAt = now + (reaction.duration ?? 4) * 1000
    entry.state = 'active'
    if (sourceObject) {
      entry.sourceObject = sourceObject
      entry.sourceObjectId = sourceObject.id
    }

    // Effects
    const lighting = reactionLighting(reaction)
    if (lighting) {
      effects.lighting = { ...lighting, until: entry.completesAt }
    }
    const particles = reactionParticles(reaction)
    if (particles) {
      effects.particles = { kind: particles, until: entry.completesAt }
    }
    if (reaction.sound) {
      effects.sound = { id: reaction.sound, until: entry.completesAt }
    }

    // Spawns — dedupe by event id while active
    if (reactionNeedsSpawn(reaction)) {
      const existing = spawns.filter((s) => s.eventId === eventId && now < s.startedAt + s.duration * 1000)
      if (existing.length === 0) {
        const fresh = resolveReactionSpawns(entry.spec, entry.sourceObject || sourceObject, now)
        spawns = [...spawns, ...fresh]
      }
    } else if (entry.sourceObjectId || sourceObject?.id) {
      // In-place feedback for glow / flee / bloom / activate on the source mesh
      const oid = sourceObject?.id || entry.sourceObjectId
      effects.objectFx.set(oid, {
        animation: reaction.animation || 'glow_up',
        until: entry.completesAt,
        emissive: reaction.type === 'glow' || reaction.type === 'change_lighting' ? 0.7 : 0.35,
      })
    }

    // Chain
    if (reaction.chain && reaction.chain !== eventId) {
      queueMicrotask(() => activate(reaction.chain, { sourceObject: entry.sourceObject, now, force: false }))
    }

    if (once) {
      // Will flip to completed in tick()
    }

    emit()
    return true
  }

  function triggerByObject(objectId, triggerKind = 'click', context = {}) {
    const ids = objectIndex.get(objectId) ?? []
    let fired = false
    for (const id of ids) {
      const entry = events.get(id)
      if (!entry) continue
      const t = entry.spec.trigger
      const matches =
        t === triggerKind ||
        (POINTER_TRIGGERS.has(t) && POINTER_TRIGGERS.has(triggerKind)) ||
        (triggerKind === 'click' && POINTER_TRIGGERS.has(t))
      if (!matches) continue

      if (t === 'multi_interact') {
        const count = (multiCounts.get(id) || 0) + 1
        multiCounts.set(id, count)
        if (count < (entry.spec.multi_count || 2)) continue
        multiCounts.set(id, 0)
      }

      if (activate(id, context)) fired = true
    }
    return fired
  }

  function triggerByTarget(target, triggerKind = 'click', context = {}) {
    const key = String(target).toLowerCase()
    const ids = targetIndex.get(key) ?? []
    let fired = false
    for (const id of ids) {
      const entry = events.get(id)
      if (!entry) continue
      if (entry.spec.trigger !== triggerKind && !(POINTER_TRIGGERS.has(entry.spec.trigger) && POINTER_TRIGGERS.has(triggerKind))) {
        continue
      }
      if (activate(id, context)) fired = true
    }
    return fired
  }

  function triggerEnterRoom(context = {}) {
    let fired = false
    for (const entry of events.values()) {
      if (entry.spec.trigger !== 'enter_room') continue
      const delayMs = (entry.spec.delay || 0) * 1000
      if (delayMs > 0) {
        if (timersStarted.has(entry.spec.id)) continue
        timersStarted.add(entry.spec.id)
        setTimeout(() => activate(entry.spec.id, context), delayMs)
        fired = true
      } else if (activate(entry.spec.id, context)) {
        fired = true
      }
    }
    return fired
  }

  function startTimedEvents(context = {}) {
    for (const entry of events.values()) {
      if (entry.spec.trigger !== 'timed') continue
      if (timersStarted.has(entry.spec.id)) continue
      timersStarted.add(entry.spec.id)
      const delayMs = Math.max(100, (entry.spec.delay || 2) * 1000)
      setTimeout(() => activate(entry.spec.id, context), delayMs)
    }
  }

  function updateProximity(playerPos, objects, now = performance.now()) {
    if (!playerPos) return
    for (const object of objects) {
      const ids = objectIndex.get(object.id) ?? []
      if (!ids.length) continue
      const pos = object.position || [0, 0, 0]
      const dx = playerPos[0] - pos[0]
      const dy = (playerPos[1] ?? 0) - (pos[1] ?? 0)
      const dz = playerPos[2] - pos[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      for (const id of ids) {
        const entry = events.get(id)
        if (!entry) continue
        const t = entry.spec.trigger
        if (t !== 'proximity' && t !== 'approach') continue
        const radius = entry.spec.proximity || 4
        const key = `${id}:${object.id}`
        if (dist <= radius) {
          if (!proximityLatched.has(key)) {
            proximityLatched.add(key)
            activate(id, { sourceObject: object, now })
          }
        } else if (!entry.spec.once) {
          proximityLatched.delete(key)
        }
      }
    }
  }

  function updateGaze(targetObjectId, dt, objects, now = performance.now()) {
    for (const [id, entry] of events) {
      if (entry.spec.trigger !== 'gaze') continue
      const sourceId = entry.sourceObjectId
      const ids = sourceId ? [sourceId] : [...objectIndex.entries()].filter(([, list]) => list.includes(id)).map(([oid]) => oid)
      const looking = targetObjectId && ids.includes(targetObjectId)
      if (looking) {
        const next = (gazeProgress.get(id) || 0) + dt
        gazeProgress.set(id, next)
        if (next >= (entry.spec.gaze_duration || 1.2)) {
          gazeProgress.set(id, 0)
          const obj = objects.find((o) => o.id === targetObjectId)
          activate(id, { sourceObject: obj, now })
        }
      } else {
        gazeProgress.set(id, 0)
      }
    }
  }

  function tick(now = performance.now()) {
    let changed = false
    for (const entry of events.values()) {
      if (entry.state === 'active' && entry.completesAt && now >= entry.completesAt) {
        entry.state = entry.spec.once || entry.spec.reaction?.once ? 'completed' : 'available'
        changed = true
      }
    }
    const before = spawns.length
    spawns = spawns.filter((s) => now < s.startedAt + (s.duration + 1.5) * 1000)
    if (spawns.length !== before) changed = true

    if (effects.lighting && now > effects.lighting.until) {
      effects.lighting = null
      changed = true
    }
    if (effects.particles && now > effects.particles.until) {
      effects.particles = null
      changed = true
    }
    if (effects.sound && now > effects.sound.until) {
      effects.sound = null
      changed = true
    }
    for (const [oid, fx] of effects.objectFx) {
      if (now > fx.until) {
        effects.objectFx.delete(oid)
        changed = true
      }
    }

    if (changed) emit()
  }

  function getEventsForObject(objectId) {
    return (objectIndex.get(objectId) ?? []).map((id) => events.get(id)?.spec).filter(Boolean)
  }

  function getEventState(eventId) {
    return events.get(eventId)?.state ?? 'inactive'
  }

  function clear() {
    resetRoom(null, { events: [] }, [])
  }

  return {
    subscribe,
    getSnapshot,
    resetRoom,
    activate,
    triggerByObject,
    triggerByTarget,
    triggerEnterRoom,
    startTimedEvents,
    updateProximity,
    updateGaze,
    tick,
    getEventsForObject,
    getEventState,
    clear,
    /** test helpers */
    _debug: () => ({ events, spawns, effects, objectIndex }),
  }
}

export const sceneEventStore = createSceneEventStore()
