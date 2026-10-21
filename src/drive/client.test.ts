import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DriveError, createDriveClient } from './client'

interface FakeFile {
  id: string
  name: string
  parents: string[]
  mimeType: string
  content: string | Blob
  modifiedTime: string
  trashed: boolean
}

/** In-memory Drive speaking just enough of the v3 REST API. */
function fakeDrive(opts: { pageLimit?: number } = {}) {
  const files = new Map<string, FakeFile>()
  const calls: { method: string; url: string }[] = []
  let validToken = 'tok1'
  let clock = 0
  let nextId = 0
  let failPatch = false
  const stamp = () => new Date(Date.UTC(2026, 9, 21, 0, 0, ++clock)).toISOString()
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ method, url })
    const auth = (init.headers as Record<string, string>).Authorization
    if (auth !== `Bearer ${validToken}`) return new Response('', { status: 401 })
    const u = new URL(url)
    const idMatch = u.pathname.match(/\/files\/([^/]+)$/)

    if (method === 'GET' && u.pathname === '/drive/v3/files') {
      expect(u.searchParams.get('spaces')).toBe('appDataFolder')
      const q = u.searchParams.get('q') ?? ''
      const nameMatch = q.match(/name='((?:[^'\\]|\\.)*)'/)
      const name = nameMatch?.[1].replace(/\\(.)/g, '$1')
      const all = [...files.values()].filter(
        (f) =>
          !f.trashed &&
          f.parents.includes('appDataFolder') &&
          (name === undefined || f.name === name),
      )
      const size = opts.pageLimit ?? 1000
      const start = Number(u.searchParams.get('pageToken') ?? 0)
      const page = all.slice(start, start + size)
      return json({
        files: page.map(({ id, name, modifiedTime }) => ({ id, name, modifiedTime })),
        nextPageToken: start + size < all.length ? String(start + size) : undefined,
      })
    }
    if (method === 'POST' && u.pathname === '/drive/v3/files') {
      const meta = JSON.parse(init.body as string)
      const id = `id${++nextId}`
      files.set(id, { id, ...meta, content: '', modifiedTime: stamp(), trashed: false })
      return json({ id, name: meta.name, modifiedTime: files.get(id)!.modifiedTime })
    }
    if (method === 'PATCH' && idMatch && u.pathname.startsWith('/upload/')) {
      if (failPatch) return new Response('', { status: 500 })
      const f = files.get(idMatch[1])!
      f.content = init.body as string | Blob
      f.modifiedTime = stamp()
      return json({ modifiedTime: f.modifiedTime })
    }
    if (method === 'GET' && idMatch && u.searchParams.get('alt') === 'media') {
      return new Response(files.get(idMatch[1])!.content)
    }
    if (method === 'DELETE' && idMatch) {
      files.delete(idMatch[1])
      return new Response(null, { status: 204 })
    }
    return new Response('', { status: 404 })
  })

  return {
    files,
    calls,
    fetch,
    seed(name: string, content: string | Blob, parents = ['appDataFolder']) {
      const id = `id${++nextId}`
      files.set(id, {
        id,
        name,
        parents,
        mimeType: '',
        content,
        modifiedTime: stamp(),
        trashed: false,
      })
      return id
    },
    revokeToken(next: string) {
      validToken = next
    },
    failNextPatches(v: boolean) {
      failPatch = v
    },
  }
}

function setup(opts?: { pageLimit?: number }) {
  const drive = fakeDrive(opts)
  let token = 'tok1'
  const getToken = vi.fn(async () => token)
  const invalidateToken = vi.fn(() => {
    token = 'tok2'
  })
  const client = createDriveClient({ fetch: drive.fetch, getToken, invalidateToken })
  return { drive, client, getToken, invalidateToken }
}

describe('listFiles', () => {
  it('lists appDataFolder files by prefix (client-side)', async () => {
    const { drive, client } = setup()
    drive.seed('nk_2026-10.json', '{}')
    drive.seed('nkp_a.webp', '')
    drive.seed('other.json', '{}')
    drive.seed('nk_not-in-appdata.json', '{}', ['root'])
    expect((await client.listFiles()).map((f) => f.name)).toEqual(['nk_2026-10.json'])
    expect((await client.listFiles('nkp_')).map((f) => f.name)).toEqual(['nkp_a.webp'])
  })

  it('follows pagination', async () => {
    const { drive, client } = setup({ pageLimit: 2 })
    for (let i = 0; i < 5; i++) drive.seed(`nk_${i}.json`, '{}')
    expect(await client.listFiles()).toHaveLength(5)
    expect(drive.calls.filter((c) => c.method === 'GET')).toHaveLength(3)
  })
})

describe('readJson / getModifiedTime / downloadBlob', () => {
  it('returns parsed content, or null when the file does not exist', async () => {
    const { drive, client } = setup()
    drive.seed('nk_a.json', JSON.stringify({ x: 1 }))
    expect(await client.readJson('nk_a.json')).toEqual({ x: 1 })
    expect(await client.readJson('nk_missing.json')).toBeNull()
    expect(await client.getModifiedTime('nk_missing.json')).toBeNull()
    expect(await client.getModifiedTime('nk_a.json')).toMatch(/^2026-10-21T/)
  })

  it('reads any name, including names with quotes', async () => {
    const { drive, client } = setup()
    drive.seed("weird'name.json", '{"ok":true}')
    expect(await client.readJson("weird'name.json")).toEqual({ ok: true })
  })

  it('uses the newest file when names are duplicated', async () => {
    const { drive, client } = setup()
    drive.seed('nk_a.json', '{"v":"old"}')
    drive.seed('nk_a.json', '{"v":"new"}')
    expect(await client.readJson('nk_a.json')).toEqual({ v: 'new' })
  })

  it('downloads blobs', async () => {
    const { drive, client } = setup()
    drive.seed('nkt_a.webp', new Blob(['img']))
    expect(await (await client.downloadBlob('nkt_a.webp'))!.text()).toBe('img')
    expect(await client.downloadBlob('nkt_missing.webp')).toBeNull()
  })
})

describe('writeJson', () => {
  it('creates in appDataFolder then uploads content, returning modifiedTime', async () => {
    const { drive, client } = setup()
    const mt = await client.writeJson('nk_2026-10.json', { entries: [] })
    const [file] = [...drive.files.values()]
    expect(file.parents).toEqual(['appDataFolder'])
    expect(file.name).toBe('nk_2026-10.json')
    expect(file.content).toBe('{"entries":[]}')
    expect(mt).toBe(file.modifiedTime)
    const writes = drive.calls.filter((c) => c.method !== 'GET').map((c) => c.method)
    expect(writes).toEqual(['POST', 'PATCH'])
  })

  it('updates an existing file in place without creating another', async () => {
    const { drive, client } = setup()
    drive.seed('nk_a.json', '{"v":1}')
    await client.writeJson('nk_a.json', { v: 2 })
    expect(drive.files.size).toBe(1)
    expect(drive.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
    expect(await client.readJson('nk_a.json')).toEqual({ v: 2 })
  })

  it('deletes the empty file it just created when the upload fails', async () => {
    const { drive, client } = setup()
    drive.failNextPatches(true)
    await expect(client.writeJson('nk_a.json', {})).rejects.toBeInstanceOf(DriveError)
    expect(drive.files.size).toBe(0)
  })

  it('keeps an existing file when the upload fails', async () => {
    const { drive, client } = setup()
    drive.seed('nk_a.json', '{"v":1}')
    drive.failNextPatches(true)
    await expect(client.writeJson('nk_a.json', { v: 2 })).rejects.toBeInstanceOf(DriveError)
    expect(drive.files.size).toBe(1)
  })

  it('never creates a file when the lookup fails', async () => {
    const { drive, client } = setup()
    drive.fetch.mockImplementationOnce(async () => new Response('', { status: 500 }))
    await expect(client.writeJson('nk_a.json', {})).rejects.toBeInstanceOf(DriveError)
    expect(drive.files.size).toBe(0)
  })
})

describe('uploadBlob / deleteFile', () => {
  it('uploads a blob with its content type', async () => {
    const { drive, client } = setup()
    await client.uploadBlob('nkp_a.webp', new Blob(['img'], { type: 'image/webp' }))
    const [file] = [...drive.files.values()]
    expect(file.mimeType).toBe('image/webp')
    expect(await (file.content as Blob).text()).toBe('img')
  })

  it('deletes by name and ignores missing files', async () => {
    const { drive, client } = setup()
    drive.seed('nkp_a.webp', '')
    await client.deleteFile('nkp_a.webp')
    expect(drive.files.size).toBe(0)
    await expect(client.deleteFile('nkp_a.webp')).resolves.toBeUndefined()
  })
})

describe('401 handling', () => {
  it('retries once with a fresh token', async () => {
    const { drive, client, invalidateToken, getToken } = setup()
    drive.seed('nk_a.json', '{"v":1}')
    drive.revokeToken('tok2')
    expect(await client.readJson('nk_a.json')).toEqual({ v: 1 })
    expect(invalidateToken).toHaveBeenCalledTimes(1)
    expect(getToken).toHaveBeenCalledTimes(3) // list(401) + list(retry) + download
  })

  it('gives up after a second 401', async () => {
    const { drive, client, invalidateToken } = setup()
    drive.revokeToken('never')
    await expect(client.readJson('nk_a.json')).rejects.toMatchObject({
      name: 'DriveError',
      status: 401,
    })
    expect(invalidateToken).toHaveBeenCalledTimes(1)
  })

  it('surfaces other errors as DriveError with status', async () => {
    const { drive, client } = setup()
    drive.fetch.mockImplementationOnce(async () => new Response('', { status: 503 }))
    await expect(client.listFiles()).rejects.toMatchObject({ name: 'DriveError', status: 503 })
  })

  it('lets network errors through unchanged', async () => {
    const { drive, client } = setup()
    drive.fetch.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(client.listFiles()).rejects.toBeInstanceOf(TypeError)
  })
})

describe('write guard', () => {
  const bad = [
    'abc.json',
    'Sotien_x',
    '',
    'nk_',
    '../nk_x',
    "nk_a'b",
    'nk_a/b',
    'nkx_a.json',
    ' nk_a.json',
  ]
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
    ctx.drive.seed('abc.json', '{}')
  })

  it.each(bad)('rejects %j before any request', async (name) => {
    await expect(ctx.client.writeJson(name, {})).rejects.toThrow(/Refusing/)
    await expect(ctx.client.uploadBlob(name, new Blob(['x']))).rejects.toThrow(/Refusing/)
    await expect(ctx.client.deleteFile(name)).rejects.toThrow(/Refusing/)
    expect(ctx.drive.fetch).not.toHaveBeenCalled()
    expect(ctx.drive.files.size).toBe(1)
  })

  it('accepts the three prefixes', async () => {
    for (const name of ['nk_defs.json', 'nkp_1.webp', 'nkt_1.webp']) {
      await expect(ctx.client.writeJson(name, {})).resolves.toBeTypeOf('string')
    }
  })
})
