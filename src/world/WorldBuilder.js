/**
 * Turns a validated World Specification + resolved assets into the
 * environment map the existing renderer already understands.
 *
 * Pipeline: composition intent → SceneComposer → procedural objects
 * → Three.js meshes. LLM landmarks merge with composed fill.
 */

import { resolveProceduralObject } from '../procedural/objects/ObjectResolver.js'
import { isLandmarkType } from '../procedural/objects/types.js'
import { resolveAssetUrl } from '../api/apiBase.js'
import { composeRoom, mergeComposedObjects, mergeSceneConfigs } from './SceneComposer.js'
import { matchObjectAnimation } from './AnimationSchema.js'
import { matchObjectInteractions, objectIsInteractive, sanitizeInteractions } from './InteractionSchema.js'
import { applyStyleToNeed, hashSeed, inferStyleIntent, styleContextText } from './StyleIntent.js'

const OBJECT_SLOTS = [
  [-1.6, 0, -2.8],
  [1.7, 0, -3.1],
  [0, 0, -4.4],
  [-2.6, 0, -4.6],
  [2.6, 0, -4.6],
  [0.2, 0, -6],
  [-4, 0, -3],
  [4, 0, -3.5],
  [-3.5, 0, -7],
  [3.5, 0, -7],
  [0, 0, -9],
  [-6, 0, -5],
  [6, 0, -5],
  [-2, 0, -11],
  [2, 0, -11],
  [8, 0, -8],
  [-8, 0, -8],
  [0, 0, -14],
  [5, 0, -12],
  [-5, 0, -12],
]

const HOTSPOT_SLOTS = [
  [-2.2, 1.1, -3.5],
  [2.2, 1.1, -3.5],
  [0, 1.15, -5.4],
  [-3.2, 1.1, -5],
]

const MAX_SCENE_OBJECTS = 48

function hashColor(text) {
  let hash = 0
  for (const char of String(text)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue} 42% 52%)`
}

function uniqueId(used, base) {
  let id = base
  let n = 2
  while (used.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  used.add(id)
  return id
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function sanitizePosition(pos, type, index) {
  if (Array.isArray(pos) && pos.length === 3 && pos.every((v) => Number.isFinite(v))) {
    return [clamp(pos[0], -40, 40), clamp(pos[1], -5, 30), clamp(pos[2], -50, 20)]
  }
  const slot = OBJECT_SLOTS[index % OBJECT_SLOTS.length]
  if (isLandmarkType(type)) {
    return [slot[0] * 1.4, 0, slot[2] * 1.2 - 2]
  }
  return [...slot]
}

function sanitizeScale(scale, type) {
  if (typeof scale === 'number' && Number.isFinite(scale)) {
    const s = clamp(scale, 0.25, 14)
    return [s, s, s]
  }
  if (Array.isArray(scale) && scale.length === 3 && scale.every((v) => Number.isFinite(v))) {
    return scale.map((v) => clamp(v, 0.25, 14))
  }
  if (type === 'pyramid') return [4.5, 4.5, 4.5]
  if (type === 'temple') return [1.4, 1.4, 1.4]
  if (type === 'planet') return [2.2, 2.2, 2.2]
  if (type === 'space_station') return [1.3, 1.3, 1.3]
  if (type === 'desert_dune') return [2.5, 2.5, 2.5]
  if (type === 'obelisk') return [1.1, 1.1, 1.1]
  if (type === 'giant') return [2.8, 2.8, 2.8]
  if (type === 'large') return [1.6, 1.6, 1.6]
  return [1, 1, 1]
}

function sanitizeRotation(rot) {
  if (Array.isArray(rot) && rot.length === 3 && rot.every((v) => Number.isFinite(v))) {
    return rot.map((v) => clamp(v, -Math.PI * 2, Math.PI * 2))
  }
  return [0, 0, 0]
}

export function ensureThreeRooms(specification) {
  const rooms = specification.rooms.slice(0, 3).map((room, index) => ({
    ...room,
    id: room.id || `room${index + 1}`,
  }))
  while (rooms.length < 3) {
    const index = rooms.length
    const seed = rooms[0]
    rooms.push({
      id: `room${index + 1}`,
      name: `${specification.theme} ${index + 1}`,
      environment: seed?.environment ?? {
        type: 'panorama',
        description: specification.description,
        tags: [specification.theme],
      },
      composition: seed?.composition,
      objects: [],
      hotspots: [],
    })
  }
  return rooms
}

function autoHotspots(roomIds, index) {
  const hotspots = []
  if (index > 0) {
    hotspots.push({
      id: `to-${roomIds[index - 1]}`,
      label: 'Previous',
      targetRoom: roomIds[index - 1],
      description: 'Go to the previous room',
    })
  }
  if (index < roomIds.length - 1) {
    hotspots.push({
      id: `to-${roomIds[index + 1]}`,
      label: 'Next',
      targetRoom: roomIds[index + 1],
      description: 'Go to the next room',
    })
  }
  return hotspots
}

function buildObjects(roomId, resolvedObjects, animation = null, interactions = null) {
  const used = new Set()

  return resolvedObjects.slice(0, MAX_SCENE_OBJECTS).map((entry, index) => {
    const need = entry.need ?? entry
    const resolved = resolveProceduralObject(need)
    const type = resolved.type
    const id = uniqueId(used, `${roomId}-${need.type || type}`)
    const baseParams = { ...(need.params ?? {}) }
    const params = resolved.descriptor
      ? { ...baseParams, descriptor: resolved.descriptor }
      : Object.keys(baseParams).length
        ? baseParams
        : undefined
    const styledColor =
      need.color ||
      (Array.isArray(need.params?.colors) && need.params.colors.length
        ? need.params.colors[index % need.params.colors.length]
        : null)
    const object = {
      id,
      type,
      kind: 'procedural',
      position: sanitizePosition(need.position, type, index),
      scale: sanitizeScale(need.scale, type === 'generic' ? need.appearance?.scale_hint || type : type),
      rotation: sanitizeRotation(need.rotation),
      material: need.material,
      detail: need.detail ?? (isLandmarkType(type) ? 'high' : 'medium'),
      color: entry.asset?.color ?? styledColor ?? hashColor(need.description || need.name || type),
      params,
      form: need.form || resolved.descriptor?.form,
      category: need.category || resolved.descriptor?.category,
      appearance: need.appearance || resolved.descriptor?.appearance,
      tags: need.tags,
      interactive: false,
      interactions: [],
    }
    object.animation = matchObjectAnimation(object, animation)

    const matched = matchObjectInteractions(object, interactions)
    if (matched.length) {
      // Bind every matching landmark so each interactive prop is discoverable.
      // once:false (default) lets the reaction replay after it completes.
      object.interactions = matched
      object.interactive = objectIsInteractive(object, { events: matched }) || matched.length > 0
    } else if (index === 0 && (type === 'box' || type === 'sphere' || type === 'crate')) {
      object.interactive = true
    }
    return object
  })
}

function buildHotspots(room, roomIds, index) {
  const valid = new Set(roomIds)
  const semantic = (room.hotspots ?? []).filter((hotspot) => valid.has(hotspot.targetRoom))
  const source = semantic.length > 0 ? semantic : autoHotspots(roomIds, index)
  const used = new Set()
  const names = Object.fromEntries(roomIds.map((id, i) => [id, `Room ${i + 1}`]))

  return source.slice(0, HOTSPOT_SLOTS.length).map((hotspot, hotspotIndex) => ({
    id: uniqueId(used, hotspot.id || `hotspot-${hotspot.targetRoom}`),
    position: HOTSPOT_SLOTS[hotspotIndex],
    target: hotspot.targetRoom,
    label: hotspot.label || names[hotspot.targetRoom] || hotspot.targetRoom,
  }))
}

function landmarkEntriesForRoom(room, resolvedRoom) {
  if (Array.isArray(resolvedRoom?.objects) && resolvedRoom.objects.length > 0) {
    return resolvedRoom.objects
  }
  return (room.objects ?? []).map((need) => ({ need, asset: null }))
}

export function buildWorld(specification, resolved) {
  const specRooms = ensureThreeRooms(specification)
  const resolvedById = new Map((resolved.rooms ?? []).map((entry) => [entry.spec.id, entry]))
  const roomIds = specRooms.map((room) => room.id)
  const environments = {}
  const prompt = specification.prompt || specification.description || specification.theme || ''
  const style = inferStyleIntent(styleContextText([prompt, specification.theme, specification.description]))
  const baseSeed =
    typeof specification.seed === 'number'
      ? specification.seed >>> 0
      : hashSeed(`${prompt}:${specification.theme}:${specification.description}:${specification.entropy ?? ''}`)

  specRooms.forEach((room, index) => {
    const resolvedRoom = resolvedById.get(room.id) ?? resolved.rooms?.[index]
    const landmarks = landmarkEntriesForRoom(room, resolvedRoom).map((entry, landmarkIndex) => {
      const need = applyStyleToNeed(entry.need ?? entry, style, baseSeed + index * 997, landmarkIndex)
      return { ...entry, need }
    })
    const composed = composeRoom(room, specification.theme, {
      maxFill: landmarks.length >= 10 ? 24 : 40,
      seed: baseSeed + index * 9973,
      prompt,
      style,
      entropy: specification.entropy,
    })
    const mergedNeeds = mergeComposedObjects(
      landmarks.map((entry) => entry.need ?? entry),
      composed.objects
    )
    const mergedEntries = mergedNeeds.map((need) => {
      const fromLandmark = landmarks.find((entry) => (entry.need ?? entry) === need)
      return fromLandmark ?? { need, asset: null }
    })

    const panoramaUrl = resolveAssetUrl(resolvedRoom?.panorama?.url ?? null)
    environments[room.id] = {
      id: room.id,
      name: room.name,
      panorama: panoramaUrl,
      // Keep procedural sky only when there is no AI/image panorama to show.
      procedural: panoramaUrl ? null : mergeSceneConfigs(resolvedRoom?.procedural ?? null, composed.scene),
      composition: composed.composition,
      animation: composed.animation,
      interactions: sanitizeInteractions(composed.interactions),
      objects: buildObjects(room.id, mergedEntries, composed.animation, composed.interactions),
      hotspots: buildHotspots({ ...room, hotspots: room.hotspots }, roomIds, index),
    }
  })

  return {
    environments,
    startId: specRooms[0].id,
  }
}
