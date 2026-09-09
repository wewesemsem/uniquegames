import { useSyncExternalStore } from 'react'
import { DEFAULT_ENVIRONMENT_ID, environments } from '../data/environments.js'
import { inputManager } from '../input/InputManager.js'
import { interactionManager } from '../interaction/InteractionManager.js'

const FADE_MS = 280

function cloneEnvironments(map) {
  return { ...map }
}

/**
 * Module store so HTML overlay and the R3F canvas share environment state
 * without a context bridge. Same pattern as InputManager.
 *
 * Static catalog rooms are the default. replaceWorld() swaps in a
 * director-built map without a page reload.
 */
function createEnvironmentStore() {
  let worldMap = cloneEnvironments(environments)
  let snapshot = {
    currentId: DEFAULT_ENVIRONMENT_ID,
    current: worldMap[DEFAULT_ENVIRONMENT_ID],
    rooms: Object.values(worldMap),
    status: 'loading',
    error: null,
    fade: 1,
    transitioning: true,
  }
  const listeners = new Set()
  let pendingId = null
  let fadeToken = 0

  function emit(partial) {
    snapshot = { ...snapshot, ...partial, rooms: Object.values(worldMap) }
    for (const listener of listeners) {
      listener()
    }
  }

  function getEnvironment(id) {
    return worldMap[id] ?? null
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot() {
    return snapshot
  }

  function animateFade(from, to, onDone) {
    const token = ++fadeToken
    const started = performance.now()
    emit({ fade: from })

    function frame(now) {
      if (token !== fadeToken) {
        return
      }
      const t = Math.min(1, (now - started) / FADE_MS)
      emit({ fade: from + (to - from) * t })
      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        onDone?.()
      }
    }

    requestAnimationFrame(frame)
  }

  function beginLoad(id) {
    const env = getEnvironment(id)
    pendingId = null
    interactionManager.clearSelection()
    if (!env) {
      emit({
        currentId: id,
        current: null,
        status: 'error',
        error: `Unknown environment "${id}".`,
        transitioning: true,
      })
      finishReady()
      return
    }
    emit({
      currentId: id,
      current: env,
      status: 'loading',
      error: null,
      transitioning: true,
    })
  }

  function finishReady() {
    animateFade(snapshot.fade, 0, () => {
      emit({ transitioning: false, fade: 0 })
      if (pendingId && pendingId !== snapshot.currentId) {
        navigateTo(pendingId)
      }
    })
  }

  function navigateTo(id) {
    const env = getEnvironment(id)
    if (!env) {
      emit({ error: `Unknown environment "${id}".`, status: snapshot.current ? snapshot.status : 'error' })
      return
    }

    if (env.pending) {
      emit({
        error: `${env.name ?? id} is still rendering.`,
        status: snapshot.current ? snapshot.status : 'error',
      })
      return
    }

    if (snapshot.transitioning) {
      pendingId = id
      return
    }

    if (id === snapshot.currentId && snapshot.status === 'ready') {
      return
    }

    emit({ transitioning: true, error: null })
    animateFade(snapshot.fade, 1, () => beginLoad(id))
  }

  function roomHasContent(env) {
    return Boolean(env?.procedural || env?.panorama || (env?.objects?.length ?? 0) > 0)
  }

  function pendingStub(env) {
    return {
      id: env.id,
      name: env.name,
      hotspots: env.hotspots ?? [],
      pending: true,
      panorama: null,
      procedural: null,
      objects: [],
    }
  }

  function mergeRoom(previous, next) {
    if (!next) {
      return previous
    }
    // Explicit pending stubs must win — otherwise old catalog panoramas keep
    // room2/room3 looking "ready" while AI images are still painting.
    if (next.pending) {
      return pendingStub(next)
    }
    // Keep an already-ready room when a later partial build only has a name stub.
    // Stops room2/3 from being blanked while room1 is revealed first.
    if (previous && !previous.pending && roomHasContent(previous) && !roomHasContent(next)) {
      return {
        ...previous,
        name: next.name ?? previous.name,
        hotspots: next.hotspots ?? previous.hotspots,
        pending: false,
      }
    }
    return { ...previous, ...next, pending: false }
  }

  function applyWorldMap(map, { resetGenerated = false } = {}) {
    // Keep the playground room frozen; only replace generated rooms (room1–room3).
    const next = resetGenerated
      ? { playground: structuredClone(environments.playground) }
      : {
          ...worldMap,
          playground: structuredClone(environments.playground),
        }
    for (const [id, env] of Object.entries(map ?? {})) {
      if (id === 'playground') {
        continue
      }
      next[id] = mergeRoom(resetGenerated ? null : next[id], env)
    }
    worldMap = next
  }

  function patchWorld(map) {
    if (!map) {
      return
    }
    for (const [id, env] of Object.entries(map)) {
      if (id === 'playground') {
        continue
      }
      worldMap[id] = mergeRoom(worldMap[id], env)
    }
    emit({
      current: worldMap[snapshot.currentId] ?? snapshot.current,
    })
  }

  function replaceWorld(map, startId) {
    if (!map || !startId || !map[startId]) {
      emit({ error: 'Generated world was missing a starting room.', status: 'error' })
      return
    }

    pendingId = null
    // Drop prior catalog/generated rooms so pending stubs are not merged with
    // leftover panoramas from the static room1–room3 catalog.
    applyWorldMap(map, { resetGenerated: true })
    emit({ transitioning: true, error: null })

    const go = () => beginLoad(startId)

    if (snapshot.fade >= 0.95) {
      go()
      return
    }

    animateFade(snapshot.fade, 1, go)
  }

  function onPanoramaReady(id) {
    if (id !== snapshot.currentId) {
      return
    }
    if (snapshot.status === 'ready' && !snapshot.transitioning) {
      return
    }
    emit({ status: 'ready', error: null })
    finishReady()
  }

  function onPanoramaError(id, message) {
    if (id !== snapshot.currentId) {
      return
    }
    const env = worldMap[id]
    if (env?.panorama && String(env.panorama).includes('/generated/')) {
      worldMap[id] = { ...env, panorama: '/panoramas/room-2.jpg' }
      emit({
        current: worldMap[id],
        status: 'loading',
        error: null,
      })
      return
    }
    emit({
      status: 'error',
      error: message || `Could not load panorama for ${snapshot.current?.name ?? id}.`,
    })
    finishReady()
  }

  function resetView() {
    inputManager.press('reset')
  }

  return {
    subscribe,
    getSnapshot,
    navigateTo,
    replaceWorld,
    patchWorld,
    onPanoramaReady,
    onPanoramaError,
    resetView,
  }
}

export const environmentStore = createEnvironmentStore()

export function navigateTo(id) {
  environmentStore.navigateTo(id)
}

export function useEnvironment() {
  return useSyncExternalStore(environmentStore.subscribe, environmentStore.getSnapshot)
}

/**
 * Host component for the environment store. Store is module-level; this
 * exists so App can keep a clear "navigation layer" in the tree.
 */
export function EnvironmentManager({ children }) {
  return children
}
