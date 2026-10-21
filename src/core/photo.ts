/** Largest dimensions that keep the aspect ratio with the long edge at most `max`; never upscales. */
export function fitSize(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= max) return { width, height }
  const k = max / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

export const MAX_PHOTOS_PER_ENTRY = 3
export const FULL_EDGE = 1280
export const THUMB_EDGE = 320
/** Target ceiling for the full-size file (SPEC: < 300 KB). */
export const MAX_FULL_BYTES = 300 * 1024
export const CACHE_LIMIT_BYTES = 200 * 1024 * 1024

export const fullName = (id: string) => `nkp_${id}.webp`
export const thumbName = (id: string) => `nkt_${id}.webp`

const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME = 0x0132
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004

/**
 * Capture time of a JPEG from its EXIF (DateTimeOriginal, then DateTimeDigitized, then DateTime), as an
 * ISO string with +07:00 — EXIF stores no zone, and the phone's clock is Vietnam time here.
 * Returns null for anything that is not a JPEG with a readable EXIF date. Reads nothing but the date.
 */
export function readExifDateTime(buffer: ArrayBuffer): string | null {
  const v = new DataView(buffer)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
  let pos = 2
  while (pos + 4 <= v.byteLength) {
    if (v.getUint8(pos) !== 0xff) return null
    const marker = v.getUint8(pos + 1)
    const size = v.getUint16(pos + 2)
    if (marker === 0xe1 && pos + 10 <= v.byteLength && v.getUint32(pos + 4) === 0x45786966) {
      return readTiff(v, pos + 10)
    }
    if (marker === 0xda) return null // start of scan: no more headers
    pos += 2 + size
  }
  return null
}

function readTiff(v: DataView, tiff: number): string | null {
  if (tiff + 8 > v.byteLength) return null
  const order = v.getUint16(tiff)
  const little = order === 0x4949
  if (!little && order !== 0x4d4d) return null
  const u16 = (o: number) => v.getUint16(o, little)
  const u32 = (o: number) => v.getUint32(o, little)

  /** Finds a tag in the IFD at `ifd` (offset from the TIFF header); returns the offset of its 4-byte value field. */
  const find = (
    ifd: number,
    tags: number[],
  ): { tag: number; field: number; count: number } | null => {
    const start = tiff + ifd
    if (start + 2 > v.byteLength) return null
    const n = u16(start)
    for (let i = 0; i < n; i++) {
      const entry = start + 2 + i * 12
      if (entry + 12 > v.byteLength) return null
      if (tags.includes(u16(entry)))
        return { tag: u16(entry), field: entry + 8, count: u32(entry + 4) }
    }
    return null
  }
  const text = (hit: { field: number; count: number }): string | null => {
    if (hit.count !== 20) return null
    const at = tiff + u32(hit.field)
    if (at + 19 > v.byteLength) return null
    let s = ''
    for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(at + i))
    return s
  }

  const ifd0 = u32(tiff + 4)
  const exifPtr = find(ifd0, [TAG_EXIF_IFD])
  const exifIfd = exifPtr ? u32(exifPtr.field) : null
  const hit =
    (exifIfd !== null && find(exifIfd, [TAG_DATETIME_ORIGINAL, TAG_DATETIME_DIGITIZED])) ||
    find(ifd0, [TAG_DATETIME])
  const raw = hit ? text(hit) : null
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000+07:00` : null
}
