import { render } from 'preact'
import { seedDefaults } from './data/seed'
import { App } from './ui/App'
import { startBackup } from './backup'
import './pwa'
import { startPhotoQueue } from './photos'
import { startSync } from './sync'
import './ui/style.css'

// Pinch zoom is off on purpose (one user, phone only). iOS Safari ignores the viewport flags for
// accessibility, but not these gesture events and touch-action (see style.css).
for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(type, (e) => e.preventDefault())

void seedDefaults().finally(() => {
  render(<App />, document.getElementById('app')!)
  startSync()
  startPhotoQueue()
  startBackup()
})
if (import.meta.env.DEV) void import('./dev/console')
