import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, Cache, LinearFilter, SRGBColorSpace, TextureLoader } from 'three'

const SPHERE_RADIUS = 500
const loader = new TextureLoader()
const textureCache = new Map()

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadOnce(src) {
  const cached = textureCache.get(src)
  if (cached) {
    return Promise.resolve(cached)
  }

  Cache.remove(src)
  return new Promise((resolve, reject) => {
    loader.load(
      src,
      (map) => {
        if (!map?.image || map.image.width < 2 || map.image.height < 2) {
          reject(new Error(`Invalid panorama image: ${src}`))
          return
        }
        map.colorSpace = SRGBColorSpace
        map.minFilter = LinearFilter
        map.magFilter = LinearFilter
        map.generateMipmaps = true
        map.anisotropy = 4
        map.needsUpdate = true
        textureCache.set(src, map)
        resolve(map)
      },
      undefined,
      () => reject(new Error(`Failed to load panorama: ${src}`))
    )
  })
}

async function loadEquirect(src) {
  let lastError = null
  const attempts = src.includes('/generated/') ? 5 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await loadOnce(src)
    } catch (error) {
      lastError = error
      textureCache.delete(src)
      Cache.remove(src)
      if (attempt < attempts - 1) {
        await wait(200 * (attempt + 1))
      }
    }
  }
  throw lastError ?? new Error(`Failed to load panorama: ${src}`)
}

/**
 * 360° backdrop: inverted sphere around the player.
 * Position follows the camera so walking never hits the sphere wall.
 * Does not write depth, so the grid and 3D objects stay in front.
 */
export function Panorama({ src, onLoad, onError }) {
  const meshRef = useRef(null)
  const camera = useThree((state) => state.camera)
  const [texture, setTexture] = useState(() => textureCache.get(src) ?? null)
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  onLoadRef.current = onLoad
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false

    if (!src) {
      setTexture(null)
      onErrorRef.current?.('Missing panorama source.')
      return undefined
    }

    const existing = textureCache.get(src)
    if (existing) {
      setTexture(existing)
      onLoadRef.current?.()
      return undefined
    }

    setTexture(null)
    loadEquirect(src)
      .then((map) => {
        if (!cancelled) {
          setTexture(map)
          onLoadRef.current?.()
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTexture(null)
          onErrorRef.current?.(error instanceof Error ? error.message : `Failed to load panorama: ${src}`)
        }
      })

    return () => {
      cancelled = true
    }
  }, [src])

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
