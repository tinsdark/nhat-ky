import { createGisRequester, revokeToken } from './gis'
import { createAuth } from './token'

export { AuthNetworkError, AuthRequiredError } from './token'

function localStore(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const auth = createAuth({
  request: createGisRequester(),
  revoke: revokeToken,
  storage: localStore(),
})

export const {
  getToken,
  signIn,
  signOut,
  invalidateToken,
  restoreSession,
  isSignedIn,
  onAuthRequired,
} = auth
