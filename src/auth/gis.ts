// Thin wrapper over Google Identity Services (token client). All policy lives in token.ts.
import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../config'
import { AuthNetworkError, AuthRequiredError, type TokenRequester } from './token'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface GisTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GisApi {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string
        scope: string
        callback: (res: GisTokenResponse) => void
        error_callback: (err: { type?: string }) => void
      }): GisTokenClient
      revoke(token: string, done: () => void): void
    }
  }
}

declare global {
  interface Window {
    google?: GisApi
  }
}

let loading: Promise<GisApi> | null = null

function loadGis(): Promise<GisApi> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  loading ??= new Promise<GisApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve(window.google!)
    script.onerror = () => {
      script.remove()
      loading = null // allow retry once back online
      reject(new AuthNetworkError('cannot load Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function createGisRequester(): TokenRequester {
  let client: GisTokenClient | null = null
  let settle: {
    resolve: (r: { accessToken: string; expiresInSec: number }) => void
    reject: (e: Error) => void
  } | null = null

  return async ({ prompt }) => {
    const gis = await loadGis()
    client ??= gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (res.access_token) {
          settle?.resolve({ accessToken: res.access_token, expiresInSec: res.expires_in ?? 3600 })
        } else {
          settle?.reject(new AuthRequiredError(res.error ?? 'no access token'))
        }
      },
      error_callback: (err) => settle?.reject(new AuthRequiredError(err.type ?? 'popup error')),
    })
    return new Promise((resolve, reject) => {
      settle = { resolve, reject }
      client!.requestAccessToken({ prompt })
    })
  }
}

export async function revokeToken(token: string): Promise<void> {
  const gis = await loadGis()
  await new Promise<void>((resolve) => gis.accounts.oauth2.revoke(token, resolve))
}
