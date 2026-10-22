import { describe, expect, it } from 'vitest'
import { classifyAxis, swipeIntent, swipeThreshold } from './swipe'

describe('swipeThreshold', () => {
  it('is 30% of the row, at most 110px', () => {
    expect(swipeThreshold(300)).toBe(90)
    expect(swipeThreshold(390)).toBe(110)
    expect(swipeThreshold(700)).toBe(110)
  })
})

describe('classifyAxis', () => {
  it('waits until the finger has moved more than 10px', () => {
    expect(classifyAxis(6, 3)).toBe('undecided')
    expect(classifyAxis(-10, 0)).toBe('undecided')
  })
  it('is a horizontal swipe only when clearly more sideways than down (1.5x)', () => {
    expect(classifyAxis(30, 10)).toBe('horizontal')
    expect(classifyAxis(-30, 10)).toBe('horizontal')
    expect(classifyAxis(30, 25)).toBe('vertical')
    expect(classifyAxis(12, 10)).toBe('vertical')
  })
  it('a mostly vertical move is a scroll', () => {
    expect(classifyAxis(3, 40)).toBe('vertical')
  })
})

describe('swipeIntent', () => {
  it('left deletes, right edits, like the iPhone', () => {
    expect(swipeIntent(-120, 390).intent).toBe('delete')
    expect(swipeIntent(120, 390).intent).toBe('edit')
  })
  it('does nothing before the threshold, and reports how far along it is', () => {
    const s = swipeIntent(-55, 390)
    expect(s.intent).toBe('none')
    expect(s.passed).toBe(false)
    expect(s.progress).toBeCloseTo(0.5)
  })
  it('passed from the threshold on; progress stops at 1', () => {
    const s = swipeIntent(-110, 390)
    expect(s).toMatchObject({ intent: 'delete', passed: true, progress: 1 })
    expect(swipeIntent(300, 390).progress).toBe(1)
  })
  it('no movement is no intent', () => {
    expect(swipeIntent(0, 390)).toMatchObject({ intent: 'none', passed: false, progress: 0 })
  })
})
