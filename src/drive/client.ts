// Google Drive REST client for appDataFolder. Everything is addressed by file NAME so the write
// guard (nk_/nkp_/nkt_ prefixes only) covers every write and delete path.

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const WRITABLE_NAME = /^(nk_|nkp_|nkt_)[A-Za-z0-9._-]+$/

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
}

export interface DriveDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  getToken: () => Promise<string>
  invalidateToken: () => void
}

export type DriveClient = ReturnType<typeof createDriveClient>

export function assertWritableName(name: string): void {
  if (!WRITABLE_NAME.test(name)) throw new Error(`Refusing to write Drive file "${name}"`)
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function createDriveClient({ fetch, getToken, invalidateToken }: DriveDeps) {
  /** Authorized request; one retry with a fresh token on 401. */
  async function request(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = await getToken()
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 && !retried) {
      invalidateToken()
      return request(url, init, true)
    }
    if (!res.ok)
      throw new DriveError(res.status, `Drive ${init.method ?? 'GET'} failed: ${res.status}`)
    return res
  }

  async function list(q: string): Promise<DriveFile[]> {
    const files: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `trashed=false${q}`,
        pageSize: '1000',
        fields: 'nextPageToken,files(id,name,modifiedTime)',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const body = await (await request(`${API}/files?${params}`)).json()
      files.push(...(body.files ?? []))
      pageToken = body.nextPageToken
    } while (pageToken)
    return files
  }

  /** Newest file with this exact name, or null. Throws on lookup failure (never "not found"). */
  async function find(name: string): Promise<DriveFile | null> {
    const files = await list(` and name=${quote(name)}`)
    files.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
    return files[0] ?? null
  }

  async function put(name: string, body: string | Blob, contentType: string): Promise<string> {
    let file = await find(name)
    let created = false
    if (!file) {
      const res = await request(`${API}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: contentType, parents: ['appDataFolder'] }),
      })
      file = await res.json()
      created = true
    }
    try {
      const res = await request(
        `${UPLOAD}/files/${file!.id}?uploadType=media&fields=modifiedTime`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': contentType },
          body,
        },
      )
      return (await res.json()).modifiedTime
    } catch (err) {
      // An empty file would be the newest one and shadow the real data.
      if (created) await request(`${API}/files/${file!.id}`, { method: 'DELETE' }).catch(() => {})
      throw err
    }
  }

  return {
    /** Files whose name starts with `prefix`. Reading any prefix is allowed; writes are guarded. */
    async listFiles(prefix = 'nk_'): Promise<DriveFile[]> {
      return (await list('')).filter((f) => f.name.startsWith(prefix))
    },

    async readJson<T>(name: string): Promise<T | null> {
      const file = await find(name)
      if (!file) return null
      return (await request(`${API}/files/${file.id}?alt=media`)).json()
    },

    async getModifiedTime(name: string): Promise<string | null> {
      return (await find(name))?.modifiedTime ?? null
    },

    async downloadBlob(name: string): Promise<Blob | null> {
      const file = await find(name)
      if (!file) return null
      return (await request(`${API}/files/${file.id}?alt=media`)).blob()
    },

    /** Create or replace; returns the new modifiedTime. */
    async writeJson(name: string, data: unknown): Promise<string> {
      assertWritableName(name)
      return put(name, JSON.stringify(data), 'application/json')
    },

    async uploadBlob(name: string, blob: Blob): Promise<string> {
      assertWritableName(name)
      return put(name, blob, blob.type || 'application/octet-stream')
    },

    async deleteFile(name: string): Promise<void> {
      assertWritableName(name)
      const file = await find(name)
      if (file) await request(`${API}/files/${file.id}`, { method: 'DELETE' })
    },
  }
}
