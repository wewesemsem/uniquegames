import { InteractiveObject } from './InteractiveObject.jsx'
import { InteractiveTarget } from '../interaction/InteractiveTarget.jsx'
import { getGenerator } from '../procedural/objects/generators.js'
import { hashInt } from '../procedural/objects/hash.js'
import { AnimatedObject } from './AnimatedObject.jsx'

/**
 * Renders a semantic procedural object (pyramid, temple, ship, …)
 * as real Three.js geometry — not a panorama paint.
 * Optional animation behavior from the mandatory scene Animation spec.
 * Interactive targets share desktop / mobile / WebXR input via InteractiveTarget.
 */
export function ProceduralObject({
  id,
  type = 'box',
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  material,
  detail = 'medium',
  color = '#888888',
  params,
  animation = null,
  interactive = false,
  interactions = null,
  ...objectRest
}) {
  if (interactive && (type === 'box' || type === 'sphere') && !interactions?.length) {
    return (
      <InteractiveObject
        id={id}
        type={type === 'sphere' ? 'sphere' : 'box'}
        position={position}
        restColor={color}
      />
    )
  }

  const Generator = getGenerator(type)
  const seed = hashInt(`${id}:${type}`)
  const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale]
  const mergedParams =
    type === 'generic'
      ? { ...(params ?? {}), descriptor: params?.descriptor ?? params }
      : params

  const mesh = <Generator detail={detail} material={material} seed={seed} color={color} params={mergedParams} />
  const object = {
    id,
    type,
    position,
    scale: scaleVec,
    rotation,
    interactions,
    ...objectRest,
  }

  const body = animation ? (
    <AnimatedObject id={id} animation={animation} position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
      {mesh}
    </AnimatedObject>
  ) : (
    mesh
  )

  if (interactive) {
    return (
      <InteractiveTarget
        id={id}
        object={object}
        interactive
        position={position}
        rotation={rotation}
        scale={scaleVec}
      >
        {body}
      </InteractiveTarget>
    )
  }

  return (
    <group position={position} scale={scaleVec} rotation={rotation}>
      {body}
    </group>
  )
}
