import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { Scene } from './components/Scene.jsx'
import { Environment } from './components/Environment.jsx'
import { EnvironmentTransition } from './components/EnvironmentTransition.jsx'
import { Overlay } from './components/Overlay.jsx'
import { Player } from './components/Player.jsx'
import { InputProvider } from './input/InputProvider.jsx'
import { MouseInput } from './input/MouseInput.jsx'
import { TouchInput } from './input/TouchInput.jsx'
import { XRInput } from './input/XRInput.jsx'
import { EnvironmentManager } from './navigation/EnvironmentManager.jsx'
import { xrStore } from './xr/store.js'
import './App.css'

export default function App() {
  return (
    <EnvironmentManager>
      <InputProvider>
        <Overlay store={xrStore} />
        <Canvas
          className="app-canvas"
          camera={{ position: [0, 1.6, 6], fov: 60, near: 0.1, far: 2000 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          {/*
            WebXR v6: the same Scene is presented to the headset.
            Panorama is a backdrop around the walkable 3D world.
          */}
          <XR store={xrStore}>
            <MouseInput />
            <TouchInput />
            <XRInput />
            <Player />
            <Scene>
              <Environment />
              <EnvironmentTransition />
            </Scene>
          </XR>
        </Canvas>
      </InputProvider>
    </EnvironmentManager>
  )
}
