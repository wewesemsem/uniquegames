import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { interactionManager } from './InteractionManager.js'
import { sceneEventStore } from './SceneEventStore.js'
import { reactionMotion } from '../procedural/animation/reactionMotion.js'

/**
 * Wraps any procedural mesh with cross-platform interaction feedback:
 * hover (desktop), gaze/reticle target, VR ray select, touch.
 * Dispatches structured scene events — never runs LLM code.
 */
export function InteractiveTarget({
  id,
  object = null,
  interactive = true,
  children,
  position,
  rotation,
  scale,
}) {
  const groupRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [targeted, setTargeted] = useState(false)
  const [pulse, setPulse] = useState(0)
  const snapshot = useSyncExternalStore(sceneEventStore.subscribe, sceneEventStore.getSnapshot)
  const objectFx = snapshot.effects?.objectFx?.[id]

  useEffect(() => {
    if (!interactive || !id) return undefined
    interactionManager.register(id, {
      getObject: () => groupRef.current,
      interact: () => {
        sceneEventStore.triggerByObject(id, 'click', { sourceObject: object })
      },
    })
    return () => interactionManager.unregister(id)
  }, [id, interactive, object])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const isTarget = interactive && interactionManager.getTargetId() === id
    if (isTarget !== targeted) setTargeted(isTarget)
    if (hovered || isTarget) {
      setPulse(0.5 + Math.sin(clock.elapsedTime * 3.2) * 0.5)
    } else if (pulse !== 0) {
      setPulse(0)
    }

    const baseScale = Array.isArray(scale) ? scale : [scale || 1, scale || 1, scale || 1]
    const highlighted = interactive && (hovered || isTarget)
    const highlightScale = highlighted ? 1.04 + pulse * 0.02 : 1

    if (objectFx) {
      const progress = 1 - Math.max(0, (objectFx.until - performance.now()) / 4000)
      const motion = reactionMotion(objectFx.animation || 'glow_up', Math.min(1, Math.max(0, progress)), 3)
      groupRef.current.position.set(
        (position?.[0] ?? 0) + motion.position[0],
        (position?.[1] ?? 0) + motion.position[1],
        (position?.[2] ?? 0) + motion.position[2]
      )
      groupRef.current.scale.set(
        baseScale[0] * motion.scale[0] * highlightScale,
        baseScale[1] * motion.scale[1] * highlightScale,
        baseScale[2] * motion.scale[2] * highlightScale
      )
    } else {
      groupRef.current.position.set(position?.[0] ?? 0, position?.[1] ?? 0, position?.[2] ?? 0)
      groupRef.current.scale.set(baseScale[0] * highlightScale, baseScale[1] * highlightScale, baseScale[2] * highlightScale)
    }
  })

  const highlighted = hovered || targeted

  function handlePointerOver(event) {
    if (!interactive) return
    event.stopPropagation()
    setHovered(true)
    interactionManager.setTarget(id)
  }

  function handlePointerOut(event) {
    if (!interactive) return
    event.stopPropagation()
    setHovered(false)
  }

  function handlePointerDown(event) {
    if (!interactive) return
    event.stopPropagation()
    interactionManager.setTarget(id)
    interactionManager.interactId(id)
  }

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerOver={interactive ? handlePointerOver : undefined}
      onPointerOut={interactive ? handlePointerOut : undefined}
      pointerEventsType={interactive ? { deny: 'grab' } : undefined}
    >
      {children}
      {highlighted ? (
        <mesh position={[0, 0.05, 0]} raycast={() => null}>
          <sphereGeometry args={[1.15, 16, 12]} />
          <meshBasicMaterial color="#f0e6c8" transparent opacity={0.08 + pulse * 0.07} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
