/**
 * Motion paths for procedural reactions (emerge, swim-in, flee, bloom, …).
 * Pure helpers — no React / LLM code.
 */

export function reactionMotion(animation, progress, seed = 1) {
  const p = Math.min(1, Math.max(0, progress))
  const ease = 1 - Math.pow(1 - p, 3)
  const phase = (seed % 17) * 0.37

  switch (animation) {
    case 'emerge_from_door':
    case 'emerge': {
      return {
        position: [Math.sin(phase) * 0.05, Math.max(0, ease * 0.15), ease * 2.4 - 0.4],
        rotation: [0, ease * 0.2, 0],
        scale: [0.55 + ease * 0.45, 0.4 + ease * 0.6, 0.55 + ease * 0.45],
        opacity: Math.min(1, p * 1.4),
        emissive: 0.05,
      }
    }
    case 'swim_into_scene':
    case 'swim': {
      const travel = 1 - ease
      return {
        position: [travel * -10, Math.sin(p * Math.PI * 2 + phase) * 0.4, travel * -4],
        rotation: [0, Math.PI * 0.5 + Math.sin(p * 4) * 0.1, Math.sin(p * 3) * 0.05],
        scale: [1, 1, 1],
        opacity: Math.min(1, p * 2),
        emissive: 0,
      }
    }
    case 'fly_in':
    case 'fly': {
      const travel = 1 - ease
      return {
        position: [Math.sin(phase) * travel * 4, 1.5 + travel * 2 + Math.sin(p * 8) * 0.2, travel * 3],
        rotation: [0, p * 2, Math.sin(p * 6) * 0.3],
        scale: [0.7 + ease * 0.3, 0.7 + ease * 0.3, 0.7 + ease * 0.3],
        opacity: Math.min(1, p * 2),
        emissive: 0,
      }
    }
    case 'walk': {
      return {
        position: [0, Math.abs(Math.sin(p * Math.PI * 4)) * 0.05, ease * 2],
        rotation: [0, 0, Math.sin(p * Math.PI * 4) * 0.04],
        scale: [1, 1, 1],
        opacity: 1,
        emissive: 0,
      }
    }
    case 'float_in':
    case 'orbit_in': {
      const r = (1 - ease) * 4
      return {
        position: [Math.cos(p * Math.PI * 2 + phase) * r, ease * 1.2, Math.sin(p * Math.PI * 2 + phase) * r],
        rotation: [0, p * Math.PI, 0],
        scale: [0.5 + ease * 0.5, 0.5 + ease * 0.5, 0.5 + ease * 0.5],
        opacity: Math.min(1, p * 1.5),
        emissive: 0.2 * ease,
      }
    }
    case 'flee': {
      return {
        position: [Math.sin(phase) * ease * 3, ease * 1.2, -ease * 4],
        rotation: [0, ease * 1.2, 0],
        scale: [1, 1, 1],
        opacity: Math.max(0, 1 - p * 0.85),
        emissive: 0,
      }
    }
    case 'bloom':
    case 'open': {
      const s = 0.4 + ease * 0.8
      return {
        position: [0, ease * 0.35, 0],
        rotation: [0, ease * 0.6, 0],
        scale: [s, s * (0.7 + ease * 0.4), s],
        opacity: 1,
        emissive: 0.15 + ease * 0.35,
      }
    }
    case 'close': {
      const s = 1 - ease * 0.5
      return {
        position: [0, 0, 0],
        rotation: [0, -ease * 0.4, 0],
        scale: [s, s, s],
        opacity: 1 - ease * 0.3,
        emissive: 0,
      }
    }
    case 'glow_up':
    case 'activate': {
      const pulse = 0.5 + Math.sin(p * Math.PI * 4) * 0.5
      return {
        position: [0, 0, 0],
        rotation: [0, ease * 0.2, 0],
        scale: [1 + pulse * 0.06, 1 + pulse * 0.06, 1 + pulse * 0.06],
        opacity: 1,
        emissive: 0.2 + ease * 0.7 * pulse,
      }
    }
    case 'burst': {
      const s = 1 + ease * 1.4
      return {
        position: [0, ease * 0.5, 0],
        rotation: [0, p * 4, 0],
        scale: [s, s, s],
        opacity: Math.max(0, 1 - p),
        emissive: 1 - p,
      }
    }
    case 'rise': {
      return {
        position: [0, ease * 2.5, 0],
        rotation: [0, ease * 1.5, 0],
        scale: [1, 1, 1],
        opacity: Math.min(1, p * 1.5),
        emissive: 0.2,
      }
    }
    case 'appear':
    default: {
      return {
        position: [0, (1 - ease) * 0.4, 0],
        rotation: [0, 0, 0],
        scale: [0.2 + ease * 0.8, 0.2 + ease * 0.8, 0.2 + ease * 0.8],
        opacity: Math.min(1, p * 1.8),
        emissive: (1 - ease) * 0.4,
      }
    }
  }
}
