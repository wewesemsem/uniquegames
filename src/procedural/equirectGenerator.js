import p5 from 'p5'

/**
 * Theme-agnostic p5.js equirectangular (2:1) panorama generator.
 * Driven only by validated SceneConfiguration fields — never LLM code.
 */

const WIDTH = 2048
const HEIGHT = 1024

function moodRgb(mood) {
  switch (mood) {
    case 'warm':
      return [255, 160, 90]
    case 'cool':
      return [100, 160, 255]
    case 'eerie':
      return [150, 100, 220]
    case 'vivid':
      return [255, 210, 90]
    default:
      return [180, 200, 230]
  }
}

function configSeed(scene) {
  const key = JSON.stringify({
    e: scene.environment,
    t: scene.timeOfDay,
    s: scene.sky,
    g: scene.ground,
    tr: scene.terrain,
    sd: scene.starDensity,
    n: scene.nebula,
    p: scene.planetCount,
    st: scene.structures,
    c: scene.colorMood,
    l: scene.lightingStyle,
    ev: scene.earthVisible,
  })
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) || 1
}

function paletteFor(scene) {
  const mood = moodRgb(scene.colorMood)
  const env = scene.environment
  const sky = scene.sky
  const night =
    scene.timeOfDay === 'night' ||
    scene.timeOfDay === 'dusk' ||
    env === 'space' ||
    sky === 'stars' ||
    sky === 'nebula'

  if (sky === 'underwater' || env === 'ocean') {
    return {
      top: [8, 50, 90],
      mid: [20, 100, 140],
      bottom: [10, 40, 70],
      accent: mood,
      night: true,
    }
  }
  if (env === 'space' || sky === 'nebula' || sky === 'stars') {
    return {
      top: [10, 14, 36],
      mid: [22, 28, 58],
      bottom: [8, 10, 24],
      accent: mood,
      night: true,
    }
  }
  if (env === 'egypt' || env === 'desert') {
    return {
      top: night ? [28, 34, 70] : [120, 180, 230],
      mid: night ? [50, 40, 70] : [230, 190, 130],
      bottom: night ? [40, 30, 28] : [200, 150, 90],
      accent: [255, 180, 100],
      night,
    }
  }
  if (env === 'snow') {
    return {
      top: night ? [20, 28, 50] : [170, 200, 230],
      mid: night ? [40, 50, 70] : [220, 230, 240],
      bottom: [210, 220, 230],
      accent: mood,
      night,
    }
  }
  if (env === 'forest' || env === 'swamp') {
    return {
      top: night ? [18, 28, 30] : [90, 150, 200],
      mid: night ? [24, 40, 32] : [140, 180, 140],
      bottom: [40, 70, 40],
      accent: mood,
      night,
    }
  }
  if (env === 'cave') {
    return {
      top: [12, 12, 18],
      mid: [28, 24, 22],
      bottom: [18, 16, 14],
      accent: [255, 180, 80],
      night: true,
    }
  }
  if (env === 'city') {
    return {
      top: night ? [12, 16, 36] : [100, 140, 200],
      mid: night ? [30, 28, 50] : [160, 170, 190],
      bottom: night ? [20, 18, 28] : [70, 70, 80],
      accent: mood,
      night,
    }
  }

  // meadow / mountain / default
  if (scene.timeOfDay === 'sunset' || scene.timeOfDay === 'dawn') {
    return {
      top: [40, 60, 120],
      mid: [255, 140, 80],
      bottom: [80, 50, 40],
      accent: [255, 200, 120],
      night: false,
    }
  }
  return {
    top: night ? [16, 22, 48] : [110, 170, 235],
    mid: night ? [30, 40, 70] : [180, 210, 240],
    bottom: night ? [20, 24, 40] : [90, 130, 70],
    accent: mood,
    night,
  }
}

function runP5Sketch(draw) {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0'
    document.body.appendChild(host)

    let settled = false
    let instance = null

    const finish = (value, isError = false) => {
      if (settled) {
        return
      }
      settled = true
      try {
        instance?.remove?.()
      } catch {
        /* ignore */
      }
      host.remove()
      if (isError) {
        reject(value)
      } else {
        resolve(value)
      }
    }

    try {
      instance = new p5((p) => {
        p.setup = () => {
          try {
            p.pixelDensity(1)
            const canvas = p.createCanvas(WIDTH, HEIGHT)
            // Force 2D renderer — never WEBGL (would fight R3F).
            draw(p)
            const out = document.createElement('canvas')
            out.width = WIDTH
            out.height = HEIGHT
            out.getContext('2d').drawImage(canvas.elt, 0, 0)
            finish(out)
          } catch (error) {
            finish(error, true)
          }
        }
      }, host)
    } catch (error) {
      finish(error, true)
    }
  })
}

function drawGradient(p, colors) {
  for (let y = 0; y < HEIGHT; y += 1) {
    const t = y / HEIGHT
    let r
    let g
    let b
    if (t < 0.55) {
      const u = t / 0.55
      r = p.lerp(colors.top[0], colors.mid[0], u)
      g = p.lerp(colors.top[1], colors.mid[1], u)
      b = p.lerp(colors.top[2], colors.mid[2], u)
    } else {
      const u = (t - 0.55) / 0.45
      r = p.lerp(colors.mid[0], colors.bottom[0], u)
      g = p.lerp(colors.mid[1], colors.bottom[1], u)
      b = p.lerp(colors.mid[2], colors.bottom[2], u)
    }
    p.stroke(r, g, b)
    p.line(0, y, WIDTH, y)
  }
}

function drawStars(p, density, night) {
  const count = Math.round(density * (night ? 1600 : 400))
  p.noStroke()
  for (let i = 0; i < count; i += 1) {
    const x = p.random(WIDTH)
    const y = p.random(HEIGHT * 0.72)
    const bright = p.random(140, 255)
    const size = p.random() > 0.93 ? p.random(1.6, 2.8) : p.random(0.4, 1.3)
    p.fill(bright, bright, Math.min(255, bright + 25), night ? 230 : 120)
    p.circle(x, y, size)
  }
}

function drawNebula(p, amount, accent) {
  if (amount < 0.03) {
    return
  }
  p.noStroke()
  const blobs = Math.round(6 + amount * 16)
  for (let i = 0; i < blobs; i += 1) {
    const x = p.random(WIDTH)
    const y = p.random(HEIGHT * 0.15, HEIGHT * 0.7)
    const radius = p.random(90, 260) * (0.45 + amount)
    for (let k = 0; k < 4; k += 1) {
      const alpha = (10 + amount * 36) / (k + 1)
      p.fill(accent[0], accent[1], accent[2], alpha)
      p.ellipse(
        x + p.random(-50, 50),
        y + p.random(-30, 30),
        radius * (1 - k * 0.14),
        radius * 0.5 * (1 - k * 0.1)
      )
    }
  }
}

function drawPlanets(p, count, accent, earthVisible) {
  const total = Math.max(0, Math.min(6, count)) + (earthVisible ? 1 : 0)
  for (let i = 0; i < total; i += 1) {
    const x = p.random(WIDTH * 0.1, WIDTH * 0.9)
    const y = p.random(HEIGHT * 0.12, HEIGHT * 0.55)
    const radius = p.random(18, 55) * (i === 0 && earthVisible ? 1.35 : 1)
    const isEarth = earthVisible && i === total - 1
    if (isEarth) {
      p.noStroke()
      p.fill(50, 110, 200)
      p.circle(x, y, radius * 2)
      p.fill(40, 150, 80, 160)
      p.circle(x - radius * 0.2, y + radius * 0.1, radius * 0.9)
      p.fill(180, 220, 255, 50)
      p.circle(x, y, radius * 2.15)
    } else {
      const shade = p.random(0.6, 1)
      p.noStroke()
      p.fill(accent[0] * shade, accent[1] * shade * 0.85, accent[2] * shade * 0.7)
      p.circle(x, y, radius * 2)
      p.fill(255, 255, 255, 35)
      p.circle(x - radius * 0.25, y - radius * 0.25, radius * 0.7)
      if (p.random() > 0.7) {
        p.noFill()
        p.stroke(220, 200, 160, 120)
        p.strokeWeight(radius * 0.12)
        p.ellipse(x, y, radius * 3.1, radius * 0.7)
        p.noStroke()
      }
    }
  }
}

function drawClouds(p, sky, windHint = 0.3) {
  if (sky === 'clear' || sky === 'stars' || sky === 'nebula' || sky === 'underwater') {
    return
  }
  const count = sky === 'stormy' ? 18 : sky === 'overcast' ? 14 : 8
  p.noStroke()
  for (let i = 0; i < count; i += 1) {
    const x = p.random(WIDTH)
    const y = p.random(HEIGHT * 0.2, HEIGHT * 0.55)
    const w = p.random(80, 220)
    const alpha = sky === 'stormy' ? 90 : 55
    p.fill(sky === 'stormy' ? 60 : 240, sky === 'stormy' ? 70 : 245, sky === 'stormy' ? 80 : 250, alpha)
    p.ellipse(x, y, w, w * 0.45)
    p.ellipse(x + w * 0.25 * (0.5 + windHint), y - 8, w * 0.7, w * 0.35)
    p.ellipse(x - w * 0.2, y + 6, w * 0.6, w * 0.3)
  }
}

function drawHorizonTerrain(p, scene, colors) {
  if (scene.environment === 'space' || scene.ground === 'none' || scene.terrain === 'none') {
    return
  }

  const horizon = HEIGHT * 0.62
  p.noStroke()

  // Ground band
  const groundColors = {
    grass: [55, 110, 60],
    sand: [194, 164, 107],
    rock: [100, 96, 92],
    snow: [230, 236, 245],
    water: [30, 90, 120],
    dirt: [100, 72, 45],
    metal: [80, 88, 100],
    lunar: [150, 148, 145],
  }
  const g = groundColors[scene.ground] ?? groundColors.grass
  p.fill(g[0], g[1], g[2])
  p.rect(0, horizon, WIDTH, HEIGHT - horizon)

  // Terrain silhouette
  p.fill(g[0] * 0.75, g[1] * 0.75, g[2] * 0.75)
  p.beginShape()
  p.vertex(0, HEIGHT)
  p.vertex(0, horizon)
  const steps = 64
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * WIDTH
    const n = p.noise(i * 0.18 + 2.1)
    let lift = 0
    if (scene.terrain === 'hilly' || scene.terrain === 'rocky' || scene.environment === 'mountain') {
      lift = n * 90
    } else if (scene.terrain === 'lunar') {
      lift = (n - 0.5) * 40
    } else if (scene.terrain === 'desert') {
      lift = Math.sin(i * 0.35) * 28 + n * 20
    } else if (scene.terrain === 'ocean_floor') {
      lift = n * 50
    } else {
      lift = n * 18
    }
    p.vertex(x, horizon - lift)
  }
  p.vertex(WIDTH, HEIGHT)
  p.endShape(p.CLOSE)

  // Structure silhouettes on the horizon (equirect strip)
  const structures = scene.structures ?? []
  structures.forEach((type, index) => {
    const x = ((index + 0.5) / Math.max(structures.length, 1)) * WIDTH * 0.7 + WIDTH * 0.15
    const baseY = horizon - 4
    p.fill(colors.night ? 30 : 50, colors.night ? 28 : 45, colors.night ? 40 : 40, 200)
    if (type === 'pyramid' || type === 'temple') {
      p.triangle(x, baseY - 110, x - 70, baseY, x + 70, baseY)
    } else if (type === 'obelisk' || type === 'columns') {
      p.rect(x - 6, baseY - 100, 12, 100)
      if (type === 'columns') {
        p.rect(x - 30, baseY - 80, 10, 80)
        p.rect(x + 20, baseY - 80, 10, 80)
      }
    } else if (type === 'space_station' || type === 'spaceship' || type === 'lander' || type === 'habitat') {
      p.ellipse(x, baseY - 50, 90, 40)
      p.rect(x - 8, baseY - 70, 16, 40)
    } else if (type === 'coral' || type === 'reef') {
      for (let k = 0; k < 5; k += 1) {
        p.rect(x + k * 12 - 24, baseY - 20 - k * 10, 8, 20 + k * 10)
      }
    } else if (type === 'ruins' || type === 'rock_arch') {
      p.rect(x - 40, baseY - 70, 14, 70)
      p.rect(x + 26, baseY - 70, 14, 70)
      p.rect(x - 40, baseY - 84, 80, 14)
    }
  })
}

function drawAtmosphericEffects(p, scene, colors) {
  const effects = new Set(scene.effects ?? [])
  if (effects.has('godrays') || scene.timeOfDay === 'sunset' || scene.timeOfDay === 'dawn') {
    p.noStroke()
    for (let i = 0; i < 8; i += 1) {
      const x = WIDTH * (0.2 + i * 0.08)
      p.fill(colors.accent[0], colors.accent[1], colors.accent[2], 12)
      p.triangle(x, HEIGHT * 0.15, x - 40, HEIGHT * 0.7, x + 40, HEIGHT * 0.7)
    }
  }
  if (effects.has('caustics') || scene.sky === 'underwater') {
    p.noStroke()
    for (let i = 0; i < 40; i += 1) {
      p.fill(120, 220, 255, 18)
      p.ellipse(p.random(WIDTH), p.random(HEIGHT * 0.3, HEIGHT * 0.85), p.random(20, 80), p.random(8, 24))
    }
  }
  if (effects.has('aurora') || (scene.nebula > 0.5 && scene.environment === 'space')) {
    p.noStroke()
    for (let i = 0; i < 5; i += 1) {
      p.fill(colors.accent[0], colors.accent[1], 255, 18)
      p.ellipse(p.random(WIDTH), p.random(HEIGHT * 0.15, HEIGHT * 0.4), p.random(200, 400), p.random(40, 90))
    }
  }
  if (effects.has('dust') || effects.has('heat_haze') || scene.particles === 'sand' || scene.particles === 'dust') {
    p.noStroke()
    for (let i = 0; i < 120; i += 1) {
      p.fill(220, 200, 160, 40)
      p.circle(p.random(WIDTH), p.random(HEIGHT * 0.4, HEIGHT), p.random(1, 3))
    }
  }
}

/**
 * Generate a 2:1 equirectangular canvas from a SceneConfiguration.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function generateEquirectangularPanorama(scene) {
  const seed = configSeed(scene)
  const colors = paletteFor(scene)
  const starDensity =
    typeof scene.starDensity === 'number'
      ? scene.starDensity
      : scene.environment === 'space' || scene.sky === 'stars' || scene.sky === 'nebula'
        ? 0.7
        : colors.night
          ? 0.35
          : 0

  return runP5Sketch((p) => {
    p.noiseSeed(seed)
    p.randomSeed(seed)
    drawGradient(p, colors)
    drawNebula(p, scene.nebula ?? 0, colors.accent)
    drawStars(p, starDensity, colors.night || scene.environment === 'space')
    drawPlanets(p, scene.planetCount ?? 0, colors.accent, Boolean(scene.earthVisible))
    drawClouds(p, scene.sky, scene.wind ?? 0.3)
    drawHorizonTerrain(p, scene, colors)
    drawAtmosphericEffects(p, scene, colors)

    // Soft vignette for depth
    p.noFill()
    for (let i = 0; i < 40; i += 1) {
      p.stroke(0, 0, 0, i * 0.7)
      p.rect(i, i, WIDTH - i * 2, HEIGHT - i * 2)
    }
  })
}

export function panoramaCacheKey(scene) {
  return String(configSeed(scene ?? {}))
}
