import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { interactionManager } from '../interaction/InteractionManager.js'

/**
 * One object that can be selected from any input path:
 * - Desktop: click / tap (R3F pointer events) or aim with the camera and press E/Enter
 * - VR: point with a controller ray (same onClick) or press the controller trigger
 *
 * `pointerEventsType={{ deny: 'grab' }}` keeps XR pointing as a select, not a grab.
 */
export function InteractiveObject({
  id,
  position = [0, 0.5, -2],
  type = 'box',
  restColor = '#e85d4c',
  activeColor = '#f2c14e',
}) {
  const meshRef = useRef(null)
  const [active, setActive] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [targeted, setTargeted] = useState(false)
  const interactRef = useRef(() => {})

  interactRef.current = () => {
    setActive((value) => !value)
  }

  useEffect(() => {
    interactionManager.register(id, {
      getObject: () => meshRef.current,
      interact: () => interactRef.current(),
    })
    return () => interactionManager.unregister(id)
  }, [id])

  useFrame(() => {
    const isTarget = interactionManager.getTargetId() === id
    if (isTarget !== targeted) {
      setTargeted(isTarget)
    }
  })

  function handlePointerOver(event) {
    event.stopPropagation()
    setHovered(true)
    interactionManager.setTarget(id)
  }

  function handlePointerOut(event) {
    event.stopPropagation()
    setHovered(false)
  }

  function handlePointerDown(event) {
    event.stopPropagation()
    interactionManager.setTarget(id)
    interactionManager.interactId(id)
  }

  const highlighted = hovered || targeted

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      pointerEventsType={{ deny: 'grab' }}
      scale={highlighted ? 1.08 : 1}
    >
      {type === 'sphere' ? <sphereGeometry args={[0.45, 28, 28]} /> : <boxGeometry args={[0.9, 0.9, 0.9]} />}
      <meshStandardMaterial
        color={active ? activeColor : restColor}
        emissive={highlighted ? '#ffffff' : '#000000'}
        emissiveIntensity={highlighted ? 0.18 : 0}
      />
    </mesh>
  )
}
