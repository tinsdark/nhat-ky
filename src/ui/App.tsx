import { useEffect, useState } from 'preact/hooks'
import { hasSession } from '../auth'
import { appLock, shouldRelock } from '../lock'
import { LockScreen } from './LockScreen'
import { getSettings } from '../data/repository'
import { useLive } from './useLive'
import { Login } from './screens/Login'
import { Backfill } from './screens/Backfill'
import { Habits } from './screens/Habits'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { SyncIndicator } from './SyncIndicator'
import { parseHash, TABS } from './route'

const SKIP_KEY = 'nk_skipLogin'

function readSkip(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

function writeSkip(on: boolean): void {
  try {
    if (on) localStorage.setItem(SKIP_KEY, '1')
    else localStorage.removeItem(SKIP_KEY)
  } catch {
    // storage unavailable: the login screen just shows again next time
  }
}

export function App() {
  const [tab, setTab] = useState(() => parseHash(location.hash))
  const settings = useLive(getSettings, [])
  useEffect(() => {
    const theme = settings?.theme
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
  }, [settings?.theme])
  const [locked, setLocked] = useState(() => appLock.isEnabled())
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else {
        if (appLock.isEnabled() && shouldRelock(hiddenAt, Date.now())) setLocked(true)
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  const [gate, setGate] = useState(() => !hasSession() && !readSkip())
  useEffect(() => {
    const onHash = () => setTab(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (locked) return <LockScreen onUnlocked={() => setLocked(false)} />

  if (gate) {
    return (
      <Login
        onDone={() => {
          writeSkip(false)
          setGate(false)
        }}
        onSkip={() => {
          writeSkip(true)
          setGate(false)
        }}
      />
    )
  }

  return (
    <div class="shell">
      <header class="topbar">
        <strong>Nhật ký</strong>
        <SyncIndicator onLogin={() => setGate(true)} />
      </header>
      <main class="content">
        {tab === 'today' && <Today />}
        {tab === 'backfill' && <Backfill />}
        {tab === 'habits' && <Habits />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && (
          <Settings
            onSignedOut={() => {
              writeSkip(false)
              setGate(true)
            }}
          />
        )}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <a
            href={`#/${t.id}`}
            class={t.id === tab ? 'active' : ''}
            aria-current={t.id === tab ? 'page' : undefined}
          >
            <span class="ico" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
