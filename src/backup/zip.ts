/** A minimal ZIP writer (store only, no compression: the photos are already WebP). */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipFile {
  name: string
  data: Uint8Array
}

/** DOS date/time for 2026-01-01 00:00 is enough: the archive is a copy, not a record of file times. */
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export function buildZip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff]
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]

  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    // bit 11 of the flags: the file name is UTF-8
    const common = [
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(DOS_TIME),
      ...u16(DOS_DATE),
      ...u32(crc),
      ...u32(f.data.length),
      ...u32(f.data.length),
      ...u16(name.length),
      ...u16(0),
    ]
    parts.push(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...common]), name, f.data)
    central.push(
      new Uint8Array([
        0x50,
        0x4b,
        0x01,
        0x02,
        ...u16(20),
        ...common,
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]),
      name,
    )
    offset += 30 + name.length + f.data.length
  }
  const centralSize = central.reduce((s, p) => s + p.length, 0)
  const end = new Uint8Array([
    0x50,
    0x4b,
    0x05,
    0x06,
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ])
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of all) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}
