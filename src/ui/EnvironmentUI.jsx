import { useEffect, useState } from 'react'
import { VRButton } from '../components/VRButton.jsx'
import { environmentStore, navigateTo, useEnvironment } from '../navigation/EnvironmentManager.jsx'

async function getWebXrStatus() {
  const xr = navigator.xr
  if (!xr || typeof xr.isSessionSupported !== 'function') {
    return 'missing'
  }
  try {
    const vr = await xr.isSessionSupported('immersive-vr')
    return vr ? 'vr' : 'api-only'
  } catch {
    return 'api-only'
  }
}

function isLocalDevHost() {
  const { hostname } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function webXrLabel(status) {
  if (status === 'vr') {
    return { text: 'WebXR Available', className: 'status-on' }
  }
  if (status === 'api-only') {
    return { text: 'No VR headset connected', className: 'status-warn' }
  }
  return { text: 'WebXR Not Available', className: 'status-off' }
}

export function EnvironmentUI({ store }) {
  const { current, status, error, fade, rooms } = useEnvironment()
  const [webxrStatus, setWebxrStatus] = useState('missing')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const next = await getWebXrStatus()
      if (!cancelled) {
        setWebxrStatus(next)
      }
    }

    check()
    const retry = window.setTimeout(check, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(retry)
    }
  }, [])

  const showEnterVr = webxrStatus === 'vr' || isLocalDevHost()
  const loading = status === 'loading' || fade > 0.55
  const xrLabel = webXrLabel(webxrStatus)

  return (
    <div className={open ? 'overlay-card is-open' : 'overlay-card is-collapsed'}>
      <div className="overlay-header">
        <div className="overlay-title">
          <p className="kicker">3D Web + VR Demo</p>
          <h1>{current?.name ?? 'Unknown environment'}</h1>
        </div>
        <button
          type="button"
          className="collapse-button"
          data-tutorial="info"
          aria-expanded={open}
          aria-controls="overlay-details"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide' : 'Info'}
        </button>
      </div>
      {open ? (
        <div id="overlay-details" className="overlay-details">
          <p className={xrLabel.className}>{xrLabel.text}</p>
          {webxrStatus === 'api-only' ? (
            <p className="hint">
              This browser has WebXR, but immersive VR needs a headset (or Cmd/Ctrl+Alt+E to emulate).
            </p>
          ) : null}
          {loading ? <p className="status-loading">Loading {current?.name ?? 'environment'}...</p> : null}
          {error ? <p className="status-off">{error}</p> : null}
          <p className="hint">WASD to move, mouse to orbit, click interactive objects, E for hotspots.</p>
          <div className="overlay-actions">
            <VRButton store={store} supported={showEnterVr} />
            <button type="button" className="ghost-button" onClick={() => environmentStore.resetView()}>
              Reset View
            </button>
          </div>
          <nav className="env-nav" aria-label="Environments">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={room.id === current?.id ? 'env-nav-item is-current' : 'env-nav-item'}
                onClick={() => navigateTo(room.id)}
              >
                {room.name}
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  )
}
