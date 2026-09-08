import { EnvironmentUI } from '../ui/EnvironmentUI.jsx'
import { WorldPrompt } from './WorldPrompt/WorldPrompt.jsx'
import { SceneAtmosphere } from './SceneAtmosphere.jsx'

export function Overlay({ store }) {
  return (
    <div className="overlay">
      <SceneAtmosphere />
      <EnvironmentUI store={store} />
      <WorldPrompt />
      <div className="reticle" aria-hidden="true" />
    </div>
  )
}
