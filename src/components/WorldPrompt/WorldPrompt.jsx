import { useEffect, useMemo, useState } from 'react'
import { createVoiceInput, isSpeechRecognitionAvailable } from '../../input/VoiceInput.js'
import { useWorldState, worldStore } from '../../world/WorldState.js'

const BUSY = new Set(['submitting', 'processing', 'resolving', 'generating', 'loading'])

export function WorldPrompt() {
  const world = useWorldState()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const speechAvailable = isSpeechRecognitionAvailable()
  const busy = BUSY.has(world.status)
  const waitSeconds = world.retryUntil ? Math.max(0, Math.ceil((world.retryUntil - nowTick) / 1000)) : 0
  const waiting = waitSeconds > 0

  const voice = useMemo(
    () =>
      createVoiceInput({
        onStart: () => {
          setListening(true)
          setVoiceError(null)
        },
        onEnd: () => setListening(false),
        onResult: (transcript) => {
          setText(transcript)
          setListening(false)
        },
        onError: (error) => {
          setListening(false)
          setVoiceError(error.message)
        },
      }),
    []
  )

  useEffect(() => () => voice.stop(), [voice])

  useEffect(() => {
    if (!world.retryUntil) {
      return undefined
    }
    const id = window.setInterval(() => setNowTick(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [world.retryUntil])

  function submit(event) {
    event?.preventDefault()
    const prompt = text.trim()
    if (!prompt || busy || waiting) {
      return
    }
    worldStore.requestWorld(prompt)
  }

  return (
    <section className="world-prompt" aria-label="World director">
      <form className="world-prompt-card" onSubmit={submit}>
        <p className="kicker">World director</p>
        <h2>What do you want to explore?</h2>
        <label className="sr-only" htmlFor="world-prompt-input">
          Describe a world
        </label>
        <textarea
          id="world-prompt-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(event)
            }
          }}
          placeholder='I want to explore space.'
          rows={2}
          disabled={busy}
        />
        <div className="world-prompt-actions">
          {speechAvailable ? (
            <button
              type="button"
              className={listening ? 'ghost-button is-listening' : 'ghost-button'}
              onClick={() => (listening ? voice.stop() : voice.start())}
              disabled={busy || waiting}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Speak a world request'}
            >
              {listening ? 'Listening…' : '🎤'}
            </button>
          ) : (
            <span className="world-prompt-mic-missing">Voice unavailable</span>
          )}
          <button type="submit" className="vr-button" disabled={busy || waiting || !text.trim()}>
            {waiting ? `Wait ${waitSeconds}s` : busy ? 'Working…' : 'Explore'}
          </button>
        </div>
        {busy ? (
          <p className="status-loading" aria-live="polite">
            {world.message || 'Building your world...'}
          </p>
        ) : null}
        {world.status === 'ready' && world.message ? <p className="hint">{world.message}</p> : null}
        {world.status === 'error' && world.error ? (
          <p className="status-off">
            {world.error}
            {waiting ? ` Try again in ${waitSeconds}s.` : ''}
          </p>
        ) : null}
        {voiceError ? <p className="status-off">{voiceError}</p> : null}
        {world.director === 'llm' && world.status === 'ready' ? (
          <p className="hint">
            Directed by {world.models?.director || 'an LLM'}
            {world.models?.environmentMode === 'PROCEDURAL_360'
              ? ', procedural 360° renderer'
              : world.models?.image
                ? `, panoramas by ${world.models.image}`
                : ''}
            .
          </p>
        ) : null}
        {world.models?.environmentMode === 'PROCEDURAL_360' && world.status === 'ready' && world.director !== 'llm' ? (
          <p className="hint">Procedural 360° mode (ENVIRONMENT_MODE=PROCEDURAL_360).</p>
        ) : null}
        {world.director === 'heuristic' && world.status === 'ready' ? (
          <p className="hint">
            {world.notice ||
              'Heuristic director (no LLM key). Set LLM_API_KEY on the server to use a model.'}
          </p>
        ) : null}
      </form>
    </section>
  )
}