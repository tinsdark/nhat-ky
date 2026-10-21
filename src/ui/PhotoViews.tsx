import { usePhotoUrl } from './usePhotoUrl'

export function Thumb({
  id,
  size = 40,
  onClick,
}: {
  id: string
  size?: number
  onClick?: () => void
}) {
  const url = usePhotoUrl(id, 'thumb')
  const style = { width: `${size}px`, height: `${size}px` }
  const img = url ? (
    <img src={url} alt="" style={style} class="thumb" />
  ) : (
    <span class="thumb ph" style={style} />
  )
  return onClick ? (
    <button type="button" class="thumb-btn" onClick={onClick} aria-label="Xem ảnh">
      {img}
    </button>
  ) : (
    img
  )
}

export function PhotoViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const url = usePhotoUrl(id, 'blob')
  return (
    <div class="viewer" onClick={onClose}>
      {url ? <img src={url} alt="" /> : <span class="muted">Đang tải ảnh…</span>}
    </div>
  )
}
