import { createServer } from 'node:http'
import { createApp } from './create-app.js'
import { createLogger } from './logging.js'

const env = process.env
const port = Number.parseInt(String(env.PORT || '3000'), 10) || 3000
const log = createLogger()
const app = createApp(env)

const server = createServer(app)

server.listen(port, () => {
  log('api_listen', { port, environmentMode: env.ENVIRONMENT_MODE || 'PROCEDURAL_360' })
})

function shutdown(signal) {
  log('api_shutdown', { signal })
  server.close(() => {
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
