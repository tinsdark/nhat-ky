import { useEffect } from 'preact/hooks'

export interface ToastData {
  id: number
  text: string
  onEdit?: () => void
  onUndo?: () => void
}

export const TOAST_MS = 5000

export function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, TOAST_MS)
    return () => clearTimeout(t)
  }, [toast.id])
  return (
    <div class="toast" role="status">
      <span>{toast.text}</span>
      {toast.onEdit && (
        <button
          type="button"
          onClick={() => {
            toast.onEdit?.()
            onClose()
          }}
        >
          Sửa
        </button>
      )}
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.()
            onClose()
          }}
        >
          Hoàn tác
        </button>
      )}
    </div>
  )
}
