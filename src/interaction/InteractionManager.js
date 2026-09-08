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

  let targetId = null
  let selectedId = null

  function register(id, entry) {
    objects.set(id, entry)
  }

  function unregister(id) {
    objects.delete(id)
    if (targetId === id) {
      targetId = null
    }
    if (selectedId === id) {
      selectedId = null
    }
  }

  function setTarget(id) {
    targetId = id
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
    targetId = null
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
      targetId = null
      return
    }

    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length === 0) {
      targetId = null
      return
    }

    let node = hits[0].object
    let id = null
    while (node && id == null) {
      id = meshToId.get(node) ?? null
      node = node.parent
    }
    targetId = id
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
  }
}

export const interactionManager = createInteractionManager()
