import { useSyncExternalStore } from 'react'
import { ApiError } from '../api/worldApi.js'
import { assetResolver } from '../assets/AssetResolver.js'
import { environmentStore } from '../navigation/EnvironmentManager.jsx'
import { directWorld } from './WorldDirector.js'
import { buildWorld, ensureThreeRooms } from './WorldBuilder.js'
import { parseWorldSpecification } from './WorldSpecification.js'

const idleSnapshot = {
  prompt: '',
  status: 'idle',
  message: '',
  theme: null,
  specification: null,
  generationRequests: [],
  director: null,
  notice: null,
  models: null,
  generation: null,
  error: null,
  retryAfter: null,
  retryUntil: null,
  pendingRooms: [],
  readyRoomCount: 0,
  totalRoomCount: 0,
}

const IN_FLIGHT = new Set(['submitting', 'processing', 'resolving', 'generating', 'loading'])

const WAIT_BEATS = [
  'Building your world...',
  'Give us a moment...',
  'Almost done...',
  'Still working — this can take a minute...',
]

const IMAGE_WAIT_BEATS = [
  'Painting high-quality 360° skies...',
  'This usually takes 1–2 minutes...',
  'Still rendering panoramas — hang tight...',
  'Almost there — HQ images take a bit...',
]

const MORE_BEATS = [
  "You're in. More rooms are still painting in the background...",
  'Almost done with the other skies...',
  'Hang tight — finishing rooms 2 and 3...',
]

function shortFailureHint(reason) {
  const text = String(reason || '')
  if (/help\.openai\.com|server had an error|request ID req_/i.test(text)) {
    return 'the image service was temporarily unavailable'
  }
  if (text.length > 140) {
    return 'the image service failed'
  }
  return text
}

function readyMessage(rooms, generation, environmentMode) {
  const proceduralCount = rooms.filter((room) => room.procedural).length
  const generatedCount = rooms.filter(
    (room) => room.panorama?.source === 'generated' || room.panorama?.source === 'generated-cache'
  ).length
  const panoramaFallbacks = rooms.filter((room) => room.panorama?.source === 'fallback').length
  const failureHint = shortFailureHint(generation?.reasons?.[0])

  if (environmentMode === 'IMAGE_GENERATION' || generatedCount > 0) {
    if (generatedCount) {
      const total = rooms.length
      if (generatedCount < total && panoramaFallbacks) {
        return `World ready. Loaded ${generatedCount} of ${total} generated 360° skies; other rooms used placeholders.`
      }
      return `World ready. Loaded ${generatedCount} generated 360° environment${generatedCount === 1 ? '' : 's'}.`
    }
    if (panoramaFallbacks || generation?.missing) {
      return failureHint
        ? `World ready, but panorama generation failed (${failureHint}). Using placeholder skies.`
        : 'World ready, but panorama generation failed. Using placeholder skies.'
    }
  }

  if (environmentMode === 'PROCEDURAL_360' || proceduralCount > 0) {
    return `World ready. Procedural 360° environment (${proceduralCount || rooms.length} room${
      (proceduralCount || rooms.length) === 1 ? '' : 's'
    }).`
  }

  if (generatedCount) {
    return `World ready. Loaded ${generatedCount} generated 360° environment${generatedCount === 1 ? '' : 's'}.`
  }
  if (panoramaFallbacks || generation?.missing) {
    return failureHint
      ? `World ready, but panorama generation failed (${failureHint}). Using placeholder skies.`
      : 'World ready, but panorama generation failed. Using placeholder skies.'
  }
  return 'World ready.'
}

function createWorldStore() {
  let snapshot = { ...idleSnapshot }
  const listeners = new Set()
  let requestToken = 0
  let requestLock = false
  let abortController = null
  let beatTimer = 0
  let beatIndex = 0
  let beatList = WAIT_BEATS

  function emit(partial) {
    snapshot = { ...snapshot, ...partial }
    for (const listener of listeners) {
      listener()
    }
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot() {
    return snapshot
  }

  function stopBeats() {
    if (beatTimer) {
      clearInterval(beatTimer)
      beatTimer = 0
    }
  }

  function startBeats(list) {
    stopBeats()
    beatList = list
    beatIndex = 0
    emit({ message: beatList[0] })
    beatTimer = setInterval(() => {
      beatIndex = (beatIndex + 1) % beatList.length
      emit({ message: beatList[beatIndex] })
    }, 4200)
  }

  function pendingFromSpec(specification, readyIds) {
    if (!specification?.rooms?.length) {
      return []
    }
    return ensureThreeRooms(specification)
      .filter((room) => room?.id && !readyIds.has(room.id))
      .map((room) => ({ id: room.id, name: room.name || room.id }))
  }

  function revealRooms(specification, rooms) {
    const readyIds = new Set((rooms ?? []).map((room) => room?.spec?.id).filter(Boolean))
    const built = buildWorld(specification, { rooms })
    // Fully apply rooms that have finished resolving; other rooms only get
    // name/hotspot updates so labels update while room2–3 continue in the background.
    const environments = {}
    for (const [id, env] of Object.entries(built.environments)) {
      environments[id] = readyIds.has(id)
        ? { ...env, pending: false }
        : {
            id: env.id,
            name: env.name,
            hotspots: env.hotspots,
            pending: true,
            panorama: null,
            procedural: null,
            objects: [],
          }
    }

    const pendingRooms = pendingFromSpec(specification, readyIds)
    emit({
      pendingRooms,
      readyRoomCount: readyIds.size,
      totalRoomCount: specification?.rooms?.length
        ? ensureThreeRooms(specification).length
        : pendingRooms.length + readyIds.size,
    })

    if (snapshot.status === 'generating' || snapshot.status === 'ready') {
      environmentStore.patchWorld(environments)
      return
    }
    environmentStore.replaceWorld(environments, built.startId)
  }

  async function requestWorld(prompt, options = {}) {
    const text = String(prompt ?? '').trim()
    const environmentMode = options.environmentMode || 'PROCEDURAL_360'
    const usingImages = environmentMode === 'IMAGE_GENERATION'
    if (!text) {
      emit({ status: 'error', error: 'Describe a world to explore.', message: '', retryAfter: null, retryUntil: null })
      return
    }

    if (requestLock || IN_FLIGHT.has(snapshot.status)) {
      return
    }

    requestLock = true
    abortController?.abort()
    abortController = new AbortController()
    const signal = abortController.signal
    const token = ++requestToken
    stopBeats()
    const beats = usingImages ? IMAGE_WAIT_BEATS : WAIT_BEATS
    emit({
      prompt: text,
      status: 'submitting',
      message: beats[0],
      error: null,
      notice: null,
      generationRequests: [],
      retryAfter: null,
      retryUntil: null,
      models: { ...(snapshot.models ?? {}), environmentMode },
      pendingRooms: [],
      readyRoomCount: 0,
      totalRoomCount: 0,
    })
    startBeats(beats)

    let specification = null
    const rooms = []
    let revealed = false

    try {
      const directed = await directWorld(text, {
        signal,
        environmentMode,
        onEvent(event) {
          if (token !== requestToken) {
            return
          }
          if (event.type === 'status' && event.message && !revealed) {
            return
          }
          if (event.type === 'world') {
            specification = parseWorldSpecification(event.specification)
            emit({
              status: 'processing',
              specification,
              theme: specification.theme,
              director: event.director ?? null,
              notice: event.notice ?? null,
              models: event.models ?? null,
            })
          }
          if (event.type === 'room' && event.room) {
            rooms[event.index ?? rooms.length] = event.room
            if (!specification) {
              return
            }
            const readyRooms = rooms.filter(Boolean)
            revealRooms(specification, readyRooms)
            if (!revealed) {
              revealed = true
              const pending = pendingFromSpec(specification, new Set(readyRooms.map((r) => r.spec?.id).filter(Boolean)))
              const pendingLabel =
                pending.length === 0
                  ? MORE_BEATS[0]
                  : pending.length === 1
                    ? `You're in. Still painting ${pending[0].name}…`
                    : `You're in. Still painting ${pending.length} more rooms…`
              startBeats([pendingLabel, ...MORE_BEATS.slice(1)])
              emit({
                status: 'generating',
                message: pendingLabel,
                pendingRooms: pending,
                readyRoomCount: readyRooms.length,
                totalRoomCount: specification.rooms.length,
              })
            } else {
              const pending = pendingFromSpec(specification, new Set(readyRooms.map((r) => r.spec?.id).filter(Boolean)))
              const pendingLabel =
                pending.length === 0
                  ? 'Almost done…'
                  : pending.length === 1
                    ? `Still painting ${pending[0].name} in the background…`
                    : `Still painting ${pending.map((r) => r.name).join(' & ')} in the background…`
              emit({
                message: pendingLabel,
                pendingRooms: pending,
                readyRoomCount: readyRooms.length,
                totalRoomCount: specification.rooms.length,
              })
            }
          }
          if (event.type === 'done') {
            emit({ generation: event.generation ?? snapshot.generation })
          }
        },
      })
      if (token !== requestToken) {
        return
      }

      if (!specification) {
        specification = parseWorldSpecification(directed.specification)
        emit({
          specification,
          theme: specification.theme,
          director: directed.director ?? null,
          notice: directed.notice ?? snapshot.notice,
          models: directed.models ?? null,
          generation: directed.generation ?? null,
        })
      }

      const resolved =
        rooms.filter(Boolean).length > 0
          ? { rooms: rooms.filter(Boolean) }
          : Array.isArray(directed.resolved?.rooms) && directed.resolved.rooms.length > 0
            ? directed.resolved
            : await assetResolver.resolveWorld(specification)

      if (token !== requestToken) {
        return
      }

      if (!revealed) {
        emit({
          status: 'loading',
          message: 'Loading environment...',
          generationRequests: resolved.generationRequests,
        })
        revealRooms(specification, resolved.rooms ?? [])
      } else {
        revealRooms(specification, resolved.rooms ?? [])
      }

      if (token !== requestToken) {
        return
      }

      stopBeats()
      emit({
        status: 'ready',
        message: readyMessage(
          resolved.rooms ?? [],
          directed.generation ?? snapshot.generation,
          directed.environmentMode ?? directed.models?.environmentMode ?? snapshot.models?.environmentMode
        ),
        error: null,
        generation: directed.generation ?? snapshot.generation,
        models: directed.models ?? snapshot.models,
        pendingRooms: [],
        readyRoomCount: resolved.rooms?.length ?? snapshot.totalRoomCount,
        totalRoomCount: resolved.rooms?.length ?? snapshot.totalRoomCount,
      })
    } catch (error) {
      if (token !== requestToken) {
        return
      }
      stopBeats()
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        emit({
          status: 'error',
          message: '',
          error: 'That took too long. Please try again.',
          retryAfter: null,
          retryUntil: null,
          pendingRooms: [],
        })
        return
      }
      const retryAfter = error instanceof ApiError ? error.retryAfter : null
      emit({
        status: 'error',
        message: '',
        error:
          error instanceof ApiError && error.status === 429
            ? "You're sending requests too quickly. Please wait a moment."
            : error instanceof Error
              ? error.message
              : 'Could not build that world.',
        retryAfter,
        retryUntil: retryAfter ? Date.now() + retryAfter * 1000 : null,
        pendingRooms: [],
      })
    } finally {
      if (token === requestToken) {
        requestLock = false
      }
    }
  }

  return {
    subscribe,
    getSnapshot,
    requestWorld,
  }
}

export const worldStore = createWorldStore()

export function useWorldState() {
  return useSyncExternalStore(worldStore.subscribe, worldStore.getSnapshot)
}
