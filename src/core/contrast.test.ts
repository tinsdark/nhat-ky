import { describe, expect, it } from 'vitest'
import { contrastRatio, mostReadable, parseColor } from './contrast'

describe('parseColor', () => {
  it('reads hex, rgb and color(srgb)', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('#1f1612')).toEqual([31, 22, 18, 1])
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1])
    expect(parseColor('rgb(10 20 30 / 0.5)')).toEqual([10, 20, 30, 0.5])
    expect(parseColor('color(srgb 1 0 0)')).toEqual([255, 0, 0, 1])
    expect(parseColor('nonsense')).toBeNull()
  })
})

describe('contrast', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21)
  })
  it('picks the readable text colour', () => {
    expect(mostReadable([250, 240, 230, 1], ['#ffffff', '#1f1612'])).toBe('#1f1612')
    expect(mostReadable([40, 30, 90, 1], ['#ffffff', '#1f1612'])).toBe('#ffffff')
  })
})
