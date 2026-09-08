import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

const STORAGE_KEY = 'uniquegames.tutorial.v1'

const STEPS = [
  {
    id: 'explore',
    target: 'explore',
    title: 'Explore',
    body: 'Build a world instantly with the procedural 360° renderer — fast and great for iterating on ideas.',
    placement: 'above',
  },
  {
    id: 'ai-images',
    target: 'ai-images',
    title: 'AI images',
    body: 'Paint high-quality AI panoramas instead. This uses the image model and usually takes 1–2 minutes.',
    placement: 'above',
  },
  {
    id: 'info',
    target: 'info',
    title: 'Info',
    body: 'Open this panel for WebXR status, movement tips, Reset View, Enter VR, and room switching.',
    placement: 'below',
  },
]

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'done'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'done')
  } catch {
    // ignore private mode / quota
  }
}

function measureTarget(id) {
  const el = document.querySelector(`[data-tutorial="${id}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 && rect.height < 1) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    bottom: rect.bottom,
    right: rect.right,
  }
}

/**
 * First-run 3-step tutorial with arrows pointing at Explore, AI images, and Info.
 */
export function OnboardingTutorial() {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (readDismissed()) return undefined
    const timer = window.setTimeout(() => setActive(true), 450)
    return () => window.clearTimeout(timer)
  }, [])

  const step = STEPS[stepIndex]

  const refresh = useCallback(() => {
    if (!step) return
    setTarget(measureTarget(step.target))
  }, [step])

  useLayoutEffect(() => {
    if (!active) return undefined
    refresh()
    const onResize = () => refresh()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    const interval = window.setInterval(refresh, 500)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearInterval(interval)
    }
  }, [active, refresh, stepIndex])

  function finish() {
    writeDismissed()
    setActive(false)
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      finish()
      return
    }
    setStepIndex((value) => value + 1)
  }

  if (!active || !step) return null

  const tipWidth = Math.min(280, window.innerWidth - 32)
  let tipStyle = { width: tipWidth }
  let arrowClass = 'tutorial-arrow tutorial-arrow-down'
  let highlightStyle = null

  if (target) {
    highlightStyle = {
      top: target.top - 6,
      left: target.left - 6,
      width: target.width + 12,
      height: target.height + 12,
    }

    if (step.placement === 'above') {
      const left = Math.min(
        Math.max(16, target.centerX - tipWidth / 2),
        window.innerWidth - tipWidth - 16
      )
      tipStyle = {
        ...tipStyle,
        left,
        top: target.top - 16,
        transform: 'translateY(-100%)',
        ['--arrow-x']: `${target.centerX - left}px`,
      }
      arrowClass = 'tutorial-arrow tutorial-arrow-down'
    } else {
      const left = Math.min(Math.max(16, target.left), window.innerWidth - tipWidth - 16)
      tipStyle = {
        ...tipStyle,
        left,
        top: target.bottom + 16,
        transform: 'none',
        ['--arrow-x']: `${Math.min(Math.max(24, target.centerX - left), tipWidth - 24)}px`,
      }
      arrowClass = 'tutorial-arrow tutorial-arrow-up'
    }
  }

  return (
    <div className="tutorial-root" role="dialog" aria-modal="false" aria-label="Quick tour">
      <div className="tutorial-scrim" onClick={finish} aria-hidden="true" />
      {highlightStyle ? <div className="tutorial-highlight" style={highlightStyle} aria-hidden="true" /> : null}
      <div className="tutorial-tip" style={tipStyle}>
        <div className={arrowClass} aria-hidden="true" />
        <p className="tutorial-step">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tutorial-actions">
          <button type="button" className="ghost-button" onClick={finish}>
            Skip
          </button>
          <button type="button" className="vr-button" onClick={next}>
            {stepIndex >= STEPS.length - 1 ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
