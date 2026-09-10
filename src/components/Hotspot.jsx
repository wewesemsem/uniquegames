import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { interactionManager } from '../interaction/InteractionManager.js'

/**
 * 3D hotspot shared by mouse, touch, keyboard (reticle + E/Enter), and VR rays.
 * Position is world space inside the panorama, not a screen coordinate.
 */
export function Hotspot({ id, position, label, onSelect }) {
  const meshRef = useRef(null)
  const ringRef = useRef(null)
  const outerRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [targeted, setTargeted] = useState(false)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    interactionManager.register(id, {
      getObject: () => meshRef.current,
      interact: () => selectRef.current?.(),
    })
    return () => interactionManager.unregister(id)
  }, [id])

  useFrame(({ clock }) => {
    const isTarget = interactionManager.getTargetId() === id
    if (isTarget !== targeted) {
      setTargeted(isTarget)
    }
    const highlighted = hovered || isTarget
    const pulse = 0.5 + Math.sin(clock.elapsedTime * (highlighted ? 4.2 : 2.4)) * 0.5

    if (meshRef.current) {
      const s = (highlighted ? 1.28 : 1.08) + pulse * 0.08
      meshRef.current.scale.setScalar(s)
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * (highlighted ? 1.4 : 0.6)
      const rs = (highlighted ? 1.12 : 1) + pulse * 0.06
      ringRef.current.scale.set(rs, rs, rs)
      if (ringRef.current.material) {
        ringRef.current.material.opacity = highlighted ? 0.95 : 0.65
      }
    }
    if (outerRef.current) {
      outerRef.current.rotation.z = -clock.elapsedTime * 0.8
      const os = 1 + pulse * 0.1
      outerRef.current.scale.set(os, os, os)
      if (outerRef.current.material) {
        outerRef.current.material.opacity = highlighted ? 0.55 : 0.28 + pulse * 0.12
      }
    }
  })

  const highlighted = hovered || targeted

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          interactionManager.setTarget(id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHovered(false)
          document.body.style.cursor = ''
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          interactionManager.setTarget(id)
          interactionManager.interactId(id)
        }}
        pointerEventsType={{ deny: 'grab' }}
      >
        <sphereGeometry args={[0.28, 20, 16]} />
        <meshBasicMaterial color={highlighted ? '#fff4a8' : '#c9f07d'} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.42, 0.04, 10, 36]} />
        <meshBasicMaterial color={highlighted ? '#ffffff' : '#9be7ff'} transparent opacity={0.7} />
      </mesh>
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.62, 0.018, 8, 40]} />
        <meshBasicMaterial color="#c9f07d" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {label ? (
        <Billboard position={[0, 0.62, 0]} follow>
          <Text
            fontSize={0.22}
            color="#f4f6fb"
            outlineWidth={0.018}
            outlineColor="#101218"
            anchorX="center"
            anchorY="middle"
            raycast={() => null}
          >
            {label}
          </Text>
        </Billboard>
      ) : null}
    </group>
  )
}
