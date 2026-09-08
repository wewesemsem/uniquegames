/**
 * Built-in environments. These are the default rooms and a fast catalog of
 * known layouts — not a limit on what the world director may request.
 */
export const DEFAULT_ENVIRONMENT_ID = 'playground'

export const environments = {
  playground: {
    id: 'playground',
    name: 'Playground',
    panorama: null,
    procedural: {
      environment: 'meadow',
      timeOfDay: 'day',
      sky: 'clear',
      ground: 'grass',
      terrain: 'flat',
      fog: 0.1,
      treeDensity: 0,
      lighting: 0.9,
      lightingStyle: 'neutral',
      wind: 0.2,
      particles: 'none',
      colorMood: 'neutral',
      starDensity: 0,
      planetCount: 0,
      nebula: 0,
      structures: [],
      earthVisible: false,
      animationSpeed: 0.3,
      effects: [],
    },
    objects: [
      { id: 'cube-select', type: 'box', position: [-1.15, 0.5, -2], color: '#e85d4c', interactive: true },
      { id: 'sphere-select', type: 'sphere', position: [1.2, 0.55, -2.1], color: '#4c8fe8', interactive: true },
      { id: 'decor-box', type: 'box', position: [-3.2, 0.4, -4], color: '#3d6ea8' },
      { id: 'decor-sphere', type: 'sphere', position: [3.4, 0.35, -3.2], color: '#2f9d8a' },
      { id: 'decor-plank', type: 'box', position: [0, 0.25, -6], scale: [2.4, 0.55, 0.67], color: '#6b5a3a' },
    ],
    hotspots: [
      { id: 'to-room-1', position: [0, 1.15, -4], target: 'room1', label: 'Room 1' },
    ],
  },
  room1: {
    id: 'room1',
    name: 'Room 1',
    panorama: '/panoramas/room-1.jpg',
    objects: [
      { id: 'r1-box', type: 'box', position: [0, 0.5, -3], color: '#e85d4c', interactive: true },
      { id: 'r1-sphere', type: 'sphere', position: [2.4, 0.55, -2.2], color: '#f2c14e' },
    ],
    hotspots: [
      { id: 'to-playground', position: [-2.2, 1.1, -3.5], target: 'playground', label: 'Playground' },
      { id: 'to-room-2', position: [2.2, 1.1, -3.5], target: 'room2', label: 'Room 2' },
    ],
  },
  room2: {
    id: 'room2',
    name: 'Room 2',
    panorama: '/panoramas/room-2.jpg',
    objects: [
      { id: 'r2-box', type: 'box', position: [-1.6, 0.5, -2.8], color: '#4c8fe8', interactive: true },
      { id: 'r2-sphere', type: 'sphere', position: [1.8, 0.55, -3.2], color: '#9be7ff' },
    ],
    hotspots: [
      { id: 'to-room-1', position: [-2.2, 1.1, -3.5], target: 'room1', label: 'Room 1' },
      { id: 'to-room-3', position: [2.2, 1.1, -3.5], target: 'room3', label: 'Room 3' },
    ],
  },
  room3: {
    id: 'room3',
    name: 'Room 3',
    panorama: '/panoramas/room-3.jpg',
    objects: [
      { id: 'r3-box', type: 'box', position: [0, 0.5, -3.4], color: '#3d6ea8' },
      { id: 'r3-sphere', type: 'sphere', position: [-2, 0.55, -2.4], color: '#2f9d8a', interactive: true },
    ],
    hotspots: [
      { id: 'to-room-2', position: [-2.2, 1.1, -3.5], target: 'room2', label: 'Room 2' },
      { id: 'to-playground', position: [2.2, 1.1, -3.5], target: 'playground', label: 'Playground' },
    ],
  },
}

export function getEnvironment(id) {
  return environments[id] ?? null
}

export function listEnvironments() {
  return Object.values(environments)
}
