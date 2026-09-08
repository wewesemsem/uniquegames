import { Grid } from '@react-three/drei'

const GROUND_COLORS = {
  grass: '#3f7a45',
  sand: '#c2a46b',
  rock: '#6d6a66',
  snow: '#e8eef5',
  water: '#2a6f8f',
  dirt: '#6b4f33',
  metal: '#5a6270',
  lunar: '#9a9894',
  none: null,
}

/**
 * Shared 3D world layer: lights, floor, grid.
 * openSky / ground=none: no opaque slab so 360° meadow/sky shows through.
 * softGrid: shorter, fainter locomotion grid (playground).
 */
export function World({ fog = true, openSky = false, ground, softGrid = false }) {
  const groundColor = GROUND_COLORS[ground] ?? (openSky ? null : '#2b2d38')
  const showFloor = groundColor != null && ground !== 'none'
  const faint = softGrid || (openSky && !showFloor)

  return (
    <>
      {fog ? (
        <>
          <color attach="background" args={['#1a1c24']} />
          <fog attach="fog" args={['#1a1c24', 12, 36]} />
        </>
      ) : (
        <color attach="background" args={openSky ? ['#87b7ff'] : ['#05060a']} />
      )}

      <ambientLight intensity={openSky ? 0.7 : 0.45} />
      <hemisphereLight args={openSky ? ['#c9e6ff', groundColor || '#6a9a55', 0.65] : ['#c9d6ff', '#3b3834', 0.4]} />
      <directionalLight position={[6, 10, 4]} intensity={openSky ? 1.05 : 1.25} />

      {showFloor ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow raycast={() => null}>
          <circleGeometry args={[openSky ? 55 : 40, 64]} />
          <meshStandardMaterial color={groundColor} roughness={0.95} />
        </mesh>
      ) : null}

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={faint ? 0.2 : 0.6}
        cellColor={faint ? '#ffffff' : '#4a4d5c'}
        sectionSize={5}
        sectionThickness={faint ? 0.35 : 1.1}
        sectionColor={faint ? '#d8f59a' : '#7c5cff'}
        fadeDistance={faint ? 10 : 28}
        fadeStrength={faint ? 2.6 : 1.2}
        infiniteGrid
        position={[0, 0.02, 0]}
        raycast={() => null}
      />
    </>
  )
}
