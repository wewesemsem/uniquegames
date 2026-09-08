import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { worldApiPlugin } from './server/vite-plugin-world-api.js'

// localhost over HTTP is already a secure context, so WebXR works there
// without a certificate. LAN IPs used by a headset are not secure unless
// HTTPS is enabled: HTTPS=1 npm run dev
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useHttps = process.env.HTTPS === '1' || env.HTTPS === '1'

  return {
    plugins: [react(), worldApiPlugin(env), ...(useHttps ? [basicSsl()] : [])],
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  }
})
