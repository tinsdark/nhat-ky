import { render } from 'preact'
import { seedDefaults } from './data/seed'
import { App } from './ui/App'
import { startBackup } from './backup'
import { startPhotoQueue } from './photos'
import { startSync } from './sync'
import './ui/style.css'

void seedDefaults().finally(() => {
  render(<App />, document.getElementById('app')!)
  startSync()
  startPhotoQueue()
  startBackup()
})
if (import.meta.env.DEV) void import('./dev/console')
