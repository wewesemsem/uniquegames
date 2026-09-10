import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { getGenerator } from '../procedural/objects/generators.js'
import { hashInt } from '../procedural/objects/hash.js'
import { reactionMotion } from '../procedural/animation/reactionMotion.js'
import { playerPose } from '../navigation/playerPose.js'
import { interactionManager } from './InteractionManager.js'
import { sceneEventStore } from './SceneEventStore.js'

function ReactionSpawn({ spawn }) {
  const ref = useRef()
  const seed = hashInt(spawn.id)
  const Generator = getGenerator(spawn.type)
  const basePos = spawn.position || [0, 0, 0]
  const baseScale = Array.isArray(spawn.scale) ? spawn.scale : [1, 1, 1]
  const baseRot = spawn.rotation || [0, 0, 0]
  const chasePos = useRef(basePos.slice())

  useFrame((_, delta) => {
    if (!ref.current) return
    const elapsed = (performance.now() - spawn.startedAt) / 1000
    const progress = Math.min(1, elapsed / Math.max(0.1, spawn.duration || 4))
    const motion = reactionMotion(spawn.animation, progress, seed)

    if (motion.chase) {
      const cur = chasePos.current
      const dx = playerPose.x - cur[0]
      const dz = playerPose.z - cur[2]
      const dist = Math.hypot(dx, dz)
      if (dist > 1.15) {
        const step = Math.min(dist - 1.05, motion.chase * Math.min(0.05, delta))
        cur[0] += (dx / dist) * step
        cur[2] += (dz / dist) * step
      }
      cur[1] = basePos[1] + motion.position[1]
      ref.current.position.set(cur[0], cur[1], cur[2])
      ref.current.rotation.set(baseRot[0], Math.atan2(dx, dz), baseRot[2])
      ref.current.scale.set(
        baseScale[0] * motion.scale[0],
        baseScale[1] * motion.scale[1],
        baseScale[2] * motion.scale[2]
      )
      return
    }

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

  return (
    <group ref={ref}>
      <Generator
        detail={spawn.detail || 'medium'}
        seed={seed}
        params={spawn.params}
        material={spawn.material || 'sandstone'}
        color="#c4b49a"
      />
    </group>
  )
}

function ReactionEffects({ effects }) {
  if (!effects?.lighting && !effects?.particles) return null
  const origin = effects.origin || [0, 0, -3]
  const sparkles = effects.particles
    ? [
        [0, 1.2, 0],
        [0.7, 1.7, 0.4],
        [-0.7, 1.0, -0.3],
        [0.35, 2.1, -0.5],
        [-0.4, 1.6, 0.6],
        [0.9, 1.3, -0.2],
        [-0.2, 2.4, 0.2],
        [0.15, 0.8, 0.7],
      ]
    : []
  return (
    <group position={origin}>
      {effects.lighting ? (
        <pointLight
          position={[0, 2.4, 0]}
          intensity={effects.lighting.intensity ?? 2.8}
          color={effects.lighting.color ?? '#ffc978'}
          distance={28}
        />
      ) : null}
      {sparkles.map((pos, index) => (
        <mesh key={index} position={pos} raycast={() => null}>
          <sphereGeometry args={[0.14 + (index % 3) * 0.05, 8, 8]} />
          <meshBasicMaterial color="#fff4d0" transparent opacity={0.62 - index * 0.04} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Renders active procedural reaction spawns + transient lighting/particles.
 */
export function ReactionLayer() {
  const snapshot = useSyncExternalStore(sceneEventStore.subscribe, sceneEventStore.getSnapshot)

  useFrame(() => {
    sceneEventStore.tick(performance.now())
  })

  return (
    <group>
      <ReactionEffects effects={snapshot.effects} />
      {(snapshot.spawns ?? []).map((spawn) => (
        <ReactionSpawn key={spawn.id} spawn={spawn} />
      ))}
    </group>
  )
}

/**
 * Drives proximity, gaze, enter_room, and timed triggers for the current room.
 */
export function SceneInteractionSystem({ roomId, interactions, objects = [], playerPositionRef }) {
  const bootToken = useRef(0)
  const objectsRef = useRef(objects)
  objectsRef.current = objects

  const interactionKey = useMemo(() => {
    const events = interactions?.events ?? []
    return `${roomId}|${events.map((e) => e.id).join('|')}|${objects.map((o) => o.id).join(',')}`
  }, [roomId, interactions, objects])

  useEffect(() => {
    const token = ++bootToken.current
    sceneEventStore.resetRoom(roomId, interactions, objectsRef.current)
    const t = setTimeout(() => {
      if (token !== bootToken.current) return
      sceneEventStore.triggerEnterRoom()
      sceneEventStore.startTimedEvents()
    }, 50)
    return () => clearTimeout(t)
  }, [interactionKey, roomId, interactions])

  useFrame((_, delta) => {
    const liveObjects = objectsRef.current
    const pos = playerPositionRef?.current
    if (pos) {
      const xyz = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z]
      sceneEventStore.updateProximity(xyz, liveObjects)
    }
    sceneEventStore.updateGaze(interactionManager.getTargetId(), delta, liveObjects)
  })

  return null
}
