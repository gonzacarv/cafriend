import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: '/cafriend/' para GitHub Pages (usuario.github.io/cafriend/).
// Si algún día se sirve desde la raíz de un dominio propio, cambiar a '/'.
export default defineConfig({
  base: '/cafriend/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'CaFriend',
        short_name: 'CaFriend',
        description: 'Asistente de café: settings de molinillo y recetas V60',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12100e',
        theme_color: '#12100e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    // Los tests de lógica pura corren en node; los de UI declaran jsdom
    // con un comentario `@vitest-environment jsdom` en su cabecera.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
})
