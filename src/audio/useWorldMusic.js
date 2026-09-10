import { useEffect, useState } from 'react'
import { getWorldMusicEngine } from './worldMusicEngine.js'

/**
 * Subscribe to the shared world music engine — only UI state changes notify React.
 */
export function useWorldMusic() {
  const engine = getWorldMusicEngine()
  const [state, setState] = useState(() => engine.getState())

  useEffect(() => engine.subscribe(setState), [engine])

  return {
    playing: state.playing,
    muted: state.muted,
    unlocked: state.unlocked,
    mood: state.mood,
    reducedMotion: state.reducedMotion,
    play: () => engine.play(),
    pause: () => engine.pause(),
    togglePlay: () => engine.togglePlay(),
    toggleMute: () => engine.toggleMute(),
    setMood: (mood) => engine.setMood(mood),
    playForMood: (mood) => engine.playForMood(mood),
  }
}
