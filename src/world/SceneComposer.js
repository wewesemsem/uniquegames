/**
 * Scene Composer — expands high-level composition intent into
 * procedural generator requests + sky/atmosphere overlays.
 *
 * LLM → composition → SceneComposer → generators → Three.js + p5
 */

import { resolveRoomComposition } from './CompositionSchema.js'
import { inferAnimation, sanitizeAnimation } from './AnimationSchema.js'
import { inferInteractions, sanitizeInteractions } from './InteractionSchema.js'
import { reactionNeedsSpawn } from '../interaction/ReactionResolver.js'
import { hash01 } from '../procedural/objects/hash.js'
import { isEgyptComposition } from './egyptContext.js'
import {
  applyStyleToNeed,
  formsFromMotif,
  hashSeed,
  inferStyleIntent,
  styleContextText,
} from './StyleIntent.js'

const LIFE_COUNT = { none: 0, sparse: 1, moderate: 2, abundant: 4 }

function seeded(seed, salt) {
  return hash01(seed, salt)
}

function countFor(density, base, lifeKey = 'moderate') {
  const lifeMul = LIFE_COUNT[lifeKey] ?? 2
  return Math.max(0, Math.round(base * (0.45 + density) * (lifeMul === 0 ? 0.15 : lifeMul / 2)))
}

function need(type, description, extras = {}) {
  return {
    type,
    description,
    tags: extras.tags ?? [type],
    ...extras,
  }
}

/**
 * Scatter a ring of placements around the player.
 * Returns object needs with positions already filled.
 */
function scatter(type, description, total, seed, opts = {}) {
  const items = []
  const {
    radiusMin = 3.5,
    radiusMax = 18,
    y = 0,
    scale = 1,
    tags = [type],
    params = undefined,
    detail = 'medium',
    extras = {},
  } = opts
  for (let i = 0; i < total; i += 1) {
    const a = seeded(seed, i * 3 + 1) * Math.PI * 2
    const r = radiusMin + seeded(seed, i * 3 + 2) * (radiusMax - radiusMin)
    const s =
      typeof scale === 'number'
        ? scale * (0.7 + seeded(seed, i * 3 + 3) * 0.7)
        : scale
    items.push(
      need(type, `${description} ${i + 1}`, {
        tags,
        position: [Math.cos(a) * r, y + (opts.yJitter ?? 0) * (seeded(seed, i + 9) - 0.5), Math.sin(a) * r - 2],
        scale: Array.isArray(s) ? s : [s, s, s],
        rotation: [0, seeded(seed, i + 11) * Math.PI * 2, 0],
        detail,
        params,
        ...extras,
      })
    )
  }
  return items
}

function scatterGeneric(description, total, seed, descriptor, opts = {}) {
  return scatter('generic', description, total, seed, {
    ...opts,
    tags: opts.tags ?? [descriptor.category, descriptor.form || 'organic'],
    extras: {
      category: descriptor.category,
      form: descriptor.form,
      appearance: descriptor.appearance,
      geometry: descriptor.geometry,
      behavior: descriptor.behavior,
    },
  })
}

function exoticGenericDescriptor(form, motif, seed, index, { glowing = true } = {}) {
  const crystalline = /crystal/i.test(form)
  const mushroom = form === 'mushroom'
  const floating = /float/i.test(motif || '') || form === 'ring'
  return {
    category: crystalline ? 'crystalline' : mushroom || form === 'organic' || form === 'tree_like' ? 'organic_plant' : 'prop',
    form,
    appearance: {
      scale_hint: seeded(seed, index + 2) > 0.7 ? 'giant' : 'large',
      color: glowing ? 'bioluminescent' : crystalline ? 'cool' : 'vivid',
      surface: glowing ? 'glowing' : crystalline ? 'translucent' : 'matte',
      emission: glowing ? 0.55 + seeded(seed, index + 3) * 0.4 : crystalline ? 0.4 : 0.1,
      roughness: crystalline ? 0.2 : 0.45,
      metalness: crystalline ? 0.15 : 0,
      transparency: crystalline ? 0.35 + seeded(seed, index + 4) * 0.25 : 0.05,
      hue: Math.floor(seeded(seed, index + 5) * 360),
    },
    geometry: {
      primary_form: form === 'crystal' ? 'crystalline' : form,
      facets: 6 + Math.floor(seeded(seed, index + 6) * 12),
      height: 2.2 + seeded(seed, index + 7) * 3.5,
      width: 1.2 + seeded(seed, index + 8) * 2.5,
    },
    behavior: {
      floating,
      clustered: seeded(seed, index + 9) > 0.45,
      count: 1,
    },
  }
}

function vegetationLayer(composition, seed) {
  const { vegetation, density, life, motif } = composition
  if (vegetation === 'none') return []

  if (vegetation === 'fungal' || vegetation === 'alien') {
    const count = countFor(density, 8, life)
    const preferFungal = vegetation === 'fungal' || /mushroom|fungi|fungus/i.test(motif || '')
    const forms = formsFromMotif(motif, seed + 15, Math.max(1, count), { preferFungal })
    const label = motif || (preferFungal ? 'Exotic fungal flora' : 'Alien flora')
    const items = []
    for (let i = 0; i < count; i += 1) {
      const form = forms[i % forms.length]
      const descriptor = exoticGenericDescriptor(form, motif, seed + 15, i, {
        glowing: preferFungal || /glow|biolum|neon/i.test(motif || '') || vegetation === 'alien',
      })
      items.push(
        ...scatterGeneric(`${label} ${form}`, 1, seed + 15 + i * 13, descriptor, {
          radiusMin: 4,
          radiusMax: 16,
          scale: 0.85 + seeded(seed, i + 20) * 0.5,
          y: descriptor.behavior.floating ? 1.2 + seeded(seed, i + 21) * 2 : 0,
        })
      )
    }
    return items
  }

  if (vegetation === 'coral_reef' || vegetation === 'seaweed') {
    const coralCount = vegetation === 'seaweed' ? countFor(density, 3, life) : countFor(density, 5, life)
    const weedCount = vegetation === 'seaweed' ? countFor(density, 5, life) : countFor(density, 4, life)
    const coral = scatter('coral', 'Coral cluster', coralCount, seed + 10, {
      radiusMin: 4,
      radiusMax: 16,
      scale: 1.1,
      tags: ['coral', 'reef'],
    })
    const weed = scatter('seaweed', 'Seaweed patch', weedCount, seed + 20, {
      radiusMin: 3,
      radiusMax: 14,
      scale: 0.9,
      tags: ['seaweed', 'vegetation'],
    })
    return vegetation === 'seaweed' ? [...weed, ...coral] : [...coral, ...weed]
  }

  if (vegetation === 'meadow') {
    return scatter('flower', 'Wildflower patch', countFor(density, 8, life), seed + 30, {
      radiusMin: 2.5,
      radiusMax: 14,
      scale: 0.85,
      tags: ['flower', 'meadow'],
      params: { count: 24, colorVariation: true },
    })
  }

  if (vegetation === 'forest' || vegetation === 'jungle') {
    const trees = scatter('tree', 'Forest tree', countFor(density, vegetation === 'jungle' ? 10 : 7, life), seed + 40, {
      radiusMin: 4,
      radiusMax: 18,
      scale: vegetation === 'jungle' ? 1.3 : 1.1,
      tags: ['tree', vegetation],
    })
    const under = vegetation === 'jungle'
      ? scatter('flower', 'Jungle undergrowth', countFor(density, 4, life), seed + 45, {
          radiusMin: 3,
          radiusMax: 12,
          scale: 0.7,
          tags: ['vegetation'],
          params: { count: 12 },
        })
      : []
    return [...trees, ...under]
  }

  if (vegetation === 'desert_scrub') {
    return [
      ...scatter('palm_tree', 'Desert palm', countFor(density, 3, 'sparse'), seed + 50, {
        radiusMin: 6,
        radiusMax: 16,
        scale: 1,
        tags: ['palm', 'desert'],
      }),
      ...scatter('rock', 'Desert rock', countFor(density, 4, 'sparse'), seed + 55, {
        radiusMin: 4,
        radiusMax: 14,
        scale: 0.9,
      }),
    ]
  }

  // sparse
  return scatter('tree', 'Scattered tree', countFor(density, 3, 'sparse'), seed + 60, {
    radiusMin: 5,
    radiusMax: 14,
    scale: 1,
  })
}

function lifeLayer(composition, seed) {
  const { biome, life, density } = composition
  if (life === 'none') return []

  const underwater = /ocean|coral|reef/.test(biome)
  if (underwater) {
    const schools = Math.max(1, countFor(density, 3, life))
    const fish = []
    for (let i = 0; i < schools; i += 1) {
      const a = seeded(seed, i * 5 + 1) * Math.PI * 2
      const r = 5 + seeded(seed, i * 5 + 2) * 12
      const schoolSize = life === 'abundant' ? 18 + Math.floor(seeded(seed, i) * 20) : 8 + Math.floor(seeded(seed, i) * 10)
      fish.push(
        need('fish', `Fish school ${i + 1}`, {
          tags: ['fish', 'school'],
          position: [Math.cos(a) * r, 0.8 + seeded(seed, i + 3) * 2.2, Math.sin(a) * r - 3],
          scale: [1, 1, 1],
          rotation: [0, a + Math.PI / 2, 0],
          params: {
            count: schoolSize,
            size: life === 'abundant' ? 'small' : 'medium',
            colors: ['#7ec8e3', '#f0e68c', '#ff7f50', '#c0c0c0', '#87ceeb'],
            movement: 'schooling',
          },
        })
      )
    }
    const jellies = scatter('jellyfish', 'Jellyfish', countFor(density, 3, life), seed + 70, {
      radiusMin: 4,
      radiusMax: 15,
      y: 1.2,
      yJitter: 1.5,
      scale: 0.8,
      tags: ['jellyfish'],
      params: { count: 1 },
    })
    return [...fish, ...jellies]
  }

  if (biome === 'meadow' || biome === 'forest' || biome === 'jungle') {
    return scatter('bird', 'Bird flock', countFor(density, 2, life), seed + 80, {
      radiusMin: 6,
      radiusMax: 16,
      y: 3.5,
      yJitter: 2,
      scale: 1,
      tags: ['bird'],
      params: { count: life === 'abundant' ? 12 : 6, movement: 'flocking' },
    })
  }

  return []
}

function featureLayer(composition, seed, theme = '') {
  const { large_features: features, density, biome } = composition
  if (features === 'none') return []

  if (features === 'pyramids') {
    return [
      need('pyramid', 'Great pyramid', {
        tags: ['pyramid', 'landmark', 'egypt'],
        position: [0, 0, -14],
        scale: [5, 5, 5],
        detail: 'high',
      }),
      need('pyramid', 'Secondary pyramid', {
        tags: ['pyramid', 'egypt'],
        position: [-10, 0, -18],
        scale: [3.2, 3.2, 3.2],
      }),
      need('pyramid', 'Lesser pyramid', {
        tags: ['pyramid', 'egypt'],
        position: [9, 0, -16],
        scale: [2.4, 2.4, 2.4],
      }),
      need('statue', 'Guardian statue', {
        tags: ['statue', 'egypt'],
        position: [-3, 0, -8],
        scale: [1.4, 1.4, 1.4],
      }),
      ...scatter('desert_dune', 'Sand dune', 4, seed + 90, { radiusMin: 10, radiusMax: 22, scale: 2.2 }),
      ...scatter('obelisk', 'Obelisk', 2, seed + 95, { radiusMin: 6, radiusMax: 12, scale: 1.1 }),
    ]
  }

  if (features === 'temples') {
    if (isEgyptComposition(composition, { theme })) {
      return [
        need('temple', 'Egyptian temple court', {
          tags: ['temple', 'landmark', 'egypt'],
          position: [0, 0, -10],
          scale: [1.5, 1.5, 1.5],
          detail: 'high',
        }),
        ...scatter('column', 'Temple column', 6, seed + 100, { radiusMin: 4, radiusMax: 10, scale: 1 }),
        ...scatter('statue', 'Temple statue', 3, seed + 105, { radiusMin: 5, radiusMax: 12, scale: 1.1 }),
        need('obelisk', 'Court obelisk', {
          tags: ['obelisk', 'egypt'],
          position: [4, 0, -6],
          scale: [1.2, 1.2, 1.2],
        }),
      ]
    }

    const motif = composition.motif || 'cultural temple courtyard'
    const color = /japan|zen|sakura|asia|china|korea/.test(motif)
      ? 'earthy'
      : /greek|roman|marble/.test(motif)
        ? 'neutral'
        : /maya|aztec|inca|mesoamerican/.test(motif)
          ? 'warm'
          : 'earthy'
    return [
      need('generic', motif, {
        tags: ['temple', 'landmark', 'cultural'],
        position: [0, 0, -10],
        scale: [1.6, 1.6, 1.6],
        detail: 'high',
        category: 'structure',
        form: /pagoda|tower|stupa/.test(motif) ? 'tower' : /arch|ruin|greek|roman/.test(motif) ? 'arch' : 'block',
        appearance: {
          scale_hint: 'giant',
          color,
          surface: 'matte',
          emission: 0,
          roughness: 0.75,
          metalness: 0,
          transparency: 0,
        },
        geometry: { primary_form: /pagoda|tower|stupa/.test(motif) ? 'tower' : 'block', facets: 8, height: 5, width: 4 },
        behavior: { floating: false, clustered: false, count: 1 },
      }),
      ...scatterGeneric(`${motif} gate`, 3, seed + 100, {
        category: 'structure',
        form: 'arch',
        appearance: {
          scale_hint: 'large',
          color,
          surface: 'matte',
          emission: 0,
          roughness: 0.7,
          metalness: 0,
          transparency: 0,
        },
        geometry: { primary_form: 'arch', facets: 6, height: 2.8, width: 2.2 },
        behavior: { floating: false, clustered: false, count: 1 },
      }, { radiusMin: 4, radiusMax: 11, scale: 1 }),
      ...scatterGeneric(`${motif} pillar`, 4, seed + 105, {
        category: 'structure',
        form: 'spire',
        appearance: {
          scale_hint: 'medium',
          color,
          surface: 'matte',
          emission: 0,
          roughness: 0.65,
          metalness: 0,
          transparency: 0,
        },
        geometry: { primary_form: 'spire', facets: 6, height: 2.4, width: 0.7 },
        behavior: { floating: false, clustered: true, count: 1 },
      }, { radiusMin: 3.5, radiusMax: 12, scale: 0.95 }),
      ...scatter('rock', 'Courtyard stone', 3, seed + 110, {
        radiusMin: 5,
        radiusMax: 14,
        scale: 0.85,
        tags: ['rock', 'temple'],
      }),
    ]
  }

  if (features === 'ruins') {
    return [
      ...scatter('ruins', 'Ruined arch', countFor(density, 4, 'moderate'), seed + 110, {
        radiusMin: 4,
        radiusMax: 12,
        scale: 1,
      }),
      ...scatter('column', 'Broken column', 4, seed + 115, { radiusMin: 3, radiusMax: 10, scale: 0.9 }),
      ...scatter('torch', 'Wall torch', 3, seed + 118, { radiusMin: 3, radiusMax: 8, scale: 1 }),
    ]
  }

  if (features === 'crystals' || features === 'fungal_grove') {
    if (features === 'fungal_grove') {
      const count = countFor(density, 7, 'abundant')
      const motif = composition.motif || 'Exotic alien grove'
      const preferFungal = /mushroom|fungi|fungus|toadstool/i.test(motif)
      const forms = formsFromMotif(motif, seed + 122, Math.max(1, count), { preferFungal })
      const items = []
      for (let i = 0; i < count; i += 1) {
        const form = forms[i % forms.length]
        const descriptor = exoticGenericDescriptor(form, motif, seed + 122, i, { glowing: true })
        items.push(
          ...scatterGeneric(`${motif} ${form}`, 1, seed + 122 + i * 11, descriptor, {
            radiusMin: 4,
            radiusMax: 17,
            scale: 0.9 + seeded(seed, i + 30) * 0.5,
            y: descriptor.behavior.floating ? 1.5 : 0,
          })
        )
      }
      return items
    }
    return scatterGeneric(
      composition.motif || 'Crystal formation',
      countFor(density, 6, 'moderate'),
      seed + 124,
      {
        category: 'crystalline',
        form: 'crystalline',
        appearance: {
          scale_hint: 'large',
          color: 'cool',
          surface: 'translucent',
          emission: 0.55,
          roughness: 0.2,
          metalness: 0.15,
          transparency: 0.45,
        },
        geometry: { primary_form: 'crystalline', facets: 12, height: 3, width: 1.5 },
        behavior: {
          floating: /float/i.test(composition.motif || ''),
          clustered: true,
          count: 1,
        },
      },
      {
        radiusMin: 5,
        radiusMax: 16,
        y: /float/i.test(composition.motif || '') ? 2 : 0,
        scale: 1.2,
      }
    )
  }

  if (features === 'reef' || features === 'rocks') {
    const rockCount = features === 'reef' ? countFor(density, 5, 'moderate') : countFor(density, 7, 'moderate')
    const rocks = scatter('rock', 'Rock formation', rockCount, seed + 120, {
      radiusMin: 3.5,
      radiusMax: 16,
      scale: biome.includes('ocean') || biome.includes('coral') ? 1.2 : 1,
    })
    if (features === 'reef') {
      return [
        ...rocks,
        ...scatter('coral', 'Reef formation', countFor(density, 4, 'abundant'), seed + 125, {
          radiusMin: 5,
          radiusMax: 15,
          scale: 1.4,
          detail: 'high',
        }),
      ]
    }
    return rocks
  }

  if (features === 'station') {
    return [
      need('habitat', 'Habitat module', {
        tags: ['habitat', 'landmark'],
        position: [0, 0, -9],
        scale: [1.4, 1.4, 1.4],
        detail: 'high',
      }),
      need('console', 'Control console', { tags: ['console'], position: [-1.6, 0, -3.5] }),
      ...scatter('crate', 'Supply crate', 3, seed + 130, { radiusMin: 2.5, radiusMax: 6, scale: 1 }),
      ...(biome.includes('ocean') || biome === 'ocean_floor'
        ? scatter('coral', 'Viewing coral', 2, seed + 132, { radiusMin: 5, radiusMax: 10, scale: 1 })
        : []),
    ]
  }

  if (features === 'buildings') {
    return [
      need('habitat', 'Dome A', { tags: ['habitat'], position: [-4, 0, -10], scale: [1.4, 1.4, 1.4], detail: 'high' }),
      need('habitat', 'Dome B', { tags: ['habitat'], position: [4, 0, -12], scale: [1.2, 1.2, 1.2] }),
      need('habitat', 'Central dome', { tags: ['habitat'], position: [0, 0, -15], scale: [1.7, 1.7, 1.7] }),
      ...scatter('console', 'City console', 2, seed + 140, { radiusMin: 3, radiusMax: 7, scale: 1 }),
    ]
  }

  if (features === 'ships') {
    return [
      need('spaceship', 'Scout ship', { tags: ['ship'], position: [5, 2, -10], scale: [1.2, 1.2, 1.2] }),
      need('asteroid', 'Asteroid', { tags: ['asteroid'], position: [-8, 3, -14], scale: [1.6, 1.6, 1.6] }),
      need('planet', 'Distant planet', { tags: ['planet'], position: [-16, 8, -28], scale: [3, 3, 3] }),
    ]
  }

  return []
}

/** Sky / atmosphere overlay merged onto SceneConfiguration. */
export function compositionSceneOverlay(composition, theme = '') {
  const { biome, atmosphere, vegetation, large_features: features } = composition
  const overlay = {}

  if (/ocean|coral|reef/.test(biome)) {
    Object.assign(overlay, {
      environment: 'ocean',
      sky: 'underwater',
      ground: 'water',
      terrain: 'ocean_floor',
      fog: 0.45,
      lightingStyle: 'cool',
      colorMood: 'cool',
      particles: 'bubbles',
      effects: ['caustics'],
      structures: vegetation === 'coral_reef' ? ['coral', 'reef'] : ['coral'],
    })
  } else if (
    biome === 'desert_plateau' ||
    (biome === 'temple_court' && isEgyptComposition(composition, { theme })) ||
    (features === 'pyramids' && isEgyptComposition(composition, { theme }))
  ) {
    Object.assign(overlay, {
      environment: 'egypt',
      sky: 'clear',
      ground: 'sand',
      terrain: 'desert',
      fog: 0.15,
      lightingStyle: 'warm',
      colorMood: 'warm',
      particles: 'sand',
      effects: atmosphere === 'dusty' ? ['dust', 'heat_haze'] : ['heat_haze'],
      structures: biome === 'temple_court' ? ['temple', 'obelisk', 'columns'] : ['pyramid', 'obelisk'],
    })
  } else if (features === 'temples') {
    Object.assign(overlay, {
      environment: /forest/.test(biome) ? 'forest' : /urban/.test(biome) ? 'city' : 'meadow',
      sky: atmosphere === 'misty' ? 'overcast' : 'clear',
      ground: /forest/.test(biome) ? 'dirt' : 'rock',
      terrain: 'flat',
      fog: atmosphere === 'misty' ? 0.35 : 0.12,
      lightingStyle: 'neutral',
      colorMood: 'neutral',
      particles: atmosphere === 'misty' ? 'dust' : 'pollen',
      effects: atmosphere === 'misty' ? ['dust'] : ['godrays'],
      structures: ['ruins'],
      treeDensity: /forest/.test(biome) ? 0.35 : 0.15,
    })
  } else if (biome === 'tomb' || biome === 'cave') {
    Object.assign(overlay, {
      environment: 'cave',
      sky: 'overcast',
      ground: 'rock',
      terrain: 'rocky',
      fog: 0.55,
      lighting: 0.35,
      lightingStyle: 'low',
      particles: 'dust',
      effects: ['dust'],
      structures: ['ruins'],
    })
  } else if (biome === 'meadow') {
    Object.assign(overlay, {
      environment: 'meadow',
      sky: 'clear',
      ground: 'grass',
      terrain: 'hilly',
      particles: 'pollen',
      effects: ['godrays'],
      treeDensity: 0.25,
    })
  } else if (biome === 'forest' || biome === 'jungle') {
    Object.assign(overlay, {
      environment: 'forest',
      sky: 'cloudy',
      ground: 'dirt',
      terrain: 'hilly',
      treeDensity: biome === 'jungle' ? 0.95 : 0.75,
      fog: biome === 'jungle' ? 0.4 : 0.25,
      particles: 'none',
      effects: atmosphere === 'godrays' ? ['godrays'] : [],
    })
  } else if (biome === 'orbital' || biome === 'lunar' || biome === 'deep_space') {
    Object.assign(overlay, {
      environment: 'space',
      sky: biome === 'deep_space' ? 'nebula' : 'stars',
      ground: biome === 'lunar' ? 'lunar' : 'none',
      terrain: biome === 'lunar' ? 'lunar' : 'none',
      starDensity: 0.85,
      nebula: biome === 'deep_space' ? 0.7 : 0.15,
      particles: 'stars',
      earthVisible: biome === 'orbital',
      structures:
        biome === 'orbital' ? ['space_station', 'spaceship'] : biome === 'lunar' ? ['lander'] : ['spaceship'],
    })
  } else if (biome === 'alien') {
    Object.assign(overlay, {
      environment: 'swamp',
      sky: 'nebula',
      ground: 'dirt',
      terrain: 'rocky',
      fog: 0.4,
      lightingStyle: 'dramatic',
      colorMood: 'eerie',
      particles: 'sparks',
      nebula: 0.45,
      starDensity: 0.35,
      effects: atmosphere === 'bioluminescent' ? ['embers', 'godrays'] : ['embers'],
      structures: ['ruins', 'rock_arch'],
    })
  } else if (biome === 'urban') {
    Object.assign(overlay, {
      environment: 'city',
      sky: 'overcast',
      ground: 'metal',
      terrain: 'flat',
      fog: 0.35,
      lightingStyle: 'dramatic',
      particles: 'sparks',
    })
  }

  if (atmosphere === 'bioluminescent') {
    overlay.particles = overlay.particles === 'bubbles' ? overlay.particles : 'sparks'
    overlay.effects = [...new Set([...(overlay.effects ?? []), 'embers'])]
    overlay.colorMood = overlay.colorMood || 'eerie'
  }
  if (atmosphere === 'underwater_caustics') {
    overlay.effects = [...new Set([...(overlay.effects ?? []), 'caustics'])]
    overlay.particles = overlay.particles || 'bubbles'
  }
  if (atmosphere === 'pollen') overlay.particles = 'pollen'
  if (atmosphere === 'dusty') {
    overlay.particles = overlay.particles === 'bubbles' ? overlay.particles : 'dust'
    overlay.effects = [...new Set([...(overlay.effects ?? []), 'dust'])]
  }
  if (atmosphere === 'starfield') overlay.starDensity = Math.max(overlay.starDensity ?? 0, 0.8)
  if (atmosphere === 'nebula') overlay.nebula = Math.max(overlay.nebula ?? 0, 0.65)
  if (atmosphere === 'godrays') {
    overlay.effects = [...new Set([...(overlay.effects ?? []), 'godrays'])]
  }

  return overlay
}

/**
 * Prefer dramatic spawn reactions from heuristics when the LLM only provided glow/particles.
 */
export function preferDramaticInteractions(llmRaw, composition, animation = {}) {
  const heuristic = inferInteractions(composition, { static_scene: animation.static_scene })
  const hasLlmList = Array.isArray(llmRaw) || Array.isArray(llmRaw?.events)
  if (!hasLlmList) return heuristic

  const llm = sanitizeInteractions(llmRaw)
  if (!llm.events.length) return heuristic

  const merged = llm.events.map((event) => ({ ...event, reaction: { ...event.reaction } }))
  for (const h of heuristic.events) {
    if (!reactionNeedsSpawn(h.reaction)) continue
    const key = `${h.target}:${h.trigger}`
    const existingIdx = merged.findIndex((e) => `${e.target}:${e.trigger}` === key)
    if (existingIdx >= 0) {
      if (!reactionNeedsSpawn(merged[existingIdx].reaction)) {
        merged[existingIdx] = h
      }
    } else {
      merged.push(h)
    }
  }
  return sanitizeInteractions({ events: merged })
}

/**
 * Expand a room's composition into landmark-safe fill objects + scene overlay.
 * Landmark objects from the LLM are preserved by the caller and merged later.
 */
export function composeRoom(room, theme = '', options = {}) {
  const composition = resolveRoomComposition(room, theme)
  const styleText = styleContextText([
    options.prompt,
    theme,
    room.name,
    room.environment?.description,
    composition.motif,
    ...(room.environment?.tags ?? []),
  ])
  const style = options.style ?? inferStyleIntent(styleText)
  const seed =
    options.seed ??
    hashSeed(`${styleText}:${room.id}:${composition.biome}:${options.entropy ?? ''}`)

  const maxFill = options.maxFill ?? 40
  // Reserve capacity so life (fish/birds) is not crowded out by rocks/coral.
  const featureBudget = Math.max(6, Math.floor(maxFill * 0.35))
  const vegetationBudget = Math.max(6, Math.floor(maxFill * 0.35))
  const lifeBudget = Math.max(4, Math.floor(maxFill * 0.3))

  let objects = [
    ...featureLayer(composition, seed, theme).slice(0, featureBudget),
    ...vegetationLayer(composition, seed + 1000).slice(0, vegetationBudget),
    ...lifeLayer(composition, seed + 2000).slice(0, lifeBudget),
  ]

  // Motif fill: if composition names an unknown concept and layers didn't cover it,
  // scatter generic procedural instances from the motif text.
  if (composition.motif && !objects.some((o) => o.type === 'generic')) {
    const count = Math.max(4, countFor(composition.density, 5, composition.life))
    const forms = formsFromMotif(composition.motif, seed + 3000, count)
    const motifFill = []
    for (let i = 0; i < count; i += 1) {
      const form = forms[i % forms.length]
      const descriptor = exoticGenericDescriptor(form, composition.motif, seed + 3000, i, {
        glowing: /glow|biolum|neon/i.test(composition.motif),
      })
      motifFill.push(
        ...scatterGeneric(composition.motif, 1, seed + 3000 + i * 9, descriptor, {
          radiusMin: 4,
          radiusMax: 15,
          scale: 0.9 + seeded(seed, i + 40) * 0.4,
          y: descriptor.behavior.floating ? 1.4 : 0,
        })
      )
    }
    objects = [...objects, ...motifFill].slice(0, maxFill)
  }

  objects = objects.map((item, index) => applyStyleToNeed(item, style, seed, index))

  const animation =
    room.animation?.behaviors?.length || room.animation?.static_scene
      ? sanitizeAnimation(room.animation)
      : inferAnimation(composition)

  const interactions =
    room.interactions?.events?.length || Array.isArray(room.interactions)
      ? preferDramaticInteractions(room.interactions, composition, animation)
      : inferInteractions(composition, { static_scene: animation.static_scene })

  return {
    composition,
    objects: objects.slice(0, maxFill),
    style,
    scene: {
      ...compositionSceneOverlay(composition, theme),
      animationSpeed: Math.min(1, 0.35 + (animation.behaviors?.length || 0) * 0.04),
    },
    animation,
    interactions,
  }
}

export function mergeSceneConfigs(base, overlay) {
  if (!overlay || typeof overlay !== 'object') return base ?? null
  if (!base || typeof base !== 'object') return { ...overlay }
  const effects = [...new Set([...(base.effects ?? []), ...(overlay.effects ?? [])])].filter((e) => e && e !== 'none')
  const structures = [...new Set([...(overlay.structures ?? []), ...(base.structures ?? [])])].slice(0, 4)
  return {
    ...base,
    ...overlay,
    effects: effects.length ? effects : base.effects,
    structures: structures.length ? structures : base.structures,
  }
}

/**
 * Merge LLM landmarks with composed fill.
 * Skip composer landmarks when the LLM already placed the same major type.
 */
export function mergeComposedObjects(landmarks = [], composed = []) {
  const landmarkMajor = new Set(
    landmarks
      .map((item) => item?.type)
      .filter((type) =>
        ['pyramid', 'temple', 'space_station', 'spaceship', 'habitat', 'castle_tower', 'lander'].includes(type)
      )
  )
  const filtered = composed.filter((item) => {
    if (!landmarkMajor.has(item.type)) {
      return true
    }
    const tags = (item.tags ?? []).join(' ')
    return !/landmark/i.test(tags)
  })
  return [...landmarks, ...filtered]
}
