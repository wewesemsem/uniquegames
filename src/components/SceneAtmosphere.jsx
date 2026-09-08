import { useEnvironment } from '../navigation/EnvironmentManager.jsx'

/**
 * CSS atmosphere overlay driven by validated SceneConfiguration.
 * The LLM never injects CSS — only enum/number params map to class names.
 */
export function SceneAtmosphere() {
  const { current } = useEnvironment()
  const scene = current?.procedural
  if (!scene) {
    return null
  }

  const classes = [
    'scene-atmosphere',
    `mood-${scene.colorMood || 'neutral'}`,
    `light-${scene.lightingStyle || 'neutral'}`,
    scene.environment === 'space' || scene.sky === 'stars' || scene.sky === 'nebula' ? 'is-space' : '',
    scene.sky === 'underwater' || scene.environment === 'ocean' ? 'is-underwater' : '',
    scene.environment === 'egypt' || scene.environment === 'desert' ? 'is-desert' : '',
    (scene.effects ?? []).includes('heat_haze') ? 'has-heat-haze' : '',
    (scene.effects ?? []).includes('godrays') ? 'has-godrays' : '',
    (scene.effects ?? []).includes('aurora') ? 'has-aurora' : '',
    scene.nebula > 0.5 ? 'has-nebula' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      aria-hidden="true"
      style={{
        '--fog-strength': String(scene.fog ?? 0.2),
        '--nebula-strength': String(scene.nebula ?? 0),
        '--anim-speed': String(0.5 + (scene.animationSpeed ?? 0.35)),
      }}
    />
  )
}
