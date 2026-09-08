import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'panoramas')

const FONT = {
  ' ': [0, 0, 0, 0, 0],
  0: [0x3e, 0x45, 0x49, 0x51, 0x3e],
  1: [0x00, 0x21, 0x7f, 0x01, 0x00],
  2: [0x21, 0x43, 0x45, 0x49, 0x31],
  3: [0x42, 0x41, 0x51, 0x69, 0x46],
  A: [0x3f, 0x44, 0x44, 0x44, 0x3f],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  G: [0x3e, 0x41, 0x49, 0x49, 0x2e],
  L: [0x7f, 0x01, 0x01, 0x01, 0x01],
  M: [0x7f, 0x20, 0x18, 0x20, 0x7f],
  N: [0x7f, 0x10, 0x08, 0x04, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  R: [0x7f, 0x48, 0x4c, 0x4a, 0x31],
  S: [0x32, 0x49, 0x49, 0x49, 0x26],
  W: [0x7e, 0x01, 0x0e, 0x01, 0x7e],
}

const ROOMS = [
  {
    file: 'room-1.jpg',
    title: 'ROOM 1',
    sky: [255, 168, 92],
    skyTop: [74, 42, 78],
    floor: [92, 58, 42],
    wall: [186, 96, 72],
    accent: [255, 214, 120],
    doorLon: 0.5,
  },
  {
    file: 'room-2.jpg',
    title: 'ROOM 2',
    sky: [140, 190, 255],
    skyTop: [28, 48, 92],
    floor: [48, 62, 88],
    wall: [64, 110, 168],
    accent: [160, 230, 255],
    doorLon: -0.5,
  },
  {
    file: 'room-3.jpg',
    title: 'ROOM 3',
    sky: [168, 230, 170],
    skyTop: [22, 58, 48],
    floor: [48, 72, 42],
    wall: [72, 128, 86],
    accent: [210, 255, 170],
    doorLon: 0.0,
  },
]

const WIDTH = 2048
const HEIGHT = 1024

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
}

function drawChar(pixels, originX, originY, ch, scale, color) {
  const glyph = FONT[ch] ?? FONT[' ']
  for (let col = 0; col < 5; col += 1) {
    const bits = glyph[col]
    for (let row = 0; row < 7; row += 1) {
      if (((bits >> row) & 1) === 0) {
        continue
      }
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = originX + col * scale + dx
          const y = originY + row * scale + dy
          if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
            continue
          }
          const i = (y * WIDTH + x) * 3
          pixels[i] = color[0]
          pixels[i + 1] = color[1]
          pixels[i + 2] = color[2]
        }
      }
    }
  }
}

function drawText(pixels, cx, cy, text, scale, color) {
  const glyphW = 6 * scale
  const width = text.length * glyphW
  let x = Math.round(cx - width / 2)
  const y = Math.round(cy - (7 * scale) / 2)
  for (const ch of text) {
    drawChar(pixels, x, y, ch, scale, color)
    x += glyphW
  }
}

function generateRoom(spec) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)

  for (let y = 0; y < HEIGHT; y += 1) {
    const v = y / (HEIGHT - 1)
    const lat = (0.5 - v) * Math.PI
    for (let x = 0; x < WIDTH; x += 1) {
      const u = x / WIDTH
      const lon = u * Math.PI * 2 - Math.PI
      const i = (y * WIDTH + x) * 3

      let color
      if (lat > 0.18) {
        const t = (lat - 0.18) / (Math.PI / 2 - 0.18)
        color = mix(spec.sky, spec.skyTop, Math.min(1, t))
      } else if (lat < -0.12) {
        const t = Math.min(1, (-0.12 - lat) / (Math.PI / 2 - 0.12))
        color = mix(spec.floor, [20, 18, 16], t * 0.45)
      } else {
        const panel = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * 8)
        const stripe = panel % 2 === 0 ? spec.wall : mix(spec.wall, spec.accent, 0.18)
        color = stripe
      }

      const doorDelta = Math.abs(Math.atan2(Math.sin(lon - spec.doorLon), Math.cos(lon - spec.doorLon)))
      if (doorDelta < 0.22 && lat < 0.28 && lat > -0.12) {
        color = mix(spec.accent, [255, 255, 255], 0.25)
      }

      const grid = Math.abs(lat) < 0.008 ? 1 : 0
      if (grid) {
        color = mix(color, [255, 255, 255], 0.35)
      }

      pixels[i] = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
    }
  }

  drawText(pixels, WIDTH / 2, HEIGHT * 0.42, spec.title, 10, [255, 255, 255])
  drawText(pixels, WIDTH / 2, HEIGHT * 0.18, 'N', 6, spec.accent)
  drawText(pixels, WIDTH * 0.75, HEIGHT * 0.42, 'E', 6, spec.accent)
  drawText(pixels, WIDTH / 2, HEIGHT * 0.72, 'S', 6, spec.accent)
  drawText(pixels, WIDTH * 0.25, HEIGHT * 0.42, 'W', 6, spec.accent)

  return pixels
}

mkdirSync(outDir, { recursive: true })

for (const room of ROOMS) {
  const pixels = generateRoom(room)
  const ppm = join(outDir, `${room.file.replace('.jpg', '')}.ppm`)
  const jpg = join(outDir, room.file)
  const header = Buffer.from(`P6\n${WIDTH} ${HEIGHT}\n255\n`)
  writeFileSync(ppm, Buffer.concat([header, pixels]))
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', ppm, '--out', jpg])
  unlinkSync(ppm)
  console.log(`wrote ${jpg}`)
}
