import { describe, expect, it } from 'vitest'
import { appendError, errorMessage, formatErrorLog } from './errorLog'

const line = (n: number) => ({ at: `t${n}`, where: 'w', message: `m${n}` })

describe('appendError', () => {
  it('puts the newest first and caps the length', () => {
    let log = [line(1)]
    log = appendError(log, line(2), 2)
    log = appendError(log, line(3), 2)
    expect(log.map((l) => l.message)).toEqual(['m3', 'm2'])
  })
})

describe('errorMessage', () => {
  it('keeps the error name', () => {
    expect(errorMessage(new TypeError('x'))).toBe('TypeError: x')
    expect(errorMessage('plain')).toBe('plain')
  })
})

describe('formatErrorLog', () => {
  it('one line per error', () => {
    expect(formatErrorLog([line(1), line(2)])).toBe('t1 [w] m1\nt2 [w] m2')
  })
})
