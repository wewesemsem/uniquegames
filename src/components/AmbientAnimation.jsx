import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { environmentAnimations, speedToFactor } from '../world/AnimationSchema.js'
import { hash01 } from '../procedural/objects/hash.js'

/**
 * Ambient particle / bubble / pollen field driven by required scene animation.
 */
export function AmbientAnimation({ animation = null, composition = null }) {
  const envBehaviors = environmentAnimations(animation)
  const rise = envBehaviors.find((b) => b.behavior === 'rise' || b.target === 'bubbles')
  const drift = envBehaviors.find((b) => b.behavior === 'drift' || ['particles', 'pollen', 'dust', 'sand'].includes(b.target))
  const active = rise || drift

  const count = rise ? 48 : drift ? 36 : 0
  const points = useMemo(() => {
    if (!count) return []
    return Array.from({ length: count }, (_, i) => ({
      x: (hash01(i + 1, 1) - 0.5) * 28,
      y: hash01(i + 1, 2) * 6 - 0.5,
      z: (hash01(i + 1, 3) - 0.5) * 28 - 4,
      s: 0.03 + hash01(i + 1, 4) * 0.07,
      phase: hash01(i + 1, 5) * Math.PI * 2,
      speed: 0.6 + hash01(i + 1, 6) * 0.8,
    }))
  }, [count])

  const group = useRef()
  const underwater = /ocean|coral|reef/.test(composition?.biome || '')
  const color = rise || underwater ? '#b8e8ff' : drift?.target === 'pollen' ? '#ffe8a0' : '#d8c8b0'

  useFrame(({ clock }) => {
    if (!group.current || !active) return
    const t = clock.elapsedTime
    const speed = speedToFactor(active.speed)
    group.current.children.forEach((child, i) => {
      const p = points[i]
      if (!p) return
      if (rise) {
        const y = ((t * 0.35 * speed * p.speed + p.phase) % 5) - 0.5
        child.position.set(p.x + Math.sin(t * 0.4 + p.phase) * 0.4, y, p.z + Math.cos(t * 0.35 + p.phase) * 0.3)
      } else {
        child.position.set(
          p.x + Math.sin(t * 0.2 * speed + p.phase) * 1.2,
          p.y + Math.sin(t * 0.15 * speed + p.phase) * 0.4,
          p.z + Math.cos(t * 0.18 * speed + p.phase) * 1.0
        )
      }
    })
  })

  if (!active || points.length === 0) {
    return null
  }

  return (
    <group ref={group} raycast={() => null}>
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} raycast={() => null}>
          <sphereGeometry args={[p.s, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={rise ? 0.45 : 0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
