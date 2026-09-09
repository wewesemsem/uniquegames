# 360° Web + VR Environments

A **React 19** application that renders a **walkable 3D world** with an optional **360° panorama backdrop**, in a normal browser and in VR through **WebXR**.

This is not React 360. Desktop, mobile, and immersive VR all mount the same `Scene`. Adding a room is a data change, not a new component.

| Layer | Package |
| --- | --- |
| UI | React 19 |
| Bundler | Vite |
| 3D | Three.js + React Three Fiber 9 |
| Helpers | @react-three/drei |
| Immersive VR | @react-three/xr 6 |

## Install

```bash
npm install
```

Optional (regenerate placeholder panoramas on macOS):

```bash
npm run generate:panoramas
```

## Running locally

```bash
npm run dev
```

Open the printed URL (typically `http://localhost:5173`). Localhost is a **secure context**, so WebXR works there without HTTPS.

You do **not** need a VR headset. WASD to walk, mouse to orbit, click objects, and switch rooms from the menu or 3D hotspots.

Headset on a LAN IP needs HTTPS:

```bash
npm run dev:https
```

Then open the Network URL (for example `https://192.168.x.x:5173`) and accept the self-signed certificate.

### Production build

```bash
npm run build
npm run preview
```

## Architecture

```text
Scene
├── Panorama     (optional 360 backdrop, follows the camera)
├── World        (grid, floor, lights)
├── 3D Objects
├── Hotspots
└── Player / Camera   WASD + mouse + VR
```

The panorama is a sky sphere around the same 3D world. It does not replace the grid or player.

## AI world director

Natural-language prompts become **three distinct procedural 360° rooms** with real 3D landmarks (default) without image generation:

```text
User (text / voice)
  → WorldPrompt
  → POST /api/world/generate
  → WorldDirector (LLM or heuristic) → World Specification (semantic scene graph)
  → SceneDirector → SceneConfiguration (sky/atmosphere JSON)
  → p5.js equirectangular backdrop  +  Three.js procedural object library
  → Existing World (floor/grid) + hotspots + WebXR
```

The LLM describes **what is in the world** (pyramid, temple, spaceship, …) with optional positions/scales.  
**p5.js** paints the sky/atmosphere. **Three.js** builds recognizable meshes via `ObjectResolver` → generators. Image generation remains available via `ENVIRONMENT_MODE=IMAGE_GENERATION`.

```text
User (text or voice)
  → POST /api/world/generate
  → Rate limiter (IP / future user key)
  → Request validation
  → World Specification (Zod + size limits)
  → PROCEDURAL_360: SceneConfiguration → p5 equirect → CanvasTexture sphere
  → IMAGE_GENERATION: Asset Resolver (catalog → cache → budgeted generation → fallback)
  → World State
  → React Three Fiber (panorama + objects + hotspots)
```

Rate limiting is **server-side**. The frontend handles HTTP 429 and disables double-submit as UX only. Cached catalog assets do not consume the generation budget. Missing assets fall back to placeholders instead of failing the whole world.

Limits are environment-driven (see `.env.example`). Local dev uses an in-memory sliding window; a Redis-shaped store can be injected later without changing the world engine.

```bash
npm test
```

Demo (procedural, no images):

1. Enter **"I want to explore space."** → three distinct space panoramas
2. Enter **"I want to explore an underwater world."** → three underwater panoramas
3. Enter **"I want to explore ancient Egypt."** → temple / pyramid / desert panoramas

Copy `.env.example` to `.env` and set **server** keys (never `VITE_`):

```bash
cp .env.example .env
# LLM
LLM_API_KEY=sk-...          # or OPENAI_API_KEY
LLM_MODEL=gpt-4o-mini

# 360° environment mode (default: procedural — no image generation)
ENVIRONMENT_MODE=PROCEDURAL_360   # or IMAGE_GENERATION

# 360° panorama generation (only when ENVIRONMENT_MODE=IMAGE_GENERATION)
IMAGE_API_KEY=sk-...
IMAGE_MODEL=gpt-image-1
IMAGE_GENERATION_COUNT=3
IMAGE_QUALITY=high
IMAGE_SIZE=1536x1024
```

Without keys the app still runs: a heuristic director + procedural scene heuristics (or catalog panoramas in image mode). With an LLM key in `PROCEDURAL_360`, the server asks the model for a World Specification and per-room SceneConfiguration, validates both, then p5 paints equirectangular skies for Three.js. Image API code stays in the repo for the alternate mode.

Environment data can include both a panorama and objects:

```js
{
  id: 'room1',
  name: 'Room 1',
  panorama: '/panoramas/room-1.jpg',
  objects: [{ type: 'box', position: [0, 1, -3], interactive: true }],
  hotspots: [{ id: 'to-room-2', position: [2, 1, -4], target: 'room2', label: 'Room 2' }],
}
```

The R3F tree is not duplicated for VR. `@react-three/xr` v6 wraps the existing scene (`createXRStore` + `<XR store={store}>` + `store.enterVR()`).

Input still funnels through one manager:

```text
InputManager
├── Keyboard
├── Mouse
├── Touch
└── VR controllers
        ↓
  move / look / interact
        ↓
      Player
        ↓
  World + Panorama + Objects + Hotspots
```

## Adding a panorama

1. Put an **equirectangular** image in `public/panoramas/` (2:1 JPEG or PNG).
2. Reference it from environment data:

```js
panorama: '/panoramas/my-room.jpg'
```

`<Panorama />` loads only the current image, uses inner-sphere mapping, and disposes the texture when the room changes.

## Creating an environment

Edit `src/data/environments.js`:

```js
newRoom: {
  id: 'newRoom',
  name: 'New Room',
  panorama: '/panoramas/new-room.jpg',
  hotspots: [],
}
```

Do not add a new React component for the room. `<Environment />` always mounts the world (grid), then optional panorama, objects, and hotspots.

## Creating a hotspot

Hotspots use **world positions** in the same 3D space as the grid and boxes:

```js
{
  id: 'to-gallery',
  position: [2.4, 0.15, -4.2],
  target: 'room2',
  label: 'Gallery',
}
```

`<Hotspot />` registers with `InteractionManager`, so click, tap, reticle + `E`/`Enter`, and VR controller trigger all call the same `onSelect`.

## Connecting environments

Set `target` to another environment `id`. The demo graph is:

```text
Playground ⇄ Room 1 ⇄ Room 2 ⇄ Room 3
```

`navigateTo('room2')` fades, then swaps panorama, objects, and hotspots. The grid and player stay. Unknown ids set an error and do not crash.

## Desktop controls

| Input | Action |
| --- | --- |
| Mouse drag / touch drag | Orbit the view |
| Mouse wheel / pinch | Zoom |
| `W` `A` `S` `D` | Walk |
| `Shift` | Sprint |
| `Space` | Jump |
| `Arrow Left` / `Right` | Rotate view |
| `E` or `Enter` | Activate the hotspot/object under the reticle |
| `R` or **Reset View** | Recenter the camera |
| `Esc` | Clear focus; end VR if a session is active |

WASD walks the 3D world. The panorama sphere follows the camera so you never reach its wall.

## Mobile

Touch-drag to look. Tap a hotspot to go to another room. The HTML menu also switches rooms.

## WebXR / VR

1. `npm run dev:https` (or localhost HTTP).
2. On a Quest (or another WebXR browser), open the URL.
3. Confirm **WebXR Available**, then **Enter VR**.
4. Look with the headset. Walk-style thumbstick still moves in the 3D world. Point a controller at a hotspot or cube and press the trigger.

The panorama surrounds you; grid, objects, and hotspots stay real 3D geometry.

On localhost, `@react-three/xr` can emulate a Quest (`Cmd/Ctrl + Alt + E`).

## Project structure

```text
src/
  App.jsx
  main.jsx
  api/worldApi.js
  world/
    WorldSpecification.js
    WorldDirector.js
    WorldBuilder.js
    WorldState.js
    heuristicDirector.js
  assets/
    AssetResolver.js
    AssetCatalog.js
    AssetCache.js
    CatalogAssetProvider.js
    GeneratedAssetProvider.js
    ExternalAssetProvider.js
  data/environments.js
  navigation/EnvironmentManager.jsx
  components/
    WorldPrompt/
    Scene.jsx
    World.jsx
    Panorama.jsx
    SceneObject.jsx
    InteractiveObject.jsx
    Hotspot.jsx
    Environment.jsx
    EnvironmentTransition.jsx
    Player.jsx
    VRButton.jsx
    Overlay.jsx
  input/
    InputManager.js
    KeyboardInput.jsx / KeyboardControls.jsx
    MouseInput.jsx / MouseControls.jsx
    TouchInput.jsx / TouchControls.jsx
    XRInput.jsx / VRControls.jsx
    VoiceInput.js
  ui/EnvironmentUI.jsx
server/
  world-generation.js
  vite-plugin-world-api.js
  config.js
  rate-limit/
  generation-budget.js
public/panoramas/
  room-1.jpg
  room-2.jpg
  room-3.jpg
```

## Notes

- Use `@react-three/xr` **v6**, not v5 tutorials.
- React 360 is discontinued and is not used.
- 360 video, spatial audio, GLTF props, auth, multiplayer, NPCs, TTS, and real panorama/3D generation vendors are out of scope for this layer.
