/**
 * Pure motion helpers for reusable animation behaviors.
 * No React / Three imports — safe for tests and Node.
 */

import { speedToFactor, variationToFactor } from '../../world/AnimationSchema.js'

export function behaviorMotion(behavior, time, seed = 1) {
  if (!behavior) {
    return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], intensity: 1 }
  }

  const speed = speedToFactor(behavior.speed) * (0.85 + (seed % 7) * 0.04)
  const variation = variationToFactor(behavior.variation)
  const amp = (behavior.amplitude ?? 1) * variation
  const t = time * speed
  const phase = seed * 0.37

  switch (behavior.behavior) {
    case 'swim':
    case 'school': {
      const radius = 0.55 * amp
      return {
        position: [Math.sin(t * 0.7 + phase) * radius, Math.sin(t * 1.1 + phase) * 0.22 * amp, Math.cos(t * 0.55 + phase) * radius * 0.6],
        rotation: [0, t * 0.35 + Math.sin(t * 0.9) * 0.25 * variation, Math.sin(t * 1.3 + phase) * 0.08],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'sway': {
      const a = Math.sin(t * 1.2 + phase) * 0.18 * amp
      return {
        position: [a * 0.15, 0, 0],
        rotation: [a * 0.35, 0, a],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'fly': {
      return {
        position: [
          Math.sin(t * 0.5 + phase) * 1.2 * amp,
          Math.sin(t * 0.9 + phase * 2) * 0.55 * amp,
          Math.cos(t * 0.4 + phase) * 0.9 * amp,
        ],
        rotation: [0, t * 0.4, Math.sin(t * 2 + phase) * 0.2],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'float': {
      return {
        position: [Math.sin(t * 0.4 + phase) * 0.15 * amp, Math.sin(t * 0.8 + phase) * 0.35 * amp, Math.cos(t * 0.35 + phase) * 0.12 * amp],
        rotation: [0, t * 0.15, Math.sin(t * 0.6) * 0.05],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'rise': {
      const y = ((t * 0.4 + phase) % 4) - 0.5
      return {
        position: [Math.sin(t * 0.3 + phase) * 0.2 * amp, y, Math.cos(t * 0.25 + phase) * 0.2 * amp],
        rotation: [0, t * 0.2, 0],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'orbit': {
      const r = 0.8 * amp
      return {
        position: [Math.cos(t * 0.35 + phase) * r, Math.sin(t * 0.5 + phase) * 0.2 * amp, Math.sin(t * 0.35 + phase) * r],
        rotation: [0, t * 0.35, 0],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'pulse': {
      const s = 1 + Math.sin(t * 1.4 + phase) * 0.08 * amp
      return {
        position: [0, Math.sin(t * 0.7 + phase) * 0.05 * amp, 0],
        rotation: [0, 0, 0],
        scale: [s, s, s],
        intensity: 0.7 + Math.sin(t * 1.4 + phase) * 0.3,
      }
    }
    case 'wave': {
      return {
        position: [0, Math.sin(t * 0.9 + phase) * 0.12 * amp, 0],
        rotation: [Math.sin(t * 0.7 + phase) * 0.04, 0, 0],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'drift': {
      return {
        position: [Math.sin(t * 0.25 + phase) * 0.3 * amp, Math.sin(t * 0.2 + phase * 1.3) * 0.1 * amp, Math.cos(t * 0.22 + phase) * 0.25 * amp],
        rotation: [0, t * 0.05, 0],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'rotate': {
      return {
        position: [0, 0, 0],
        rotation: [0, t * 0.4, Math.sin(t * 0.2) * 0.05],
        scale: [1, 1, 1],
        intensity: 1,
      }
    }
    case 'flicker': {
      const pulse = 0.55 + Math.abs(Math.sin(t * 6 + phase)) * 0.45 * variation
      return {
        position: [0, 0, 0],
        rotation: [0, 0, Math.sin(t * 8 + phase) * 0.03],
        scale: [1, 0.95 + pulse * 0.08, 1],
        intensity: pulse,
      }
    }
    default:
      return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], intensity: 1 }
  }
}
