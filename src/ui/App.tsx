import { useEffect, useState } from 'preact/hooks'
import { hasSession } from '../auth'
import { appLock, shouldRelock } from '../lock'
import { LockScreen } from './LockScreen'
import { getSettings } from '../data/repository'
import { DATA_ERROR_EVENT, useLive } from './useLive'
import { Login } from './screens/Login'
import { Backfill } from './screens/Backfill'
import { Habits } from './screens/Habits'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { Icon } from './Icon'
import { SyncIndicator } from './SyncIndicator'
import { applyUpdate, checkForUpdate, getUpdateState, subscribeUpdate } from '../pwa'
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
  const [dataError, setDataError] = useState(false)
  useEffect(() => {
    const on = () => setDataError(true)
    window.addEventListener(DATA_ERROR_EVENT, on)
    return () => window.removeEventListener(DATA_ERROR_EVENT, on)
  }, [])
  const [update, setUpdate] = useState(getUpdateState())
  useEffect(() => subscribeUpdate(setUpdate), [])
  // A home-screen app can stay open for days: look for a new version whenever it comes back to the front.
  useEffect(() => {
    let last = 0
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30 * 60_000) return
      last = Date.now()
      void checkForUpdate()
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
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
        <div class="brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="34" height="34" />
          <div>
            <strong>Nhật ký</strong>
            <SyncIndicator onLogin={() => setGate(true)} />
          </div>
        </div>
        {update === 'available' && (
          <button type="button" class="update-chip" onClick={() => applyUpdate()}>
            Có bản mới, cập nhật
          </button>
        )}
      </header>
      {dataError && (
        <div class="notice-line" role="alert">
          Không đọc được dữ liệu trên máy. Thử{' '}
          <button type="button" class="linkbtn" onClick={() => location.reload()}>
            tải lại app
          </button>
          ; nếu vẫn lỗi, dữ liệu trên Drive không bị ảnh hưởng.
        </div>
      )}
      <main class="content">
        {tab === 'today' && <Today />}
        {tab === 'backfill' && <Backfill />}
        {tab === 'habits' && <Habits />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && (
          <Settings
            onLogin={() => setGate(true)}
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
            <Icon name={t.icon} />
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
