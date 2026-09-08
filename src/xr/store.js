/**
 * WebXR integration — @react-three/xr v6
 *
 * v6 is store-based. Do not use the v5 <VRButton>, <DefaultXRControllers>,
 * or <Controllers> APIs in a new project.
 *
 * 1. createXRStore() owns session configuration and enterVR()/enterAR().
 * 2. Wrap the R3F tree with <XR store={store}>.
 * 3. The children of <XR> are the SAME scene used for desktop and VR.
 *    WebXR does not duplicate the scene; it presents that scene to an
 *    immersive-vr session with headset tracking and controllers.
 *
 * Default controller/hand models and pointer rays are enabled so a VR
 * user can point at the same meshes a mouse user clicks.
 *
 * `emulate: 'metaQuest3'` uses IWER on localhost (or Cmd/Ctrl+Alt+E) so
 * development does not require a headset. Native WebXR is used when present.
 */
import { createXRStore } from '@react-three/xr'

export const xrStore = createXRStore({
  controller: true,
  hand: true,
  // Our overlay owns the Enter VR button. Do not let the store offer a second one.
  offerSession: false,
  // IWER Quest emulation on localhost so Enter VR can be tried without a headset.
  emulate: 'metaQuest3',
})
