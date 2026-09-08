/**
 * Scene graph that is reused for both the browser and an immersive WebXR session.
 * Desktop controls and VR controls wrap or sit beside this tree — they do not
 * clone it.
 */
export function Scene({ children }) {
  return <group name="shared-scene">{children}</group>
}
