import p5 from 'p5'

/**
 * Faithful wesamsam meadow atmosphere → persistent 2:1 equirectangular painter.
 * Sizes are scaled for a 2048×1024 panorama so blooms/particles read on a 360° sphere.
 */

const WIDTH = 2048
const HEIGHT = 1024
// wesamsam sketches were ~board-sized; bump stroke/radii so flora survives sphere mip-ish sampling
const S = WIDTH / 720

const SAGE = [
  [120, 148, 110],
  [98, 130, 95],
  [140, 160, 120],
  [110, 140, 105],
]
const BLOOM = [
  [220, 180, 175],
  [235, 210, 170],
  [200, 195, 210],
  [230, 200, 185],
  [190, 205, 195],
]
const PETAL = [
  [235, 200, 195],
  [245, 225, 190],
  [215, 205, 220],
]

function rand(a, b) {
  return a + Math.random() * (b - a)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function n01(p, x, y, z) {
  return p.noise(x, y, z)
}

function sway(p, seed, t, amp, speed) {
  const n = n01(p, seed * 0.17, t * speed, seed * 0.03)
  return (n - 0.5) * 2 * amp * S
}

function seedMeadow() {
  const grasses = []
  for (let i = 0; i < 28; i += 1) {
    grasses.push({
      x: rand(0.02, 0.98),
      baseY: rand(0.7, 0.84),
      h: rand(0.08, 0.16),
      depth: rand(0.15, 0.35),
      seed: rand(0, 100),
      amp: rand(2, 5),
      speed: rand(0.0006, 0.0012),
      color: pick(SAGE),
      thick: rand(1.1, 1.8) * S,
    })
  }
  for (let i = 0; i < 42; i += 1) {
    grasses.push({
      x: rand(0.01, 0.99),
      baseY: rand(0.78, 0.94),
      h: rand(0.12, 0.24),
      depth: rand(0.4, 0.7),
      seed: rand(0, 100),
      amp: rand(4, 9),
      speed: rand(0.0008, 0.0016),
      color: pick(SAGE),
      thick: rand(1.4, 2.4) * S,
    })
  }
  for (let i = 0; i < 36; i += 1) {
    grasses.push({
      x: rand(0, 1),
      baseY: rand(0.88, 1.02),
      h: rand(0.16, 0.32),
      depth: rand(0.75, 1),
      seed: rand(0, 100),
      amp: rand(7, 14),
      speed: rand(0.001, 0.0022),
      color: pick(SAGE),
      thick: rand(1.8, 3.2) * S,
    })
  }

  const blooms = []
  for (let i = 0; i < 30; i += 1) {
    blooms.push({
      x: rand(0.05, 0.95),
      y: rand(0.55, 0.76),
      r: rand(2.5, 5) * S * 1.35,
      depth: rand(0.12, 0.35),
      seed: rand(0, 100),
      amp: rand(1.5, 3.5),
      speed: rand(0.0005, 0.001),
      color: pick(BLOOM),
      alpha: rand(110, 170),
      petals: 4 + Math.floor(Math.random() * 2),
    })
  }
  for (let i = 0; i < 28; i += 1) {
    blooms.push({
      x: rand(0.04, 0.96),
      y: rand(0.62, 0.88),
      r: rand(4, 7.5) * S * 1.35,
      depth: rand(0.4, 0.7),
      seed: rand(0, 100),
      amp: rand(3, 7),
      speed: rand(0.0007, 0.0014),
      color: pick(BLOOM),
      alpha: rand(140, 200),
      petals: 5,
    })
  }
  for (let i = 0; i < 22; i += 1) {
    blooms.push({
      x: rand(0.02, 0.98),
      y: rand(0.72, 0.96),
      r: rand(5.5, 9) * S * 1.4,
      depth: rand(0.75, 1),
      seed: rand(0, 100),
      amp: rand(5, 11),
      speed: rand(0.0009, 0.0018),
      color: pick(BLOOM),
      alpha: rand(160, 220),
      petals: 5 + Math.floor(Math.random() * 2),
    })
  }

  const particles = []
  for (let i = 0; i < 48; i += 1) {
    particles.push({
      kind: Math.random() > 0.55 ? 'pollen' : 'dust',
      x: rand(0, 1),
      y: rand(0.05, 0.95),
      r: rand(1.2, 3.2) * S,
      depth: rand(0.3, 0.95),
      seed: rand(0, 100),
      drift: rand(0.00015, 0.00045),
      alpha: rand(70, 140),
    })
  }
  for (let i = 0; i < 22; i += 1) {
    particles.push({
      kind: 'petal',
      x: rand(0, 1),
      y: rand(0.1, 0.85),
      r: rand(3.5, 7) * S,
      depth: rand(0.45, 1),
      seed: rand(0, 100),
      drift: rand(0.0002, 0.0005),
      alpha: rand(110, 180),
      color: pick(PETAL),
      spin: rand(0, Math.PI * 2),
    })
  }

  const haze = []
  for (let i = 0; i < 5; i += 1) {
    haze.push({
      x: rand(0.1, 0.9),
      y: rand(0.08, 0.42),
      w: rand(0.22, 0.42),
      h: rand(0.08, 0.18),
      depth: rand(0.05, 0.25),
      seed: rand(0, 100),
      alpha: rand(22, 42),
    })
  }

  const rays = []
  for (let i = 0; i < 6; i += 1) {
    rays.push({
      angle: rand(-0.35, 0.55),
      width: rand(0.04, 0.1),
      alpha: rand(12, 26),
      seed: rand(0, 100),
      length: rand(0.7, 1.15),
    })
  }

  const iridescence = []
  for (let i = 0; i < 4; i += 1) {
    iridescence.push({
      x: rand(0.2, 0.85),
      y: rand(0.12, 0.5),
      w: rand(0.18, 0.35),
      h: rand(0.06, 0.14),
      seed: rand(0, 100),
      lifePhase: rand(0, Math.PI * 2),
    })
  }

  grasses.sort((a, b) => a.depth - b.depth)
  blooms.sort((a, b) => a.depth - b.depth)

  return { grasses, blooms, particles, haze, rays, iridescence }
}

function drawSky(p, t) {
  p.push()
  p.noStroke()
  // Clear blue daytime sky (playground request) with soft horizon warmth
  for (let i = 0; i < 12; i += 1) {
    const y0 = (HEIGHT * i) / 12
    const y1 = (HEIGHT * (i + 1)) / 12 + 1
    const k = i / 11
    const r = 120 + k * 70
    const g = 175 + k * 40
    const b = 235 - k * 15
    p.fill(r, g, b)
    p.rect(0, y0, WIDTH, y1 - y0)
  }
  const breath = (n01(p, t * 0.0004, 1.2, 2.4) - 0.5) * 12 * S
  const sx = WIDTH * 0.78 + breath
  const sy = HEIGHT * 0.2
  p.fill(255, 240, 180, 32)
  p.ellipse(sx, sy, HEIGHT * 0.5, HEIGHT * 0.42)
  p.fill(255, 245, 200, 48)
  p.ellipse(sx, sy, HEIGHT * 0.24, HEIGHT * 0.2)
  p.fill(255, 252, 230, 70)
  p.ellipse(sx, sy, HEIGHT * 0.1, HEIGHT * 0.09)
  p.pop()
  return { sx, sy }
}

function drawDistantHills(p, t) {
  p.push()
  p.noStroke()
  const drift = sway(p, 3.3, t, 6, 0.00035)
  p.fill(170, 185, 155, 70)
  p.beginShape()
  p.vertex(-20 + drift, HEIGHT)
  for (let i = 0; i <= 18; i += 1) {
    const x = (WIDTH * i) / 18 + drift
    const y = HEIGHT * 0.6 + n01(p, i * 0.35, t * 0.0002, 8) * HEIGHT * 0.08
    p.vertex(x, y)
  }
  p.vertex(WIDTH + 20 + drift, HEIGHT)
  p.endShape(p.CLOSE)

  const drift2 = sway(p, 7.1, t, 8, 0.0004)
  p.fill(145, 168, 130, 95)
  p.beginShape()
  p.vertex(-20 + drift2, HEIGHT)
  for (let i = 0; i <= 20; i += 1) {
    const x = (WIDTH * i) / 20 + drift2
    const y = HEIGHT * 0.68 + n01(p, i * 0.4 + 2, t * 0.00025, 9) * HEIGHT * 0.1
    p.vertex(x, y)
  }
  p.vertex(WIDTH + 20 + drift2, HEIGHT)
  p.endShape(p.CLOSE)

  p.fill(105, 140, 90)
  p.rect(0, HEIGHT * 0.78, WIDTH, HEIGHT * 0.22)
  p.pop()
}

function drawHaze(p, meadow, t) {
  p.push()
  p.noStroke()
  for (const h of meadow.haze) {
    const dx = sway(p, h.seed, t, 10, 0.0004)
    const dy = sway(p, h.seed + 1, t, 5, 0.00035)
    p.fill(255, 248, 235, h.alpha)
    p.ellipse(WIDTH * h.x + dx, HEIGHT * h.y + dy, WIDTH * h.w, HEIGHT * h.h)
  }
  p.pop()
}

function drawRays(p, meadow, sun, t) {
  p.push()
  p.noStroke()
  for (const ray of meadow.rays) {
    const pulse = 0.75 + n01(p, ray.seed, t * 0.0005, 4) * 0.5
    const a = Math.floor(ray.alpha * pulse)
    const ang = ray.angle + sway(p, ray.seed, t, 0.04, 0.0003) / S
    const len = HEIGHT * ray.length
    const half = WIDTH * ray.width * 0.5
    p.push()
    p.translate(sun.sx, sun.sy)
    p.rotate(ang)
    p.fill(255, 235, 180, a)
    p.beginShape()
    p.vertex(0, 0)
    p.vertex(half, len)
    p.vertex(-half, len)
    p.endShape(p.CLOSE)
    p.pop()
  }
  p.pop()
}

function drawIridescence(p, meadow, t) {
  const bands = [
    [255, 190, 190],
    [255, 220, 170],
    [200, 220, 190],
    [190, 210, 230],
    [220, 200, 230],
  ]
  p.push()
  p.noStroke()
  for (const ir of meadow.iridescence) {
    const life =
      0.25 +
      0.55 *
        (0.5 +
          0.5 *
            Math.sin(t * 0.0011 + ir.lifePhase) *
            (0.6 + n01(p, ir.seed, t * 0.0004, 5) * 0.4))
    if (life < 0.08) continue
    const dx = sway(p, ir.seed, t, 18, 0.00035)
    const dy = sway(p, ir.seed + 2, t, 10, 0.0003)
    const cx = WIDTH * ir.x + dx
    const cy = HEIGHT * ir.y + dy
    for (let b = 0; b < bands.length; b += 1) {
      const [r, g, bl] = bands[b]
      p.fill(r, g, bl, Math.floor(18 * life))
      p.ellipse(
        cx + (b - 2) * WIDTH * 0.012,
        cy,
        WIDTH * ir.w * (1 - b * 0.08),
        HEIGHT * ir.h * (1 - b * 0.05)
      )
    }
  }
  p.pop()
}

function drawGrassBlade(p, g, t) {
  const baseX = WIDTH * g.x
  const baseY = HEIGHT * Math.min(0.99, g.baseY)
  const h = HEIGHT * g.h
  const tipSway = sway(p, g.seed, t, g.amp, g.speed)
  const midSway = tipSway * 0.45
  const [r, gr, b] = g.color
  const alpha = Math.floor(90 + g.depth * 110)
  p.push()
  p.noFill()
  p.stroke(r, gr, b, alpha)
  p.strokeWeight(g.thick)
  p.bezier(
    baseX,
    baseY,
    baseX + midSway * 0.3,
    baseY - h * 0.4,
    baseX + midSway,
    baseY - h * 0.75,
    baseX + tipSway,
    baseY - h
  )
  p.pop()
}

function drawBloom(p, f, t) {
  const swayX = sway(p, f.seed, t, f.amp, f.speed)
  const swayY = sway(p, f.seed + 3, t, f.amp * 0.35, f.speed * 0.9)
  const x = WIDTH * f.x + swayX
  const y = HEIGHT * f.y + swayY
  const [r, g, b] = f.color
  const a = Math.floor(f.alpha)

  p.push()
  p.noStroke()
  if (f.depth > 0.45) {
    p.stroke(110, 140, 100, Math.floor(a * 0.4))
    p.strokeWeight(1.4 * S)
    p.line(x - swayX * 0.2, y + f.r * 1.6, x, y)
    p.noStroke()
  }
  for (let i = 0; i < f.petals; i += 1) {
    const ang = (Math.PI * 2 * i) / f.petals + f.seed
    p.fill(r, g, b, a)
    p.circle(x + Math.cos(ang) * f.r * 0.55, y + Math.sin(ang) * f.r * 0.55, f.r)
  }
  p.fill(245, 230, 180, Math.floor(a * 0.9))
  p.circle(x, y, f.r * 0.7)
  p.pop()
}

function drawParticles(p, meadow, t) {
  p.push()
  p.noStroke()
  for (const pt of meadow.particles) {
    const nx = n01(p, pt.seed, t * pt.drift, 1.1)
    const ny = n01(p, pt.seed + 5, t * pt.drift * 0.85, 2.2)
    pt.x += (nx - 0.48) * 0.0009 * (0.5 + pt.depth)
    pt.y += (ny - 0.52) * 0.0007 + 0.00005
    if (pt.x < -0.05) pt.x = 1.05
    if (pt.x > 1.05) pt.x = -0.05
    if (pt.y < -0.05) pt.y = 1.05
    if (pt.y > 1.05) pt.y = -0.05
    if (pt.kind === 'petal') pt.spin += 0.008 + pt.depth * 0.01

    const x = WIDTH * pt.x + sway(p, pt.seed, t, 4 + pt.depth * 6, 0.0007)
    const y = HEIGHT * pt.y + sway(p, pt.seed + 1, t, 3, 0.0006)

    if (pt.kind === 'petal') {
      const [r, g, b] = pt.color
      p.push()
      p.translate(x, y)
      p.rotate(pt.spin || 0)
      p.fill(r, g, b, pt.alpha)
      p.ellipse(0, 0, pt.r * 1.8, pt.r * 0.8)
      p.pop()
    } else {
      p.fill(255, 245, 220, pt.alpha)
      p.circle(x, y, pt.r)
    }
  }
  p.pop()
}

function paintFrame(p, meadow, t) {
  const sun = drawSky(p, t)
  drawDistantHills(p, t)
  drawHaze(p, meadow, t)
  drawRays(p, meadow, sun, t)
  drawIridescence(p, meadow, t)

  const { grasses, blooms } = meadow
  for (const g of grasses) {
    if (g.depth < 0.55) drawGrassBlade(p, g, t)
  }
  for (const f of blooms) {
    if (f.depth < 0.55) drawBloom(p, f, t)
  }
  for (const g of grasses) {
    if (g.depth >= 0.55 && g.depth < 0.8) drawGrassBlade(p, g, t)
  }
  for (const f of blooms) {
    if (f.depth >= 0.55 && f.depth < 0.8) drawBloom(p, f, t)
  }
  drawParticles(p, meadow, t)
  for (const g of grasses) {
    if (g.depth >= 0.8) drawGrassBlade(p, g, t)
  }
  for (const f of blooms) {
    if (f.depth >= 0.8) drawBloom(p, f, t)
  }
}

/**
 * @returns {Promise<{ canvas: HTMLCanvasElement, draw: (timeMs: number) => void, dispose: () => void }>}
 */
export function createMeadowPainter() {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0'
    document.body.appendChild(host)

    let instance = null
    let settled = false
    const meadow = seedMeadow()

    const fail = (error) => {
      if (settled) return
      settled = true
      try {
        instance?.remove?.()
      } catch {
        /* ignore */
      }
      host.remove()
      reject(error)
    }

    try {
      instance = new p5((p) => {
        p.setup = () => {
          try {
            p.pixelDensity(1)
            p.createCanvas(WIDTH, HEIGHT)
            p.noiseSeed(42)
            p.noLoop()

            const draw = (timeMs = 0) => {
              paintFrame(p, meadow, timeMs)
            }
            draw(0)

            if (settled) return
            settled = true
            resolve({
              canvas: p.canvas,
              draw,
              dispose: () => {
                try {
                  instance?.remove?.()
                } catch {
                  /* ignore */
                }
                host.remove()
              },
            })
          } catch (error) {
            fail(error)
          }
        }
      }, host)
    } catch (error) {
      fail(error)
    }
  })
}
