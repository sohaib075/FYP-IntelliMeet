import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

/**
 * Where the Express API listens on THIS machine. The dev server proxies to it,
 * so the browser only ever talks to one origin: the page's own. That is what
 * lets a second device on the same Wi-Fi work — its "localhost" is itself, so
 * it can never reach an API addressed as http://localhost:3001.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001'

export default defineConfig(({ mode }) => {
  /**
   * `npm run dev:lan` (mode "lan") serves the app to other devices on the
   * same network. Two things change, and both are required:
   *
   *  - host: true  → listen on the Wi-Fi interface, not just localhost.
   *  - HTTPS       → browsers only allow camera and microphone on https:// or
   *                  on localhost. Over plain http://192.168.x.x a second
   *                  device gets no getUserMedia at all, so a meeting would
   *                  connect with no audio or video. basicSsl() issues a
   *                  self-signed certificate; each device accepts it once.
   *
   * Plain `npm run dev` is unchanged: http://localhost:5173, this machine only.
   * That matters because Google sign-in is registered for that exact origin.
   */
  const lan = mode === 'lan'

  return {
    plugins: [react(), tailwindcss(), ...(lan ? [basicSsl()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: lan ? true : undefined,
      proxy: {
        // REST API. Same-origin from the browser's point of view, so there is
        // no CORS preflight and no mixed-content block when the page is https.
        '/api': { target: BACKEND_URL, changeOrigin: true },
        // Socket.IO signalling for the legacy peer-to-peer fallback.
        '/socket.io': { target: BACKEND_URL, changeOrigin: true, ws: true },
      },
    },
  }
})
