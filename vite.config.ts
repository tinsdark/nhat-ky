/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#3b4a9e'

export default defineConfig({
  base: '/nhat-ky/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nhật ký',
        short_name: 'Nhật ký',
        description: 'Theo dõi đồng hồ sinh hoạt: ngủ, ăn, làm việc, thói quen.',
        lang: 'vi',
        start_url: '/nhat-ky/',
        scope: '/nhat-ky/',
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/nhat-ky/index.html',
        // Fonts come from Google Fonts: cache them at runtime so the app keeps its font offline.
        // Google sign-in and the Drive API are deliberately not cached.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
