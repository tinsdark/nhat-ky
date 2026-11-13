/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#2f5d50'

/**
 * Content-Security-Policy for the built app (GitHub Pages cannot send headers, so it goes in a meta tag).
 * Build only: the dev server needs inline styles and a websocket of its own. The access token sits in
 * localStorage, so this is the main guard if anything ever injects script.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/",
  // Inline style attributes are set by the components; Google's sign-in popup brings its own sheet.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' blob: data:",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com/gsi/ https://fonts.googleapis.com https://fonts.gstatic.com",
  'frame-src https://accounts.google.com/gsi/',
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

const cspMeta: Plugin = {
  name: 'nhat-ky-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
}

export default defineConfig({
  base: '/nhat-ky/',
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    cspMeta,
    preact(),
    VitePWA({
      registerType: 'prompt',
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
        background_color: '#f7f0de',
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
