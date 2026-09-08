import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { interactionManager } from './InteractionManager.js'
import { sceneEventStore } from './SceneEventStore.js'
import { reactionMotion } from '../procedural/animation/reactionMotion.js'

/**
 * Hit-volume size by semantic type (local units, before object scale).
 * Groups have no geometry — R3F pointer events need a real mesh, like InteractiveObject.
 */
function hitSizeFor(type) {
  switch (String(type || '')) {
    case 'pyramid':
      return [1.6, 1.4, 1.6]
    case 'temple':
    case 'habitat':
    case 'ruins':
      return [2.2, 1.6, 2.2]
    case 'statue':
    case 'obelisk':
    case 'column':
    case 'torch':
    case 'ancient_door':
      return [0.9, 2.0, 0.9]
    case 'coral':
    case 'flower':
    case 'tree':
    case 'palm_tree':
      return [1.4, 1.2, 1.4]
    case 'spaceship':
    case 'planet':
    case 'asteroid':
      return [1.8, 1.2, 1.8]
    case 'crate':
    case 'console':
      return [1.0, 1.0, 1.0]
    case 'jellyfish':
    case 'fish':
    case 'bird':
      return [1.2, 1.2, 1.2]
    default:
      return [1.4, 1.4, 1.4]
  }
}

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
  const hitRef = useRef(null)
  const glowRef = useRef(null)
  const markerRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [targeted, setTargeted] = useState(false)
  const objectRef = useRef(object)
  objectRef.current = object

  const hitSize = useMemo(() => hitSizeFor(object?.type), [object?.type])

  const objectFx = useSyncExternalStore(
    sceneEventStore.subscribe,
    () => sceneEventStore.getSnapshot().effects?.objectFx?.[id] ?? null
  )

  useEffect(() => {
    if (!interactive || !id) return undefined
    interactionManager.register(id, {
      // Prefer the hit mesh so camera reticle / VR rays intersect real geometry.
      getObject: () => hitRef.current || groupRef.current,
      interact: () => {
        const obj = objectRef.current
        const fired = sceneEventStore.triggerByObject(id, 'click', { sourceObject: obj })
        if (!fired && obj?.interactions?.length) {
          // Fallback if room index missed this object (late mount / partial patch).
          for (const event of obj.interactions) {
            if (event.trigger === 'click' || event.trigger === 'tap' || event.trigger === 'vr_select') {
              sceneEventStore.activate(event.id, { sourceObject: obj })
            }
          }
        }
      },
    })
    return () => interactionManager.unregister(id)
  }, [id, interactive])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const isTarget = interactive && interactionManager.getTargetId() === id
    if (isTarget !== targeted) setTargeted(isTarget)

    const highlighted = interactive && (hovered || isTarget)
    const pulse = highlighted ? 0.5 + Math.sin(clock.elapsedTime * 3.2) * 0.5 : 0
    const baseScale = Array.isArray(scale) ? scale : [scale || 1, scale || 1, scale || 1]
    const highlightScale = highlighted ? 1.03 + pulse * 0.015 : 1

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
      groupRef.current.scale.set(
        baseScale[0] * highlightScale,
        baseScale[1] * highlightScale,
        baseScale[2] * highlightScale
      )
    }

    if (glowRef.current) {
      glowRef.current.visible = highlighted
      if (highlighted && glowRef.current.material) {
        glowRef.current.material.opacity = 0.1 + pulse * 0.12
      }
    }

    if (markerRef.current) {
      const bob = Math.sin(clock.elapsedTime * 2.4) * 0.08
      markerRef.current.position.y = hitSize[1] * 0.55 + 0.55 + bob
      markerRef.current.rotation.y = clock.elapsedTime * 1.2
      const mat = markerRef.current.material
      if (mat) {
        mat.opacity = highlighted ? 0.95 : 0.55
        mat.color.set(highlighted ? '#fff4a8' : '#d7f07a')
      }
    }
  })

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
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {children}

      {/* Invisible hit volume — required for reliable desktop/VR/touch picks */}
      {interactive ? (
        <mesh
          ref={hitRef}
          position={[0, hitSize[1] * 0.35, 0]}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          pointerEventsType={{ deny: 'grab' }}
        >
          <boxGeometry args={hitSize} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ) : null}

      {/* Soft hover halo */}
      {interactive ? (
        <mesh ref={glowRef} position={[0, hitSize[1] * 0.35, 0]} visible={false} raycast={() => null}>
          <sphereGeometry args={[Math.max(hitSize[0], hitSize[2]) * 0.7, 16, 12]} />
          <meshBasicMaterial color="#f0e6c8" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Persistent affordance so interactive props are discoverable */}
      {interactive ? (
        <mesh ref={markerRef} position={[0, hitSize[1] * 0.55 + 0.55, 0]} raycast={() => null}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#d7f07a" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
