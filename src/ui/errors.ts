import { logError } from '../data/errorLog'

/** Fired with a Vietnamese message for the notice at the top of the screen. */
export const APP_ERROR_EVENT = 'nk-app-error'

/**
 * For failures the user must know about (a save that did not happen): logged, and shown at the top.
 * Background work (sync, photos, backup) calls logError directly and stays quiet.
 */
export function reportError(where: string, err: unknown, text = 'Không lưu được, thử lại.'): void {
  void logError(where, err)
  window.dispatchEvent(new CustomEvent(APP_ERROR_EVENT, { detail: text }))
}

/** Last resort: anything that escaped a handler still leaves a trace and a notice. */
export function installErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (e) =>
    reportError('unhandled', e.reason, 'Có lỗi xảy ra, thao tác vừa rồi có thể chưa lưu.'),
  )
  window.addEventListener('error', (e) =>
    reportError('error', e.error ?? e.message, 'Có lỗi xảy ra, thao tác vừa rồi có thể chưa lưu.'),
  )
}
