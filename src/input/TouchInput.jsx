import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { inputManager } from './InputManager'

/**
 * Touch source. One-finger orbit and pinch-zoom stay with OrbitControls.
 * This registers the touch device so locomotion/interaction can later read
 * on-screen sticks without changing Scene or Player.
 */
export function TouchInput() {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const element = gl.domElement

    function onTouchStart() {
      element.focus({ preventScroll: true })
    }

    element.addEventListener('touchstart', onTouchStart, { passive: true })

    return () => {
      element.removeEventListener('touchstart', onTouchStart)
      inputManager.setSource('touch', { x: 0, z: 0 })
    }
  }, [gl])

  return null
}
