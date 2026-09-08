import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide } from 'three'
import { useEnvironment } from '../navigation/EnvironmentManager.jsx'

/**
 * Fade sphere that follows the camera so it covers the view in both web and VR.
 */
export function EnvironmentTransition() {
  const { fade } = useEnvironment()
  const meshRef = useRef(null)
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position)
    }
  })

  if (fade <= 0.001) {
    return null
  }

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[8, 16, 12]} />
      <meshBasicMaterial
        color="#05060a"
        transparent
        opacity={fade}
        side={BackSide}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
