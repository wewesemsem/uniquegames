import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { inputManager } from './InputManager'

const DEADZONE = 0.15

function axis(value) {
  if (value == null || Math.abs(value) < DEADZONE) {
    return 0
  }
  return value
}

function isPressed(component) {
  if (!component) {
    return false
  }
  if (component.state === 'pressed') {
    return true
  }
  return (component.button ?? 0) > 0.7
}

/**
 * XR controller source (@react-three/xr v6).
 *
 * Thumbsticks write the same movement axes as WASD. Trigger pulses the
 * same "interact" action as E/Enter. Player applies that state to XROrigin,
 * so VR locomotion does not move the scene graph independently of desktop.
 */
export function XRInput() {
  const session = useXR((xr) => xr.session)
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')
  const triggerHeld = useRef(false)

  useFrame(() => {
    if (!session) {
      inputManager.setSource('xr', { x: 0, z: 0, lookYaw: 0 })
      triggerHeld.current = false
      return
    }

    const moveStick = right?.gamepad?.['xr-standard-thumbstick'] ?? left?.gamepad?.['xr-standard-thumbstick']
    const turnStick = left?.gamepad?.['xr-standard-thumbstick']

    inputManager.setSource('xr', {
      x: axis(moveStick?.xAxis),
      z: -axis(moveStick?.yAxis),
      lookYaw: -axis(turnStick?.xAxis),
    })

    const trigger =
      right?.gamepad?.['xr-standard-trigger'] ?? left?.gamepad?.['xr-standard-trigger']
    const down = isPressed(trigger)
    if (down && !triggerHeld.current) {
      inputManager.press('interact')
    }
    triggerHeld.current = down
  })

  return null
}
