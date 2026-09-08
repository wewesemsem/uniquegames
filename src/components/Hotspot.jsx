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

  useFrame(() => {
    const isTarget = interactionManager.getTargetId() === id
    if (isTarget !== targeted) {
      setTargeted(isTarget)
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
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHovered(false)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          interactionManager.setTarget(id)
          interactionManager.interactId(id)
        }}
        pointerEventsType={{ deny: 'grab' }}
        scale={highlighted ? 1.18 : 1}
      >
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshBasicMaterial color={highlighted ? '#f4ff9a' : '#c9f07d'} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.28, 0.018, 8, 24]} />
        <meshBasicMaterial color={highlighted ? '#ffffff' : '#9be7ff'} />
      </mesh>
      {label ? (
        <Billboard position={[0, 0.42, 0]} follow>
          <Text
            fontSize={0.16}
            color="#f4f6fb"
            outlineWidth={0.012}
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
