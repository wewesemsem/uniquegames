import { useSyncExternalStore } from 'react'
import { EnvironmentUI } from '../ui/EnvironmentUI.jsx'
import { interactionManager } from '../interaction/InteractionManager.js'
import { WorldPrompt } from './WorldPrompt/WorldPrompt.jsx'
import { SceneAtmosphere } from './SceneAtmosphere.jsx'
import { OnboardingTutorial } from './OnboardingTutorial.jsx'
import { RoomProgressBanner } from './RoomProgressBanner.jsx'

function useInteractionTarget() {
  return useSyncExternalStore(
    interactionManager.subscribe,
    () => interactionManager.getTargetId(),
    () => null
  )
}

export function Overlay({ store }) {
  const targetId = useInteractionTarget()
  const targeting = Boolean(targetId)

  return (
    <div className="overlay">
      <SceneAtmosphere />
      <EnvironmentUI store={store} />
      <RoomProgressBanner />
      <WorldPrompt />
      <OnboardingTutorial />
      <div className={targeting ? 'reticle is-targeting' : 'reticle'} aria-hidden="true" />
      {targeting ? (
        <p className="interact-hint" aria-live="polite">
          Click or press E
        </p>
      ) : null}
    </div>
  )
}
