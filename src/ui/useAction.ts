import { useRef } from 'preact/hooks'
import { reportError } from './errors'

/**
 * Wraps a handler that writes data: a second tap while the first is still saving is ignored (a thumb
 * double-tap must not record twice), and a failure is reported instead of vanishing.
 */
export function useAction() {
  const busy = useRef(false)
  return <A extends unknown[]>(where: string, fn: (...args: A) => Promise<unknown>) =>
    (...args: A): void => {
      if (busy.current) return
      busy.current = true
      fn(...args)
        .catch((err) => reportError(where, err))
        .finally(() => {
          busy.current = false
        })
    }
}
