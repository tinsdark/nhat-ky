import { useEffect, useState } from 'preact/hooks'
import { hasSession } from '../auth'
import { Login } from './screens/Login'
import { Placeholder } from './screens/Placeholder'
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
  const [gate, setGate] = useState(() => !hasSession() && !readSkip())
  useEffect(() => {
    const onHash = () => setTab(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
        {tab === 'habits' && <Placeholder title="Thói quen" note="Làm ở T1.8." />}
        {tab === 'stats' && <Placeholder title="Thống kê" note="Làm ở T2.2." />}
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
