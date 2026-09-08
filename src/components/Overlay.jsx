import { EnvironmentUI } from '../ui/EnvironmentUI.jsx'
import { WorldPrompt } from './WorldPrompt/WorldPrompt.jsx'
import { SceneAtmosphere } from './SceneAtmosphere.jsx'
import { OnboardingTutorial } from './OnboardingTutorial.jsx'

export function Overlay({ store }) {
  return (
    <div className="overlay">
      <SceneAtmosphere />
      <EnvironmentUI store={store} />
      <WorldPrompt />
      <OnboardingTutorial />
      <div className="reticle" aria-hidden="true" />
    </div>
  )
}
