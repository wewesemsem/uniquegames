import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { createMeadowPainter } from '../procedural/meadowPainter.js'

const SPHERE_RADIUS = 500

/**
 * Live p5 meadow → CanvasTexture → inverted 360° sphere.
 * Continuously animates wind, grass, blooms, and drifting particles
 * (wesamsam-style atmosphere), without replacing Three.js/WebXR.
 */
export function LiveMeadowPanorama({ onLoad, onError }) {
  const meshRef = useRef(null)
  const painterRef = useRef(null)
  const textureRef = useRef(null)
  const timeRef = useRef(0)
  const camera = useThree((state) => state.camera)
  const [texture, setTexture] = useState(null)
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  onLoadRef.current = onLoad
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false
    let painter = null
    let map = null

    createMeadowPainter()
      .then((created) => {
        if (cancelled) {
          created.dispose()
          return
        }
        painter = created
        painterRef.current = created
        // Prime first frame so the sky isn't blank
        created.draw(0)
        map = new CanvasTexture(created.canvas)
        map.colorSpace = SRGBColorSpace
        map.minFilter = LinearFilter
        map.magFilter = LinearFilter
        map.generateMipmaps = false
        map.needsUpdate = true
        textureRef.current = map
        setTexture(map)
        onLoadRef.current?.()
      })
      .catch((error) => {
        if (!cancelled) {
          onErrorRef.current?.(error instanceof Error ? error.message : 'Meadow panorama failed.')
        }
      })

    return () => {
      cancelled = true
      painterRef.current = null
      textureRef.current = null
      map?.dispose?.()
      painter?.dispose?.()
    }
  }, [])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position)
    }

    const painter = painterRef.current
    const map = textureRef.current
    if (!painter || !map) {
      return
    }

    // Paint every frame so pollen/petals drift continuously
    timeRef.current += delta * 1000
    painter.draw(timeRef.current)
    map.needsUpdate = true
  })

  if (!texture) {
    return null
  }

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-10} raycast={() => null}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 32]} />
      <meshBasicMaterial
        map={texture}
        side={BackSide}
        toneMapped={false}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
