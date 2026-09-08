import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { DEFAULT_SCENE_CONFIGURATION } from '../world/SceneConfiguration.js'
import { generateEquirectangularPanorama, panoramaCacheKey } from '../procedural/equirectGenerator.js'

const SPHERE_RADIUS = 500

/** Keep a few room textures so navigating between the 3 rooms is instant. */
const textureCache = new Map()
const MAX_CACHE = 6

function remember(key, texture) {
  if (textureCache.has(key)) {
    textureCache.delete(key)
  }
  textureCache.set(key, texture)
  while (textureCache.size > MAX_CACHE) {
    const oldest = textureCache.keys().next().value
    const old = textureCache.get(oldest)
    textureCache.delete(oldest)
    old?.dispose?.()
  }
}

/**
 * p5.js procedural equirectangular → Three.js CanvasTexture → inverted sphere.
 * Same spatial role as Panorama.jsx; generation is procedural instead of image URL.
 */
export function ProceduralPanorama({ config, onLoad, onError }) {
  const scene = config ?? DEFAULT_SCENE_CONFIGURATION
  const cacheKey = useMemo(() => panoramaCacheKey(scene), [scene])
  const meshRef = useRef(null)
  const camera = useThree((state) => state.camera)
  const [texture, setTexture] = useState(null)
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  const sceneRef = useRef(scene)
  onLoadRef.current = onLoad
  onErrorRef.current = onError
  sceneRef.current = scene

  useEffect(() => {
    let cancelled = false
    const key = cacheKey
    const cached = textureCache.get(key)
    if (cached) {
      setTexture(cached)
      onLoadRef.current?.()
      return undefined
    }

    setTexture(null)
    generateEquirectangularPanorama(sceneRef.current)
      .then((canvas) => {
        if (cancelled) {
          return
        }
        const map = new CanvasTexture(canvas)
        map.colorSpace = SRGBColorSpace
        map.minFilter = LinearFilter
        map.magFilter = LinearFilter
        map.generateMipmaps = false
        map.needsUpdate = true
        remember(key, map)
        setTexture(map)
        onLoadRef.current?.()
      })
      .catch((error) => {
        if (!cancelled) {
          setTexture(null)
          onErrorRef.current?.(error instanceof Error ? error.message : 'Procedural panorama failed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position)
    }
  })

  if (!texture) {
    return null
  }

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1000} raycast={() => null}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 32]} />
      <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} depthWrite={false} depthTest={false} />
    </mesh>
  )
}
