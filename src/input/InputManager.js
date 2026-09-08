/**
 * Central input state.
 *
 * Keyboard, mouse, touch, and XR controllers write into named sources.
 * Player and interaction code read the combined result — they never listen
 * to DOM or WebXR events themselves.
 *
 *   WASD / thumbstick  →  movement  →  Player  →  Scene
 *   E / trigger        →  interact  →  InteractionManager  →  Scene
 */

function emptyAxes() {
  return { x: 0, y: 0, z: 0, lookYaw: 0, lookPitch: 0, sprint: false }
}

export function createInputManager() {
  const sources = {
    keyboard: emptyAxes(),
    mouse: emptyAxes(),
    touch: emptyAxes(),
    xr: emptyAxes(),
  }

  const queued = {
    jump: false,
    interact: false,
    reset: false,
    cancel: false,
  }

  function setSource(name, partial) {
    const current = sources[name]
    if (!current) {
      throw new Error(`Unknown input source: ${name}. Register it before writing.`)
    }
    Object.assign(current, partial)
  }

  function registerSource(name) {
    if (!sources[name]) {
      sources[name] = emptyAxes()
    }
  }

  function getMovement() {
    let x = 0
    let y = 0
    let z = 0
    for (const source of Object.values(sources)) {
      x += source.x
      y += source.y
      z += source.z
    }
    return {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      z: Math.max(-1, Math.min(1, z)),
    }
  }

  function getLook() {
    let yaw = 0
    let pitch = 0
    for (const source of Object.values(sources)) {
      yaw += source.lookYaw
      pitch += source.lookPitch
    }
    return { yaw, pitch }
  }

  function isSprinting() {
    return Object.values(sources).some((source) => source.sprint)
  }

  function press(action) {
    if (action in queued) {
      queued[action] = true
    }
  }

  function consume(action) {
    if (!queued[action]) {
      return false
    }
    queued[action] = false
    return true
  }

  function peek(action) {
    return Boolean(queued[action])
  }

  return {
    sources,
    setSource,
    registerSource,
    getMovement,
    getLook,
    isSprinting,
    press,
    consume,
    peek,
  }
}

export const inputManager = createInputManager()
