import { useEffect, useState } from 'react'
import { VRButton } from '../components/VRButton.jsx'
import { environmentStore, navigateTo, useEnvironment } from '../navigation/EnvironmentManager.jsx'
import { useWorldState } from '../world/WorldState.js'

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

function roomIsReady(room) {
  if (!room) return false
  if (room.pending) return false
  return Boolean(room.procedural || room.panorama || (room.objects?.length ?? 0) > 0)
}

export function EnvironmentUI({ store }) {
  const { current, status, error, fade, rooms } = useEnvironment()
  const world = useWorldState()
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
  const pendingIds = new Set((world.pendingRooms ?? []).map((room) => room.id))

  return (
    <div className={open ? 'overlay-card is-open' : 'overlay-card is-collapsed'}>
      <div className="overlay-header">
        <div className="overlay-title">
          <p className="kicker brand-kicker">
            <img className="brand-mark" src="/favicon.svg" alt="" width="16" height="16" />
            3D World Games
          </p>
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
          {(world.pendingRooms?.length ?? 0) > 0 ? (
            <p className="status-loading">
              Still painting {world.pendingRooms.map((room) => room.name).join(', ')}…
            </p>
          ) : null}
          <p className="hint">WASD to move, mouse to orbit, click interactive objects, E for hotspots.</p>
          <div className="overlay-actions">
            <VRButton store={store} supported={showEnterVr} />
            <button type="button" className="ghost-button" onClick={() => environmentStore.resetView()}>
              Reset View
            </button>
          </div>
          <nav className="env-nav" aria-label="Environments">
            {rooms.map((room) => {
              const pending = Boolean(room.pending) || pendingIds.has(room.id)
              const ready = roomIsReady(room) && !pending
              const isCurrent = room.id === current?.id
              return (
                <button
                  key={room.id}
                  type="button"
                  className={[
                    'env-nav-item',
                    isCurrent ? 'is-current' : '',
                    pending || !ready ? 'is-pending' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!ready}
                  aria-disabled={!ready}
                  onClick={() => ready && navigateTo(room.id)}
                >
                  <span>{room.name}</span>
                  {pending || !ready ? <span className="env-nav-pending">Rendering…</span> : null}
                </button>
              )
            })}
          </nav>
        </div>
      ) : null}
    </div>
  )
}
