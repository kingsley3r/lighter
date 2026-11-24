import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lighter – Weight Loss Tracker',
        short_name: 'Lighter',
        description: 'Track meals, workouts, water, sleep and weight.',
        theme_color: '#2f7d5b',
        background_color: '#f6f7f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3000000,
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // last known data so the app still opens and shows your day without signal
            urlPattern: ({ url, request }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'lighter-data', networkTimeoutSeconds: 6, matchOptions: { ignoreVary: true }, expiration: { maxEntries: 400, maxAgeSeconds: 14 * 86400 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
})
