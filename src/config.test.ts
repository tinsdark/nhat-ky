import { describe, expect, it } from 'vitest'
import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from './config'

describe('config', () => {
  it('only requests the appdata scope', () => {
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.appdata')
  })

  it('has a Google client id', () => {
    expect(GOOGLE_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
  })
})
