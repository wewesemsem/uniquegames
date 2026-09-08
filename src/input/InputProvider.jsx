import { KeyboardInput } from './KeyboardInput'

/**
 * DOM-side input hosts (keyboard). Pointer and XR sources live inside the
 * Canvas because they need R3F / WebXR hooks.
 */
export function InputProvider({ children }) {
  return (
    <>
      <KeyboardInput />
      {children}
    </>
  )
}
