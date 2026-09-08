import { useMemo } from 'react'
import { hash01 } from './hash.js'

const FISH_COLORS = ['#7ec8e3', '#f0e68c', '#ff7f50', '#c0c0c0', '#87ceeb', '#ffa07a', '#b0e0e6']

/**
 * Generic fish school — one procedural object, many instances.
 * Params: { count, size, colors, movement }
 */
export function FishMesh({ seed = 1, params = {}, color }) {
  const count = Math.min(48, Math.max(4, params.count ?? 12))
  const sizeMul = params.size === 'small' ? 0.55 : params.size === 'large' ? 1.15 : 0.8
  const palette = Array.isArray(params.colors) && params.colors.length ? params.colors : FISH_COLORS

  const fish = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = hash01(seed, i * 4 + 1) * Math.PI * 2
      const r = 0.4 + hash01(seed, i * 4 + 2) * 2.4
      const y = (hash01(seed, i * 4 + 3) - 0.5) * 1.6
      return {
        key: i,
        pos: [Math.cos(a) * r, y, Math.sin(a) * r],
        rot: a + Math.PI / 2,
        scale: sizeMul * (0.7 + hash01(seed, i * 4 + 4) * 0.6),
        color: palette[Math.floor(hash01(seed, i + 9) * palette.length)] || color || FISH_COLORS[0],
      }
    })
  }, [seed, count, sizeMul, palette, color])

  return (
    <group>
      {fish.map((f) => (
        <group key={f.key} position={f.pos} rotation={[0, f.rot, 0]} scale={f.scale}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <meshStandardMaterial color={f.color} roughness={0.45} />
          </mesh>
          <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.12, 0.28, 5]} />
            <meshStandardMaterial color={f.color} roughness={0.5} />
          </mesh>
          <mesh position={[0.05, 0.12, 0]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.08, 0.16, 0.02]} />
            <meshStandardMaterial color={f.color} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function JellyfishMesh({ seed = 1, color = '#e8b4f8' }) {
  const tentacles = 6 + Math.floor(hash01(seed, 1) * 4)
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
        <meshStandardMaterial color={color} transparent opacity={0.7} roughness={0.2} />
      </mesh>
      {Array.from({ length: tentacles }, (_, i) => {
        const a = (i / tentacles) * Math.PI * 2
        const len = 0.7 + hash01(seed, i + 2) * 0.6
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, -len / 2, Math.sin(a) * 0.12]}>
            <cylinderGeometry args={[0.015, 0.025, len, 4]} />
            <meshStandardMaterial color={color} transparent opacity={0.55} />
          </mesh>
        )
      })}
    </group>
  )
}

export function SeaweedMesh({ seed = 1 }) {
  const blades = 4 + Math.floor(hash01(seed, 1) * 4)
  return (
    <group>
      {Array.from({ length: blades }, (_, i) => {
        const h = 0.9 + hash01(seed, i + 2) * 1.6
        const x = (hash01(seed, i + 5) - 0.5) * 0.6
        const z = (hash01(seed, i + 8) - 0.5) * 0.6
        return (
          <mesh key={i} position={[x, h / 2, z]} rotation={[0, 0, (hash01(seed, i + 11) - 0.5) * 0.35]}>
            <boxGeometry args={[0.08, h, 0.03]} />
            <meshStandardMaterial color={i % 2 ? '#1f8f5f' : '#2eaa72'} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Flower / wildflower patch — generic plant vocabulary, not one mesh per species.
 */
export function FlowerMesh({ seed = 1, params = {} }) {
  const count = Math.min(36, Math.max(6, params.count ?? 16))
  const colors = params.colors ?? ['#ff6b8a', '#ffd166', '#fff1a8', '#c77dff', '#ff8fab', '#90e0ef']
  const blooms = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = hash01(seed, i * 3 + 1) * Math.PI * 2
      const r = hash01(seed, i * 3 + 2) * 1.4
      return {
        key: i,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        h: 0.25 + hash01(seed, i * 3 + 3) * 0.45,
        color: colors[Math.floor(hash01(seed, i + 20) * colors.length)],
      }
    })
  }, [seed, count, colors])

  return (
    <group>
      {blooms.map((b) => (
        <group key={b.key} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]}>
            <cylinderGeometry args={[0.015, 0.02, b.h, 4]} />
            <meshStandardMaterial color="#2f7a3a" />
          </mesh>
          <mesh position={[0, b.h, 0]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color={b.color} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function BirdMesh({ seed = 1, params = {} }) {
  const count = Math.min(20, Math.max(3, params.count ?? 6))
  const birds = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = hash01(seed, i * 3 + 1) * Math.PI * 2
      const r = 0.5 + hash01(seed, i * 3 + 2) * 2
      return {
        key: i,
        pos: [Math.cos(a) * r, (hash01(seed, i * 3 + 3) - 0.5) * 1.2, Math.sin(a) * r],
        rot: a,
      }
    })
  }, [seed, count])

  return (
    <group>
      {birds.map((b) => (
        <group key={b.key} position={b.pos} rotation={[0, b.rot, 0]}>
          <mesh>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshStandardMaterial color="#2a2a2e" />
          </mesh>
          <mesh position={[-0.12, 0, 0]} rotation={[0.2, 0, 0.4]}>
            <boxGeometry args={[0.18, 0.02, 0.08]} />
            <meshStandardMaterial color="#3a3a40" />
          </mesh>
          <mesh position={[0.12, 0, 0]} rotation={[-0.2, 0, -0.4]}>
            <boxGeometry args={[0.18, 0.02, 0.08]} />
            <meshStandardMaterial color="#3a3a40" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
