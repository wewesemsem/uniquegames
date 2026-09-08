import { Readable } from 'node:stream'

export function createMockReq({ body = { prompt: 'I want to explore space.' }, ip = '127.0.0.1', headers = {}, raw } = {}) {
  const payload = raw ?? Buffer.from(JSON.stringify(body))
  const req = Readable.from([payload])
  req.headers = { 'content-type': 'application/json', ...headers }
  req.socket = { remoteAddress: ip }
  req.method = 'POST'
  req.url = '/api/world/generate'
  return req
}

export function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: '',
    payload: null,
    events: [],
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value)
    },
    flushHeaders() {
      this.headersSent = true
    },
    flush() {},
    write(text) {
      this.headersSent = true
      const chunk = String(text ?? '')
      this.body += chunk
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }
        try {
          this.events.push(JSON.parse(trimmed))
        } catch {
          // Incomplete JSON across chunks is assembled on end().
        }
      }
    },
    end(text) {
      if (text != null && text !== '') {
        this.write(String(text))
      }
      const trimmed = this.body.trim()
      if (!trimmed) {
        this.payload = null
        return
      }
      try {
        this.payload = JSON.parse(trimmed)
      } catch {
        this.payload = this.events.find((event) => event.type === 'done') ?? this.events.at(-1) ?? null
      }
    },
  }
}

export function spaceSpec() {
  return {
    theme: 'space',
    description: 'An exploration of outer space',
    rooms: [
      {
        id: 'room1',
        name: 'Orbital Station',
        environment: {
          type: 'panorama',
          description: 'Orbital space station overlooking Earth and distant stars',
          tags: ['space', 'station', 'orbit'],
        },
        objects: [{ type: 'console', description: 'Station console', tags: ['console'] }],
        hotspots: [{ id: 'to-2', label: 'Moon', targetRoom: 'room2', description: 'Go to the moon' }],
      },
      {
        id: 'room2',
        name: 'Moon Surface',
        environment: {
          type: 'panorama',
          description: 'A grey lunar landscape under a black sky with Earth visible',
          tags: ['moon', 'lunar'],
        },
        objects: [],
        hotspots: [],
      },
      {
        id: 'room3',
        name: 'Deep Space',
        environment: {
          type: 'panorama',
          description: 'Deep space nebula field with distant planets',
          tags: ['nebula', 'deep', 'space'],
        },
        objects: [],
        hotspots: [],
      },
    ],
  }
}
