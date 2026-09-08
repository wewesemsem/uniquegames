import { useMemo } from 'react'
import { hash01 } from './hash.js'
import {
  descriptorBaseColor,
  scaleHintMultiplier,
  sanitizeGenericDescriptor,
} from './GenericDescriptor.js'

/**
 * Level-2 generic procedural object.
 * Builds plausible meshes from safe category/form/material/behavior params —
 * no per-species generator required (mushrooms, crystals, floating spires, …).
 */
export function GenericProceduralMesh({ seed = 1, params = {}, color: colorOverride }) {
  const descriptor = useMemo(
    () => sanitizeGenericDescriptor(params.descriptor ?? params),
    [params]
  )
  const { appearance, geometry, behavior, form, category } = descriptor
  const primary = form || geometry.primary_form
  const baseColor = colorOverride || descriptorBaseColor(appearance)
  const mul = scaleHintMultiplier(appearance.scale_hint)
  const h = geometry.height * 0.35 * mul
  const w = geometry.width * 0.35 * mul
  const emissive = appearance.emission > 0.05 ? baseColor : '#000000'
  const emissiveIntensity = appearance.emission * 1.4
  const transparent = appearance.transparency > 0.05
  const opacity = transparent ? 1 - appearance.transparency * 0.7 : 1
  const mat = {
    color: baseColor,
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
  }

  const instances = Math.min(behavior.count || 1, behavior.clustered ? 8 : 1)

  const parts = useMemo(() => {
    const items = []
    for (let i = 0; i < instances; i += 1) {
      const ox = instances === 1 ? 0 : (hash01(seed, i * 3 + 1) - 0.5) * w * 2.2
      const oz = instances === 1 ? 0 : (hash01(seed, i * 3 + 2) - 0.5) * w * 2.2
      const s = 0.75 + hash01(seed, i * 3 + 3) * 0.5
      items.push({ key: i, ox, oz, s })
    }
    return items
  }, [instances, seed, w])

  const floatY = behavior.floating ? 1.2 + hash01(seed, 99) * 1.5 : 0

  return (
    <group position={[0, floatY, 0]}>
      {parts.map((p) => (
        <group key={p.key} position={[p.ox, 0, p.oz]} scale={p.s}>
          <FormPrimitive
            form={primary}
            category={category}
            h={h}
            w={w}
            facets={geometry.facets}
            seed={seed + p.key}
            mat={mat}
          />
        </group>
      ))}
    </group>
  )
}

function FormPrimitive({ form, category, h, w, facets, seed, mat }) {
  if (form === 'mushroom') {
    const stemH = h * 0.9
    const capR = Math.max(w * 0.85, 0.25)
    return (
      <group>
        <mesh position={[0, stemH / 2, 0]}>
          <cylinderGeometry args={[w * 0.12, w * 0.18, stemH, 8]} />
          <meshStandardMaterial {...mat} color={mat.emissiveIntensity > 0 ? '#c8b8e8' : '#d9c4a8'} />
        </mesh>
        <mesh position={[0, stemH + capR * 0.35, 0]}>
          <sphereGeometry args={[capR, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        {mat.emissiveIntensity > 0 ? (
          <mesh position={[0, stemH + capR * 0.2, 0]}>
            <sphereGeometry args={[capR * 0.35, 8, 8]} />
            <meshStandardMaterial color={mat.color} emissive={mat.color} emissiveIntensity={mat.emissiveIntensity * 1.2} />
          </mesh>
        ) : null}
      </group>
    )
  }

  if (form === 'crystalline' || form === 'crystal' || category === 'crystalline') {
    const count = 3 + Math.floor(hash01(seed, 1) * 4)
    return (
      <group>
        {Array.from({ length: count }, (_, i) => {
          const hh = h * (0.5 + hash01(seed, i + 2) * 0.9)
          const ww = w * (0.15 + hash01(seed, i + 5) * 0.2)
          const a = (i / count) * Math.PI * 2
          const r = w * 0.25 * hash01(seed, i + 8)
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, hh / 2, Math.sin(a) * r]}
              rotation={[0, a, (hash01(seed, i + 11) - 0.5) * 0.35]}
            >
              <octahedronGeometry args={[ww, 0]} />
              <meshStandardMaterial {...mat} />
            </mesh>
          )
        })}
      </group>
    )
  }

  if (form === 'spire' || form === 'tower') {
    return (
      <group>
        <mesh position={[0, h * 0.55, 0]}>
          <cylinderGeometry args={[w * 0.15, w * 0.35, h * 1.1, Math.max(5, Math.min(facets, 12))]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, h * 1.15, 0]}>
          <coneGeometry args={[w * 0.22, h * 0.45, 6]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>
    )
  }

  if (form === 'dome') {
    return (
      <mesh position={[0, w * 0.35, 0]}>
        <sphereGeometry args={[w * 0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    )
  }

  if (form === 'arch') {
    return (
      <group>
        <mesh position={[-w * 0.45, h * 0.5, 0]}>
          <boxGeometry args={[w * 0.2, h, w * 0.2]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[w * 0.45, h * 0.5, 0]}>
          <boxGeometry args={[w * 0.2, h, w * 0.2]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, h * 0.95, 0]}>
          <boxGeometry args={[w * 1.1, w * 0.2, w * 0.25]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>
    )
  }

  if (form === 'ring') {
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h * 0.4, 0]}>
        <torusGeometry args={[w * 0.55, w * 0.12, 8, 20]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    )
  }

  if (form === 'tree_like') {
    return (
      <group>
        <mesh position={[0, h * 0.45, 0]}>
          <cylinderGeometry args={[w * 0.08, w * 0.12, h * 0.9, 6]} />
          <meshStandardMaterial color="#5a3b22" roughness={0.9} />
        </mesh>
        <mesh position={[0, h * 1.0, 0]}>
          <icosahedronGeometry args={[w * 0.55, 0]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>
    )
  }

  if (form === 'rock' || category === 'rock_formation') {
    return (
      <mesh rotation={[0, hash01(seed, 2) * Math.PI, 0]} position={[0, h * 0.25, 0]} scale={[1, 0.8 + hash01(seed, 3) * 0.5, 1]}>
        <dodecahedronGeometry args={[w * 0.55, 0]} />
        <meshStandardMaterial {...mat} flatShading />
      </mesh>
    )
  }

  if (form === 'block' || category === 'structure' || category === 'floating_structure') {
    return (
      <group>
        <mesh position={[0, h * 0.4, 0]}>
          <boxGeometry args={[w, h * 0.8, w * 0.85]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, h * 0.95, 0]}>
          <boxGeometry args={[w * 0.7, h * 0.35, w * 0.7]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        {category === 'floating_structure' || form === 'crystalline' ? (
          <mesh position={[0, h * 1.35, 0]}>
            <octahedronGeometry args={[w * 0.25, 0]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        ) : null}
      </group>
    )
  }

  if (form === 'sphere') {
    return (
      <mesh position={[0, w * 0.45, 0]}>
        <sphereGeometry args={[w * 0.45, 16, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    )
  }

  if (form === 'cluster') {
    return (
      <group>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh
            key={i}
            position={[
              (hash01(seed, i) - 0.5) * w,
              hash01(seed, i + 4) * h * 0.6,
              (hash01(seed, i + 8) - 0.5) * w,
            ]}
          >
            <sphereGeometry args={[w * (0.15 + hash01(seed, i + 12) * 0.2), 8, 8]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        ))}
      </group>
    )
  }

  // organic / blob default
  return (
    <group>
      <mesh position={[0, h * 0.35, 0]}>
        <cylinderGeometry args={[w * 0.08, w * 0.12, h * 0.7, 6]} />
        <meshStandardMaterial color="#6a8f5a" roughness={0.85} />
      </mesh>
      <mesh position={[0, h * 0.85, 0]} scale={[1, 0.8, 1]}>
        <icosahedronGeometry args={[w * 0.45, 0]} />
        <meshStandardMaterial {...mat} flatShading />
      </mesh>
    </group>
  )
}
