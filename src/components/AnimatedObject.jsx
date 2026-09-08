import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { behaviorMotion } from '../procedural/animation/behaviors.js'
import { hashInt } from '../procedural/objects/hash.js'

/**
 * Applies a safe animation behavior to a child mesh group.
 * Behaviors come from the scene Animation spec — never from LLM code.
 */
export function AnimatedObject({ id = 'obj', animation = null, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], children }) {
  const ref = useRef()
  const seed = hashInt(id)
  const baseScale = Array.isArray(scale) ? scale : [scale, scale, scale]
  const baseRot = Array.isArray(rotation) ? rotation : [0, rotation || 0, 0]
  const basePos = Array.isArray(position) ? position : [0, 0, 0]

  useFrame(({ clock }) => {
    if (!ref.current) return
    if (!animation) {
      ref.current.position.set(basePos[0], basePos[1], basePos[2])
      ref.current.rotation.set(baseRot[0], baseRot[1], baseRot[2])
      ref.current.scale.set(baseScale[0], baseScale[1], baseScale[2])
      return
    }
    const motion = behaviorMotion(animation, clock.elapsedTime, seed)
    ref.current.position.set(
      basePos[0] + motion.position[0],
      basePos[1] + motion.position[1],
      basePos[2] + motion.position[2]
    )
    ref.current.rotation.set(
      baseRot[0] + motion.rotation[0],
      baseRot[1] + motion.rotation[1],
      baseRot[2] + motion.rotation[2]
    )
    ref.current.scale.set(
      baseScale[0] * motion.scale[0],
      baseScale[1] * motion.scale[1],
      baseScale[2] * motion.scale[2]
    )
  })

  return <group ref={ref}>{children}</group>
}
