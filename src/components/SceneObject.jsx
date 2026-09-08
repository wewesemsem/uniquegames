import { InteractiveObject } from './InteractiveObject.jsx'
import { ProceduralObject } from './ProceduralObject.jsx'

/**
 * Data-driven mesh. Semantic types become procedural Three.js assemblies;
 * interactive boxes/spheres keep the shared interaction path.
 * Scene-aware interactions attach via `interactive` + `interactions`.
 */
export function SceneObject(props) {
  const {
    id,
    type = 'box',
    kind,
    position = [0, 0.5, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    color = '#888888',
    material,
    detail,
    params,
    animation = null,
    interactive = false,
    interactions = null,
  } = props

  if (kind === 'procedural' || (type !== 'box' && type !== 'sphere') || interactions?.length) {
    return (
      <ProceduralObject
        id={id}
        type={type}
        position={position}
        scale={scale}
        rotation={rotation}
        material={material}
        detail={detail}
        color={color}
        params={params}
        animation={animation}
        interactive={interactive || Boolean(interactions?.length)}
        interactions={interactions}
        tags={props.tags}
        category={props.category}
        form={props.form}
      />
    )
  }

  if (interactive) {
    return (
      <InteractiveObject
        id={id}
        type={type === 'sphere' ? 'sphere' : 'box'}
        position={position}
        restColor={color}
      />
    )
  }

  return (
    <mesh position={position} scale={scale} raycast={() => null}>
      {type === 'sphere' ? <sphereGeometry args={[0.45, 24, 24]} /> : <boxGeometry args={[0.9, 0.9, 0.9]} />}
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
