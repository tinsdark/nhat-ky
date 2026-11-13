import { render } from 'preact'
import { seedDefaults } from './data/seed'
import { addExerciseShortcut, runMaintenance } from './data/maintenance'
import { logError } from './data/errorLog'
import { App } from './ui/App'
import { startBackup } from './backup'
import './pwa'
import { startPhotoQueue } from './photos'
import { engine, startSync } from './sync'
import { hasSession } from './auth'
import { installDialogs } from './ui/dialogs'
import { installErrorHandlers } from './ui/errors'
import { requestPersistentStorage } from './data/storage'
import './ui/style.css'

// Pinch zoom is off on purpose (one user, phone only). iOS Safari ignores the viewport flags for
// accessibility, but not these gesture events and touch-action (see style.css).
for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(type, (e) => e.preventDefault())

installErrorHandlers()
installDialogs()
void requestPersistentStorage()
void seedDefaults()
  .then(() => runMaintenance().catch((err) => logError('maintenance', err)))
  .finally(() => {
    render(<App />, document.getElementById('app')!)
    startSync()
    // Defs must be current before this edit (see addExerciseShortcut).
    const migrate = () => void addExerciseShortcut().catch((err) => logError('migrate', err))
    if (!hasSession()) migrate()
    else {
      const stop = engine.subscribe((s) => {
        if (s.state !== 'synced') return
        stop()
        migrate()
      })
    }
    startPhotoQueue()
    startBackup()
  })
if (import.meta.env.DEV) void import('./dev/console')
