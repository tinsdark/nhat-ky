import { describe, expect, it } from 'vitest'
import { buildZip, crc32 } from './zip'

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

/** Reads the archive back through the central directory, the way an unzip tool would. */
function readZip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  expect(v.getUint32(eocd, true)).toBe(0x06054b50)
  const count = v.getUint16(eocd + 10, true)
  let pos = v.getUint32(eocd + 16, true)
  const files: { name: string; data: Uint8Array; crc: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(pos, true)).toBe(0x02014b50)
    const crc = v.getUint32(pos + 16, true)
    const size = v.getUint32(pos + 24, true)
    const nameLen = v.getUint16(pos + 28, true)
    const extraLen = v.getUint16(pos + 30, true)
    const commentLen = v.getUint16(pos + 32, true)
    const local = v.getUint32(pos + 42, true)
    const name = new TextDecoder().decode(zip.subarray(pos + 46, pos + 46 + nameLen))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    const lnLen = v.getUint16(local + 26, true)
    const leLen = v.getUint16(local + 28, true)
    const start = local + 30 + lnLen + leLen
    files.push({ name, data: zip.subarray(start, start + size), crc })
    pos += 46 + nameLen + extraLen + commentLen
  }
  return files
}

describe('buildZip', () => {
  it('writes files that read back byte for byte, with correct CRCs and UTF-8 names', () => {
    const a = new TextEncoder().encode('{"hello":"Nhật ký"}')
    const b = new Uint8Array([0, 1, 2, 3, 250, 251, 252])
    const files = readZip(
      buildZip([
        { name: 'nhat-ky.json', data: a },
        { name: 'photos/ảnh-1.webp', data: b },
      ]),
    )
    expect(files.map((f) => f.name)).toEqual(['nhat-ky.json', 'photos/ảnh-1.webp'])
    expect([...files[0]!.data]).toEqual([...a])
    expect([...files[1]!.data]).toEqual([...b])
    expect(files[0]!.crc).toBe(crc32(a))
    expect(files[1]!.crc).toBe(crc32(b))
  })
  it('handles an empty archive', () => {
    expect(buildZip([]).length).toBe(22)
  })
})
