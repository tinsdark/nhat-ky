import { render } from 'preact'
import { App } from './ui/App'
import { startSync } from './sync'
import './ui/style.css'

render(<App />, document.getElementById('app')!)
startSync()
if (import.meta.env.DEV) void import('./dev/console')
