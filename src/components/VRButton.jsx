/**
 * HTML Enter VR control.
 *
 * @react-three/xr v6 does not ship a React VRButton. Immersive sessions start
 * from the store: `store.enterVR()` must run from a user gesture.
 */
export function VRButton({ store, supported }) {
  if (!supported) {
    return null
  }

  return (
    <button type="button" className="vr-button" onClick={() => store.enterVR()}>
      Enter VR
    </button>
  )
}
