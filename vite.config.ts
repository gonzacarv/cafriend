import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Dos destinos:
 *
 *   web        GitHub Pages, en usuario.github.io/cafriend/ → base '/cafriend/'
 *              con service worker para que funcione offline.
 *   capacitor  Dentro del APK, servido desde la raíz del WebView → base '/'.
 *              Sin service worker: los archivos ya están en el dispositivo, y
 *              un SW cacheando un origen local solo agrega formas de romperse.
 */
export default defineConfig(({ mode }) => {
  const forApk = mode === 'capacitor'

  // Sello de compilación visible en Ajustes: sin esto no hay forma de saber
  // desde el teléfono qué build está instalado.
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')

  return {
    base: forApk ? '/' : '/cafriend/',
    define: {
      __BUILD__: JSON.stringify(`${stamp}${forApk ? ' · apk' : ' · web'}`),
    },
    plugins: [
      react(),
      ...(forApk
        ? []
        : [
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
          ]),
    ],
    test: {
      // Los tests de lógica pura corren en node; los de UI declaran jsdom
      // con un comentario `@vitest-environment jsdom` en su cabecera.
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      globals: true,
    },
  }
})
