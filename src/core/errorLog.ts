// Errors kept on this device so they can be read back on a phone, where there is no console.

export interface ErrorLogLine {
  at: string
  where: string
  message: string
}

export const ERROR_LOG_MAX = 50

/** Newest first, at most `max` lines. */
export function appendError(log: ErrorLogLine[], line: ErrorLogLine, max = ERROR_LOG_MAX) {
  return [line, ...log].slice(0, max)
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

/** Plain text for "Chép nhật ký lỗi". */
export function formatErrorLog(log: ErrorLogLine[]): string {
  return log.map((l) => `${l.at} [${l.where}] ${l.message}`).join('\n')
}
