import { useEffect, useState } from 'preact/hooks'
import { onAuthRequired, restoreSession, signIn } from '../auth'

type AuthStatus = 'checking' | 'signedIn' | 'needed'

// Temporary sign-in control for T0.4; replaced by the real shell in T1.1.
export function App() {
  const [status, setStatus] = useState<AuthStatus>('checking')

  useEffect(() => {
    const off = onAuthRequired(() => setStatus('needed'))
    restoreSession().then((ok) => setStatus(ok ? 'signedIn' : 'needed'))
    return off
  }, [])

  const login = () =>
    signIn()
      .then(() => setStatus('signedIn'))
      .catch(() => setStatus('needed'))

  return (
    <main>
      <h1>Nhật ký</h1>
      {status === 'checking' && <p>Đang kiểm tra đăng nhập…</p>}
      {status === 'signedIn' && <p>Đã đăng nhập</p>}
      {status === 'needed' && (
        <button type="button" onClick={login} style={{ minHeight: 44 }}>
          Đăng nhập
        </button>
      )}
    </main>
  )
}
