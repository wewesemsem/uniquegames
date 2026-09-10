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
      return [1.8, 1.6, 1.8]
    case 'temple':
    case 'habitat':
    case 'ruins':
      return [2.4, 1.8, 2.4]
    case 'statue':
    case 'obelisk':
    case 'column':
    case 'torch':
    case 'ancient_door':
      return [1.1, 2.2, 1.1]
    case 'coral':
    case 'flower':
    case 'tree':
    case 'palm_tree':
      return [1.6, 1.4, 1.6]
    case 'spaceship':
    case 'planet':
    case 'asteroid':
      return [2.0, 1.4, 2.0]
    case 'crate':
    case 'console':
      return [1.2, 1.2, 1.2]
    case 'jellyfish':
    case 'fish':
    case 'bird':
      return [1.4, 1.4, 1.4]
    default:
      return [1.7, 1.7, 1.7]
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
  const ringRef = useRef(null)
  const markerRef = useRef(null)
  const fxGlowRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [targeted, setTargeted] = useState(false)
  const objectRef = useRef(object)
  objectRef.current = object

  const hitSize = useMemo(() => hitSizeFor(object?.type), [object?.type])
  const glowRadius = Math.max(hitSize[0], hitSize[2]) * 0.95

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
    const t = clock.elapsedTime
    const pulse = highlighted ? 0.5 + Math.sin(t * 4.5) * 0.5 : 0.5 + Math.sin(t * 2.2) * 0.5
    const baseScale = Array.isArray(scale) ? scale : [scale || 1, scale || 1, scale || 1]
    const highlightScale = highlighted ? 1.12 + pulse * 0.06 : 1

    let reactionEmissive = 0
    if (objectFx) {
      const progress = 1 - Math.max(0, (objectFx.until - performance.now()) / 4000)
      const motion = reactionMotion(objectFx.animation || 'glow_up', Math.min(1, Math.max(0, progress)), 3)
      reactionEmissive = motion.emissive || objectFx.emissive || 0
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
        glowRef.current.material.opacity = 0.28 + pulse * 0.28
        glowRef.current.scale.setScalar(0.95 + pulse * 0.12)
      }
    }

    if (ringRef.current) {
      ringRef.current.visible = true
      ringRef.current.rotation.z = t * (highlighted ? 1.8 : 0.7)
      const ringMat = ringRef.current.material
      if (ringMat) {
        ringMat.opacity = highlighted ? 0.85 : 0.45 + pulse * 0.2
        ringMat.color.set(highlighted ? '#fff4a8' : '#9be7ff')
      }
      const ringScale = highlighted ? 1.08 + pulse * 0.08 : 0.92 + pulse * 0.06
      ringRef.current.scale.set(ringScale, ringScale, ringScale)
    }

    if (markerRef.current) {
      const bob = Math.sin(t * 3.2) * 0.12
      markerRef.current.position.y = hitSize[1] * 0.55 + 0.7 + bob
      markerRef.current.rotation.y = t * 1.8
      markerRef.current.rotation.x = Math.sin(t * 2.1) * 0.25
      const mat = markerRef.current.material
      if (mat) {
        mat.opacity = highlighted ? 1 : 0.82
        mat.color.set(highlighted ? '#fff8c4' : '#c9f07d')
      }
      const markerScale = highlighted ? 1.25 + pulse * 0.15 : 1 + pulse * 0.08
      markerRef.current.scale.setScalar(markerScale)
    }

    if (fxGlowRef.current) {
      const active = reactionEmissive > 0.02
      fxGlowRef.current.visible = active
      if (active && fxGlowRef.current.material) {
        fxGlowRef.current.material.opacity = Math.min(0.75, 0.2 + reactionEmissive * 0.55)
        fxGlowRef.current.scale.setScalar(0.9 + reactionEmissive * 0.5)
      }
    }
  })

  function handlePointerOver(event) {
    if (!interactive) return
    event.stopPropagation()
    setHovered(true)
    interactionManager.setTarget(id)
    document.body.style.cursor = 'pointer'
  }

  function handlePointerOut(event) {
    if (!interactive) return
    event.stopPropagation()
    setHovered(false)
    document.body.style.cursor = ''
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
          <sphereGeometry args={[glowRadius, 20, 14]} />
          <meshBasicMaterial color="#ffe9a0" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Reaction emissive bloom overlay */}
      {interactive ? (
        <mesh ref={fxGlowRef} position={[0, hitSize[1] * 0.35, 0]} visible={false} raycast={() => null}>
          <sphereGeometry args={[glowRadius * 1.15, 16, 12]} />
          <meshBasicMaterial color="#ffd36a" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Orbiting ring — always visible so interactables read at a glance */}
      {interactive ? (
        <mesh
          ref={ringRef}
          position={[0, hitSize[1] * 0.35, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[glowRadius * 0.72, 0.035, 10, 36]} />
          <meshBasicMaterial color="#9be7ff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Persistent affordance so interactive props are discoverable */}
      {interactive ? (
        <mesh ref={markerRef} position={[0, hitSize[1] * 0.55 + 0.7, 0]} raycast={() => null}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshBasicMaterial color="#c9f07d" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
