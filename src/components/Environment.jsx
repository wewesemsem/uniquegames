import { useEffect, useMemo } from 'react'
import { World } from './World.jsx'
import { Panorama } from './Panorama.jsx'
import { ProceduralPanorama } from './ProceduralPanorama.jsx'
import { LiveMeadowPanorama } from './LiveMeadowPanorama.jsx'
import { Hotspot } from './Hotspot.jsx'
import { SceneObject } from './SceneObject.jsx'
import { AmbientAnimation } from './AmbientAnimation.jsx'
import { ReactionLayer, SceneInteractionSystem } from '../interaction/ReactionLayer.jsx'
import { playerPose } from '../navigation/playerPose.js'
import { environmentStore, navigateTo, useEnvironment } from '../navigation/EnvironmentManager.jsx'

/**
 * Shared scene graph for desktop, mobile, and WebXR:
 *   360° panorama + World + objects + hotspots
 *   + mandatory ambient / object animation from the scene Animation spec
 *   + scene-aware interactions → procedural reactions
 */
export function Environment() {
  const { current, currentId } = useEnvironment()
  const isPlayground = currentId === 'playground'
  const hasProcedural = Boolean(current?.procedural) && !isPlayground
  const hasPanorama = Boolean(current?.panorama) && !hasProcedural && !isPlayground
  const hasSky = isPlayground || hasProcedural || hasPanorama
  const ground = isPlayground ? 'none' : current?.procedural?.ground
  const openSky =
    isPlayground ||
    ground === 'sand' ||
    ground === 'lunar' ||
    ground === 'none' ||
    ground === 'water' ||
    current?.procedural?.environment === 'space' ||
    current?.procedural?.environment === 'egypt' ||
    current?.procedural?.environment === 'ocean'

  const objects = current?.objects ?? []
  const interactions = current?.interactions
  const playerPositionRef = useMemo(() => ({ current: playerPose }), [])

  useEffect(() => {
    if (current && !hasSky) {
      environmentStore.onPanoramaReady(currentId)
    }
  }, [current, currentId, hasSky])

  if (!current) {
    return <World />
  }

  return (
    <>
      <World fog={!hasSky} openSky={openSky} ground={ground} softGrid={isPlayground} />
      {isPlayground ? (
        <LiveMeadowPanorama
          key="playground:meadow"
          onLoad={() => environmentStore.onPanoramaReady(currentId)}
          onError={(message) => environmentStore.onPanoramaError(currentId, message)}
        />
      ) : null}
      {hasProcedural ? (
        <ProceduralPanorama
          key={`${currentId}:procedural`}
          config={current.procedural}
          onLoad={() => environmentStore.onPanoramaReady(currentId)}
          onError={(message) => environmentStore.onPanoramaError(currentId, message)}
        />
      ) : null}
      {hasPanorama ? (
        <Panorama
          key={`${currentId}:${current.panorama}`}
          src={current.panorama}
          onLoad={() => environmentStore.onPanoramaReady(currentId)}
          onError={(message) => environmentStore.onPanoramaError(currentId, message)}
        />
      ) : null}
      {!isPlayground ? (
        <AmbientAnimation animation={current.animation} composition={current.composition} />
      ) : null}
      {!isPlayground ? (
        <SceneInteractionSystem
          roomId={currentId}
          interactions={interactions}
          objects={objects}
          playerPositionRef={playerPositionRef}
        />
      ) : null}
      {!isPlayground ? <ReactionLayer /> : null}
      {objects.map((object, index) => (
        <SceneObject key={object.id ?? `${object.type}-${index}`} {...object} />
      ))}
      {(current.hotspots ?? []).map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          id={hotspot.id}
          position={hotspot.position}
          label={hotspot.label}
          onSelect={() => navigateTo(hotspot.target)}
        />
      ))}
    </>
  )
}
