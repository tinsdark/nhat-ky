import { describe, expect, it } from 'vitest'
import { fitSize, readExifDateTime } from './photo'

describe('fitSize', () => {
  it('scales the long edge down, keeping aspect', () => {
    expect(fitSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
    expect(fitSize(3000, 4000, 320)).toEqual({ width: 240, height: 320 })
  })
  it('never upscales', () => {
    expect(fitSize(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
})

/** Smallest JPEG with an EXIF APP1 holding `date` as the given tag (big-endian TIFF). */
function jpegWithExif(date: string, where: 'exif' | 'ifd0' = 'exif', tag = 0x9003): ArrayBuffer {
  const text = [...date, '\0'].map((c) => c.charCodeAt(0))
  // TIFF: header(8) + IFD0 + [Exif IFD] + string
  const ifd0Entries = where === 'exif' ? 1 : 1
  const ifd0Size = 2 + ifd0Entries * 12 + 4
  const exifIfdSize = where === 'exif' ? 2 + 12 + 4 : 0
  const strOffset = 8 + ifd0Size + exifIfdSize
  const tiff = new DataView(new ArrayBuffer(strOffset + text.length))
  tiff.setUint16(0, 0x4d4d)
  tiff.setUint16(2, 42)
  tiff.setUint32(4, 8)
  tiff.setUint16(8, ifd0Entries)
  const e0 = 10
  if (where === 'exif') {
    tiff.setUint16(e0, 0x8769)
    tiff.setUint16(e0 + 2, 4)
    tiff.setUint32(e0 + 4, 1)
    tiff.setUint32(e0 + 8, 8 + ifd0Size)
    const exif = 8 + ifd0Size
    tiff.setUint16(exif, 1)
    tiff.setUint16(exif + 2, tag)
    tiff.setUint16(exif + 4, 2)
    tiff.setUint32(exif + 6, 20)
    tiff.setUint32(exif + 10, strOffset)
  } else {
    tiff.setUint16(e0, 0x0132)
    tiff.setUint16(e0 + 2, 2)
    tiff.setUint32(e0 + 4, 20)
    tiff.setUint32(e0 + 8, strOffset)
  }
  text.forEach((b, i) => tiff.setUint8(strOffset + i, b))
  const body = new Uint8Array(tiff.buffer)
  const out = new Uint8Array(2 + 2 + 2 + 6 + body.length + 2)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, 0xffd8)
  dv.setUint16(2, 0xffe1)
  dv.setUint16(4, 2 + 6 + body.length)
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6)
  out.set(body, 12)
  dv.setUint16(12 + body.length, 0xffd9)
  return out.buffer
}

describe('readExifDateTime', () => {
  it('reads DateTimeOriginal as +07:00 ISO', () => {
    expect(readExifDateTime(jpegWithExif('2026:10:21 12:34:56'))).toBe(
      '2026-10-21T12:34:56.000+07:00',
    )
  })
  it('falls back to DateTime in IFD0', () => {
    expect(readExifDateTime(jpegWithExif('2026:10:21 07:05:09', 'ifd0'))).toBe(
      '2026-10-21T07:05:09.000+07:00',
    )
  })
  it('returns null for non-JPEG, EXIF without date, or garbage', () => {
    expect(readExifDateTime(new ArrayBuffer(0))).toBeNull()
    expect(readExifDateTime(new Uint8Array([1, 2, 3, 4, 5]).buffer)).toBeNull()
    expect(readExifDateTime(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull()
    expect(readExifDateTime(jpegWithExif('not a date at all!!!'))).toBeNull()
  })
})
