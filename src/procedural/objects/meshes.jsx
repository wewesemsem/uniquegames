import { useMemo } from 'react'
import { hash01 } from './hash.js'

const STONE = ['#c9b896', '#b8a57a', '#d2c09a', '#a89878', '#c4b08c']
const SAND = ['#d2b48c', '#c4a574', '#e0c9a0', '#b8956a']

function stoneColor(seed, material) {
  if (material === 'limestone' || !material) {
    return STONE[Math.floor(hash01(seed, 1) * STONE.length)]
  }
  if (material === 'sandstone') return SAND[Math.floor(hash01(seed, 2) * SAND.length)]
  if (material === 'basalt') return '#4a4a52'
  if (material === 'metal') return '#8a93a3'
  return STONE[0]
}

function detailSteps(detail) {
  if (detail === 'high') return 10
  if (detail === 'low') return 4
  return 7
}

/** Layered stone pyramid with platform, seams, and entrance cut. */
export function PyramidMesh({ detail = 'medium', material = 'limestone', seed = 1 }) {
  const layers = detailSteps(detail)
  const parts = useMemo(() => {
    const items = []
    // Base platform
    items.push({
      key: 'base',
      pos: [0, 0.08, 0],
      size: [2.4, 0.16, 2.4],
      color: stoneColor(seed, material),
    })
    for (let i = 0; i < layers; i += 1) {
      const t = i / layers
      const w = 2.0 * (1 - t * 0.92)
      const y = 0.16 + i * (1.7 / layers) + 0.08
      items.push({
        key: `layer-${i}`,
        pos: [0, y, 0],
        size: [w, 1.7 / layers + 0.01, w],
        color: stoneColor(seed + i, material),
      })
    }
    return items
  }, [detail, material, seed, layers])

  return (
    <group>
      {parts.map((part) => (
        <mesh key={part.key} position={part.pos} castShadow receiveShadow>
          <boxGeometry args={part.size} />
          <meshStandardMaterial color={part.color} roughness={0.92} flatShading />
        </mesh>
      ))}
      {/* Entrance */}
      <mesh position={[0, 0.35, 1.05]}>
        <boxGeometry args={[0.35, 0.5, 0.25]} />
        <meshStandardMaterial color="#2a2420" roughness={1} />
      </mesh>
      {/* Capstone */}
      <mesh position={[0, 1.92, 0]}>
        <coneGeometry args={[0.18, 0.28, 4]} />
        <meshStandardMaterial color={stoneColor(seed + 99, material)} flatShading />
      </mesh>
    </group>
  )
}

export function ObeliskMesh({ material = 'limestone', seed = 1 }) {
  const color = stoneColor(seed, material)
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.55, 0.24, 0.55]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.28, 2.6, 0.28]} />
        <meshStandardMaterial color={stoneColor(seed + 1, material)} roughness={0.88} />
      </mesh>
      <mesh position={[0, 2.95, 0]}>
        <coneGeometry args={[0.2, 0.35, 4]} />
        <meshStandardMaterial color="#d8c9a0" flatShading />
      </mesh>
      {/* Glyph bands */}
      {[0.7, 1.3, 1.9].map((y, i) => (
        <mesh key={y} position={[0.145, y, 0]}>
          <boxGeometry args={[0.02, 0.35, 0.22]} />
          <meshStandardMaterial color="#6a5840" />
        </mesh>
      ))}
    </group>
  )
}

export function ColumnMesh({ material = 'limestone', seed = 1 }) {
  const color = stoneColor(seed, material)
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.24, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 2.0, 12]} />
        <meshStandardMaterial color={stoneColor(seed + 2, material)} />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.34, 0.28, 0.3, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export function TempleMesh({ detail = 'medium', material = 'limestone', seed = 1 }) {
  const cols = detail === 'high' ? 6 : detail === 'low' ? 4 : 5
  const color = stoneColor(seed, material)
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.3, 2.6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {Array.from({ length: cols }, (_, i) => {
        const x = -1.6 + (i / (cols - 1)) * 3.2
        return (
          <group key={i} position={[x, 0.3, 0.9]}>
            <ColumnMesh material={material} seed={seed + i} />
          </group>
        )
      })}
      {Array.from({ length: cols }, (_, i) => {
        const x = -1.6 + (i / (cols - 1)) * 3.2
        return (
          <group key={`b-${i}`} position={[x, 0.3, -0.9]}>
            <ColumnMesh material={material} seed={seed + 10 + i} />
          </group>
        )
      })}
      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[4.0, 0.28, 2.5]} />
        <meshStandardMaterial color={stoneColor(seed + 3, material)} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <boxGeometry args={[3.6, 0.45, 0.35]} />
        <meshStandardMaterial color={stoneColor(seed + 4, material)} />
      </mesh>
      {/* Back wall + entrance */}
      <mesh position={[0, 1.4, -1.15]}>
        <boxGeometry args={[3.6, 2.2, 0.2]} />
        <meshStandardMaterial color={stoneColor(seed + 5, material)} />
      </mesh>
      <mesh position={[0, 1.0, -1.0]}>
        <boxGeometry args={[0.7, 1.5, 0.15]} />
        <meshStandardMaterial color="#2c241c" />
      </mesh>
      <group position={[-1.4, 0.3, 1.15]}>
        <StatueMesh seed={seed + 20} material={material} />
      </group>
      <group position={[1.4, 0.3, 1.15]}>
        <StatueMesh seed={seed + 21} material={material} />
      </group>
    </group>
  )
}

export function StatueMesh({ material = 'limestone', seed = 1 }) {
  const color = stoneColor(seed, material)
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.45, 1.0, 0.35]} />
        <meshStandardMaterial color={stoneColor(seed + 1, material)} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.32, 0.35, 0.32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={stoneColor(seed + 2, material)} />
      </mesh>
    </group>
  )
}

export function PalmTreeMesh({ seed = 1 }) {
  const lean = (hash01(seed, 1) - 0.5) * 0.15
  return (
    <group rotation={[0, hash01(seed, 2) * Math.PI, lean]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 2.2, 8]} />
        <meshStandardMaterial color="#6b4f2a" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const ang = (i / 7) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * 0.35, 2.15, Math.sin(ang) * 0.35]}
            rotation={[0.9, ang, 0]}
          >
            <boxGeometry args={[0.12, 0.02, 0.9]} />
            <meshStandardMaterial color="#3f8f45" />
          </mesh>
        )
      })}
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#2f6b34" />
      </mesh>
    </group>
  )
}

export function DesertDuneMesh({ seed = 1 }) {
  const s = 1.2 + hash01(seed, 1) * 0.8
  return (
    <mesh scale={[s, 0.45 + hash01(seed, 2) * 0.35, s * 0.7]} position={[0, 0.2, 0]} rotation={[0, hash01(seed, 3) * Math.PI, 0]}>
      <sphereGeometry args={[1.2, 16, 12]} />
      <meshStandardMaterial color="#d2b48c" roughness={1} />
    </mesh>
  )
}

export function StoneWallMesh({ material = 'sandstone', seed = 1, detail = 'medium' }) {
  const blocks = detail === 'high' ? 5 : 3
  return (
    <group>
      {Array.from({ length: blocks }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[(col - 1.5) * 0.55 + (row % 2) * 0.15, 0.25 + row * 0.42, 0]}
          >
            <boxGeometry args={[0.5, 0.38, 0.35]} />
            <meshStandardMaterial color={stoneColor(seed + row * 4 + col, material)} roughness={0.95} />
          </mesh>
        ))
      )}
    </group>
  )
}

export function HieroglyphicPanelMesh({ seed = 1 }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 1.6, 0.12]} />
        <meshStandardMaterial color="#c4b08c" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.35 + (i % 3) * 0.35, 0.5 - Math.floor(i / 3) * 0.35, 0.07]}>
          <boxGeometry args={[0.18, 0.12, 0.04]} />
          <meshStandardMaterial color="#5a4830" />
        </mesh>
      ))}
    </group>
  )
}

export function TorchMesh({ seed = 1 }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.0, 8]} />
        <meshStandardMaterial color="#5a3b22" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#ff9a3c" emissive="#ff6a00" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0, 1.1, 0]} intensity={0.8} distance={6} color="#ffb070" />
    </group>
  )
}

export function AncientDoorMesh({ material = 'limestone', seed = 1 }) {
  const color = stoneColor(seed, material)
  return (
    <group>
      <mesh position={[-0.7, 1.1, 0]}>
        <boxGeometry args={[0.3, 2.2, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.7, 1.1, 0]}>
        <boxGeometry args={[0.3, 2.2, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[1.7, 0.3, 0.45]} />
        <meshStandardMaterial color={stoneColor(seed + 1, material)} />
      </mesh>
      <mesh position={[0, 1.0, 0.05]}>
        <boxGeometry args={[1.0, 1.8, 0.12]} />
        <meshStandardMaterial color="#3a2c20" />
      </mesh>
    </group>
  )
}

export function SpaceshipMesh({ seed = 1 }) {
  return (
    <group rotation={[0.1, hash01(seed, 1) * Math.PI, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.45, 2.4, 12]} />
        <meshStandardMaterial color="#d0d6e0" metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[1.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.45, 0.8, 10]} />
        <meshStandardMaterial color="#9aa3b2" metalness={0.4} />
      </mesh>
      <mesh position={[-0.2, 0, 0]}>
        <boxGeometry args={[0.2, 1.4, 0.08]} />
        <meshStandardMaterial color="#7a8494" metalness={0.5} />
      </mesh>
      <mesh position={[-1.0, 0, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color="#7ec8ff" emissive="#245a80" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

export function SpaceStationMesh({ seed = 1 }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.16, 10, 40]} />
        <meshStandardMaterial color="#b8c0cc" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, 2.4, 12]} />
        <meshStandardMaterial color="#9aa3b0" metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.35, 12, 10]} />
        <meshStandardMaterial color="#7ec8ff" emissive="#245a80" emissiveIntensity={0.45} />
      </mesh>
    </group>
  )
}

export function PlanetMesh({ seed = 1, material }) {
  const colors = ['#c09060', '#8eb4d8', '#c76b6b', '#d2c39a', '#7aa6c2']
  const color = material === 'ice' ? '#cfe8ff' : colors[Math.floor(hash01(seed, 1) * colors.length)]
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {hash01(seed, 2) > 0.65 ? (
        <mesh rotation={[Math.PI / 2.5, 0.2, 0]}>
          <torusGeometry args={[1.45, 0.06, 8, 48]} />
          <meshBasicMaterial color="#d8c8a0" transparent opacity={0.7} />
        </mesh>
      ) : null}
    </group>
  )
}

export function AsteroidMesh({ seed = 1 }) {
  return (
    <mesh rotation={[hash01(seed, 1), hash01(seed, 2), hash01(seed, 3)]} scale={0.7 + hash01(seed, 4) * 0.8}>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#7a7670" flatShading roughness={1} />
    </mesh>
  )
}

export function LanderMesh() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.9, 8]} />
        <meshStandardMaterial color="#c5cad3" metalness={0.5} />
      </mesh>
      {[-0.7, 0.7].flatMap((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.35, z]} rotation={[0.25 * Math.sign(z), 0, -0.25 * Math.sign(x)]}>
            <cylinderGeometry args={[0.05, 0.05, 1.1, 6]} />
            <meshStandardMaterial color="#8a909a" />
          </mesh>
        ))
      )}
    </group>
  )
}

export function TreeMesh({ seed = 1 }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 6]} />
        <meshStandardMaterial color="#5a3b22" />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.85, 1.8, 7]} />
        <meshStandardMaterial color="#2f6b3a" />
      </mesh>
    </group>
  )
}

export function CoralMesh({ seed = 1 }) {
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => {
        const h = 0.6 + hash01(seed, i) * 1.4
        return (
          <mesh
            key={i}
            position={[(hash01(seed, i + 3) - 0.5) * 1.2, h / 2, (hash01(seed, i + 7) - 0.5) * 1.2]}
          >
            <cylinderGeometry args={[0.08 + hash01(seed, i + 9) * 0.1, 0.16, h, 6]} />
            <meshStandardMaterial color={i % 2 ? '#37d6c8' : '#ff7eb0'} />
          </mesh>
        )
      })}
    </group>
  )
}

export function HabitatMesh() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 1.8, 16]} />
        <meshStandardMaterial color="#6f8fa8" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.85, 16, 12]} />
        <meshStandardMaterial color="#9fd0e8" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

export function RuinsMesh({ material = 'limestone', seed = 1 }) {
  return (
    <group>
      <mesh position={[-0.8, 1, 0]}>
        <boxGeometry args={[0.4, 2, 0.4]} />
        <meshStandardMaterial color={stoneColor(seed, material)} />
      </mesh>
      <mesh position={[0.8, 1, 0]}>
        <boxGeometry args={[0.4, 2, 0.4]} />
        <meshStandardMaterial color={stoneColor(seed + 1, material)} />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[2.2, 0.35, 0.45]} />
        <meshStandardMaterial color={stoneColor(seed + 2, material)} />
      </mesh>
    </group>
  )
}

export function CastleTowerMesh({ seed = 1 }) {
  return (
    <group>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.9, 1.05, 3, 10]} />
        <meshStandardMaterial color="#8a8580" />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 0.4, 10]} />
        <meshStandardMaterial color="#7a7570" />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.95, 3.55, Math.sin(a) * 0.95]}>
            <boxGeometry args={[0.28, 0.4, 0.28]} />
            <meshStandardMaterial color="#6f6a65" />
          </mesh>
        )
      })}
    </group>
  )
}

export function CrateMesh({ seed = 1 }) {
  return (
    <mesh position={[0, 0.35, 0]}>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial color="#6b5a3a" />
    </mesh>
  )
}

export function ConsoleMesh() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.9, 0.6]} />
        <meshStandardMaterial color="#3a4050" metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.85, 0.05]}>
        <boxGeometry args={[0.9, 0.08, 0.45]} />
        <meshStandardMaterial color="#5ad0ff" emissive="#1a80a0" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export function RockMesh({ seed = 1 }) {
  return (
    <mesh rotation={[0, hash01(seed, 1) * Math.PI, 0]} scale={0.7 + hash01(seed, 2) * 0.8} position={[0, 0.25, 0]}>
      <dodecahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial color="#7a7670" flatShading />
    </mesh>
  )
}

export function BoxMesh({ color = '#888888' }) {
  return (
    <mesh position={[0, 0.45, 0]}>
      <boxGeometry args={[0.9, 0.9, 0.9]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export function SphereMesh({ color = '#888888' }) {
  return (
    <mesh position={[0, 0.45, 0]}>
      <sphereGeometry args={[0.45, 24, 24]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
