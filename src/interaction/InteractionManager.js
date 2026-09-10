import { Raycaster, Vector2 } from 'three'

/**
 * Interaction registry shared by mouse clicks, keyboard targeting, and XR
 * pointer events. Objects register a mesh + interact() callback; input
 * never talks to meshes directly.
 */
export function createInteractionManager() {
  const objects = new Map()
  const raycaster = new Raycaster()
  const ndc = new Vector2(0, 0)
  const listeners = new Set()

  let targetId = null
  let selectedId = null

  function emit() {
    for (const fn of listeners) fn(targetId)
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function register(id, entry) {
    objects.set(id, entry)
  }

  function unregister(id) {
    objects.delete(id)
    if (targetId === id) {
      targetId = null
      emit()
    }
    if (selectedId === id) {
      selectedId = null
    }
  }

  function setTarget(id) {
    if (targetId === id) return
    targetId = id
    emit()
  }

  function getTargetId() {
    return targetId
  }

  function getSelectedId() {
    return selectedId
  }

  function interactId(id) {
    const entry = objects.get(id)
    if (!entry) {
      return false
    }
    selectedId = id
    entry.interact()
    return true
  }

  function interactTarget() {
    if (targetId) {
      return interactId(targetId)
    }
    return false
  }

  function clearSelection() {
    selectedId = null
    if (targetId != null) {
      targetId = null
      emit()
    }
  }

  function updateFromCamera(camera) {
    const meshes = []
    const meshToId = new Map()
    for (const [id, entry] of objects) {
      const mesh = entry.getObject()
      if (mesh) {
        meshes.push(mesh)
        meshToId.set(mesh, id)
      }
    }

    if (meshes.length === 0) {
      if (targetId != null) {
        targetId = null
        emit()
      }
      return
    }

    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length === 0) {
      if (targetId != null) {
        targetId = null
        emit()
      }
      return
    }

    let node = hits[0].object
    let id = null
    while (node && id == null) {
      id = meshToId.get(node) ?? null
      node = node.parent
    }
    if (targetId !== id) {
      targetId = id
      emit()
    }
  }

  return {
    register,
    unregister,
    setTarget,
    getTargetId,
    getSelectedId,
    interactId,
    interactTarget,
    clearSelection,
    updateFromCamera,
    subscribe,
  }
}

export const interactionManager = createInteractionManager()
