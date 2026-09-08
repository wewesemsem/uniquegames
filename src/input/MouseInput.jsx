import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { inputManager } from './InputManager'

/**
 * Mouse source. Orbit/zoom is handled by OrbitControls (desktop only).
 * This module keeps the canvas focused and records pointer activity so
 * another look/aim mode can be added later without touching the scene.
 */
export function MouseInput() {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const element = gl.domElement
    element.tabIndex = 0

    function onPointerDown() {
      element.focus({ preventScroll: true })
    }

    function onContextMenu(event) {
      event.preventDefault()
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('contextmenu', onContextMenu)

    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('contextmenu', onContextMenu)
      inputManager.setSource('mouse', { x: 0, z: 0, lookYaw: 0 })
    }
  }, [gl])

  return null
}
