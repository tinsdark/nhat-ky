import { getToken, invalidateToken } from '../auth'
import { createDriveClient } from './client'

export { DriveError } from './client'

export const {
  listFiles,
  readJson,
  getModifiedTime,
  downloadBlob,
  writeJson,
  uploadBlob,
  deleteFile,
} = createDriveClient({ fetch: (url, init) => fetch(url, init), getToken, invalidateToken })
