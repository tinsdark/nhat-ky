import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_FULL_BYTES } from '../core/photo'
import { PhotoError, processPhoto } from './process'

// No canvas in Node: a fake canvas whose toBlob answers from a script, to test the encoding choices.
function fakeCanvas(answer: (type: string, q: number) => Blob | null) {
  const calls: [string, number][] = []
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => {
      calls.push([type, q])
      cb(answer(type, q))
    },
  }
  vi.stubGlobal('document', { createElement: () => canvas })
  vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close: () => {} }))
  return calls
}

const blobOf = (type: string, size: number) => new Blob([new Uint8Array(size)], { type })
const file = (name: string, type: string) => new File([new Uint8Array(10)], name, { type })

afterEach(() => vi.unstubAllGlobals())

describe('processPhoto', () => {
  it('lowers the quality until the full-size file fits', async () => {
    const calls = fakeCanvas((type, q) =>
      blobOf(type, q > 0.55 ? MAX_FULL_BYTES + 1 : MAX_FULL_BYTES - 1),
    )
    const out = await processPhoto(file('a.png', 'image/png'))
    expect(out.blob.size).toBeLessThanOrEqual(MAX_FULL_BYTES)
    expect(calls.slice(0, 3).map(([, q]) => q)).toEqual([0.7, 0.6, 0.5])
    expect(out.takenAt).toBeNull() // not a JPEG: no EXIF read
  })

  it('falls back to JPEG when the browser cannot encode WebP', async () => {
    fakeCanvas((type) => blobOf(type === 'image/webp' ? 'image/png' : type, 1000))
    const out = await processPhoto(file('a.png', 'image/png'))
    expect(out.blob.type).toBe('image/jpeg')
    expect(out.thumb.type).toBe('image/jpeg')
  })

  it('says what to do when HEIC cannot be opened', async () => {
    fakeCanvas(() => null)
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('decode')
    })
    await expect(processPhoto(file('IMG_1.HEIC', ''))).rejects.toThrow(/HEIC/)
    await expect(processPhoto(file('x.png', 'image/png'))).rejects.toBeInstanceOf(PhotoError)
  })
})
