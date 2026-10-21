import { FULL_EDGE, fitSize, MAX_FULL_BYTES, readExifDateTime, THUMB_EDGE } from '../core/photo'

export class PhotoError extends Error {}

export interface ProcessedPhoto {
  blob: Blob
  thumb: Blob
  /** ISO capture time from EXIF, null when the file has none (or is not a JPEG). */
  takenAt: string | null
}

const isHeic = (file: File) => /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)

async function encode(bitmap: ImageBitmap, edge: number, qualities: number[]): Promise<Blob> {
  const { width, height } = fitSize(bitmap.width, bitmap.height, edge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  let out: Blob | null = null
  for (const q of qualities) {
    out = await toBlob(canvas, 'image/webp', q)
    // Browsers that cannot encode WebP hand back PNG; JPEG is the smaller fallback.
    if (out && out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg', q)
    if (out && out.size <= MAX_FULL_BYTES) break
  }
  if (!out) throw new PhotoError('Không nén được ảnh.')
  return out
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Reads the capture time, then redraws the picture on a canvas: that drops every EXIF field
 * (GPS included) and gives a WebP ~0.7 with long edge 1280px plus a 320px thumbnail.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
  const takenAt = isJpeg ? readExifDateTime(await file.slice(0, 256 * 1024).arrayBuffer()) : null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new PhotoError(
      isHeic(file)
        ? 'Trình duyệt này không mở được ảnh HEIC. Đổi camera sang "Tương thích nhất" (JPEG) hoặc chọn ảnh khác.'
        : 'Không đọc được ảnh này.',
    )
  }
  try {
    const blob = await encode(bitmap, FULL_EDGE, [0.7, 0.6, 0.5, 0.4])
    const thumb = await encode(bitmap, THUMB_EDGE, [0.7])
    return { blob, thumb, takenAt }
  } finally {
    bitmap.close()
  }
}
