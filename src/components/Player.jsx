import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useXR, XROrigin } from '@react-three/xr'
import { Vector3 } from 'three'
import { inputManager } from '../input/InputManager.js'
import { interactionManager } from '../interaction/InteractionManager.js'
import { playerPose } from '../navigation/playerPose.js'

const EYE_HEIGHT = 1.6
const WALK_SPEED = 3.2
const SPRINT_MULTIPLIER = 2.1
const LOOK_SPEED = 1.35
const JUMP_SPEED = 5
const GRAVITY = 14

const INITIAL_FEET = new Vector3(0, 0, 6)
const INITIAL_TARGET = new Vector3(0, 1, 0)

const up = new Vector3(0, 1, 0)
const forward = new Vector3()
const right = new Vector3()
const displacement = new Vector3()
const offset = new Vector3()

/**
 * Walkable 3D camera/player. Used in every environment — panorama is only a backdrop.
 */
export function Player() {
  const controlsRef = useRef(null)
  const originRef = useRef(null)
  const feet = useRef(INITIAL_FEET.clone())
  const jumpY = useRef(0)
  const velocityY = useRef(0)
  const grounded = useRef(true)
  const wasInXR = useRef(false)

  const camera = useThree((state) => state.camera)
  const session = useXR((xr) => xr.session)
  const inXR = session != null

  function resetView() {
    feet.current.copy(INITIAL_FEET)
    jumpY.current = 0
    velocityY.current = 0
    grounded.current = true
    if (!inXR) {
      camera.position.set(INITIAL_FEET.x, EYE_HEIGHT, INITIAL_FEET.z)
      camera.up.copy(up)
      camera.lookAt(INITIAL_TARGET)
      if (controlsRef.current) {
        controlsRef.current.target.copy(INITIAL_TARGET)
        controlsRef.current.update()
      }
    } else if (originRef.current) {
      originRef.current.position.set(INITIAL_FEET.x, 0, INITIAL_FEET.z)
      originRef.current.rotation.set(0, 0, 0)
    }
  }

  useEffect(() => {
    if (inXR && !wasInXR.current) {
      feet.current.set(camera.position.x, 0, camera.position.z)
      jumpY.current = 0
      velocityY.current = 0
      grounded.current = true
    }
    wasInXR.current = inXR
  }, [inXR, camera])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    if (inputManager.consume('reset')) {
      resetView()
    }

    if (inputManager.consume('cancel')) {
      interactionManager.clearSelection()
      session?.end?.()
    }

    if (inputManager.consume('interact')) {
      interactionManager.interactTarget()
    }

    const movement = inputManager.getMovement()
    const look = inputManager.getLook()
    const speed = WALK_SPEED * (inputManager.isSprinting() ? SPRINT_MULTIPLIER : 1)

    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() > 0.0001) {
      forward.normalize()
    } else {
      forward.set(0, 0, -1)
    }
    right.crossVectors(forward, up).normalize()

    displacement
      .set(0, 0, 0)
      .addScaledVector(right, movement.x * speed * dt)
      .addScaledVector(forward, movement.z * speed * dt)

    feet.current.add(displacement)

    if (inXR) {
      if (originRef.current) {
        originRef.current.rotation.y += look.yaw * LOOK_SPEED * dt
      }
    } else {
      camera.position.add(displacement)
      if (controlsRef.current) {
        controlsRef.current.target.add(displacement)
        if (look.yaw !== 0) {
          offset.copy(camera.position).sub(controlsRef.current.target)
          offset.applyAxisAngle(up, look.yaw * LOOK_SPEED * dt)
          camera.position.copy(controlsRef.current.target).add(offset)
        }
      }
    }

    if (inputManager.consume('jump') && grounded.current) {
      velocityY.current = JUMP_SPEED
      grounded.current = false
    }

    velocityY.current -= GRAVITY * dt
    jumpY.current += velocityY.current * dt
    if (jumpY.current <= 0) {
      jumpY.current = 0
      velocityY.current = 0
      grounded.current = true
    }

    if (inXR) {
      if (originRef.current) {
        originRef.current.position.set(feet.current.x, jumpY.current, feet.current.z)
      }
    } else {
      camera.position.y = EYE_HEIGHT + jumpY.current
    }

    interactionManager.updateFromCamera(camera)
    playerPose.set(feet.current.x, EYE_HEIGHT + jumpY.current, feet.current.z)
  })

  return (
    <>
      <XROrigin ref={originRef} position={[INITIAL_FEET.x, 0, INITIAL_FEET.z]} />
      {!inXR && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2}
          maxDistance={28}
          maxPolarAngle={Math.PI * 0.49}
          target={[0, 1, 0]}
        />
      )}
    </>
  )
}
