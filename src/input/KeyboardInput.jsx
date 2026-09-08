import { useEffect } from 'react'
import { inputManager } from './InputManager'

const MOVE_KEYS = {
  KeyW: { axis: 'z', dir: 1 },
  KeyS: { axis: 'z', dir: -1 },
  KeyA: { axis: 'x', dir: -1 },
  KeyD: { axis: 'x', dir: 1 },
  ArrowUp: { axis: 'z', dir: 1 },
  ArrowDown: { axis: 'z', dir: -1 },
}

const LOOK_KEYS = {
  ArrowLeft: 1,
  ArrowRight: -1,
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

/**
 * Window-level keyboard source. Scene objects do not attach their own key handlers.
 */
export function KeyboardInput() {
  useEffect(() => {
    const held = new Set()

    function syncFromHeld() {
      let x = 0
      let z = 0
      let lookYaw = 0
      for (const code of held) {
        const move = MOVE_KEYS[code]
        if (move) {
          if (move.axis === 'x') x += move.dir
          if (move.axis === 'z') z += move.dir
        }
        if (code in LOOK_KEYS) {
          lookYaw += LOOK_KEYS[code]
        }
      }
      inputManager.setSource('keyboard', {
        x,
        z,
        lookYaw,
        sprint: held.has('ShiftLeft') || held.has('ShiftRight'),
      })
    }

    function onKeyDown(event) {
      if (isTypingTarget(event.target) || event.repeat) {
        return
      }

      const { code } = event
      if (code in MOVE_KEYS || code in LOOK_KEYS || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') {
        event.preventDefault()
      }

      if (code === 'Space') {
        inputManager.press('jump')
        return
      }
      if (code === 'KeyE' || code === 'Enter' || code === 'NumpadEnter') {
        event.preventDefault()
        inputManager.press('interact')
        return
      }
      if (code === 'KeyR') {
        inputManager.press('reset')
        return
      }
      if (code === 'Escape') {
        inputManager.press('cancel')
        return
      }

      held.add(code)
      syncFromHeld()
    }

    function onKeyUp(event) {
      held.delete(event.code)
      syncFromHeld()
    }

    function onBlur() {
      held.clear()
      syncFromHeld()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      held.clear()
      inputManager.setSource('keyboard', { x: 0, z: 0, lookYaw: 0, sprint: false })
    }
  }, [])

  return null
}
