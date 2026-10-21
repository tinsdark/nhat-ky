/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/nhat-ky/',
  plugins: [preact(), VitePWA({ registerType: 'autoUpdate' })],
  test: { include: ['src/**/*.test.ts'] },
})
