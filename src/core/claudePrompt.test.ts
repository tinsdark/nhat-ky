import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { buildClaudePrompt, QUESTIONS } from './claudePrompt'
import { allMetrics, createMetricContext } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import type { Day, Entry, Insight } from './types'

const e = (over: Partial<Entry>): Entry =>
  ({
    id: Math.random().toString(),
    type: 'sleep',
    dateKey: '2026-11-02',
    start: atTime('2026-11-02', '23:00'),
    end: atTime('2026-11-03', '06:30'),
    categoryId: '',
    title: '',
    value: null,
    unit: '',
    rating: null,
    tags: [],
    photoIds: [],
    payload: {},
    source: 'manual',
    note: '',
    deleted: false,
    ...over,
  }) as Entry

describe('buildClaudePrompt', () => {
  const entries = [
    e({ title: 'TIÊU-ĐỀ-RIÊNG', note: 'GHI-CHÚ-BÍ-MẬT', photoIds: ['photo-123'] }),
    e({
      type: 'meal',
      start: atTime('2026-11-02', '19:00'),
      end: null,
      title: 'Phở nhà bà Tư',
      note: 'ăn với CON-SỐ-LẠ',
    }),
  ]
  const days = [
    {
      dateKey: '2026-11-02',
      mood: 4,
      dayScore: 8,
      highlight: 'HIGHLIGHT-RIÊNG',
      note: 'NOTE-NGÀY',
      deleted: false,
    },
  ] as unknown as Day[]
  const ctx = createMetricContext({ entries, days, habits: [], settings: DEFAULT_SETTINGS })
  const insight = { text: 'Khi Giờ đi ngủ ≤ 23:00 (19 ngày), Năng lượng TB 4,4.' } as Insight
  const prompt = buildClaudePrompt({
    ctx,
    metrics: allMetrics([]),
    today: '2026-11-08',
    insights: [insight],
    question: QUESTIONS.week,
  })

  it('has the aggregate table with numbers and the question', () => {
    expect(prompt).toContain('| Chỉ số | 7 ngày gần nhất | 7 ngày trước đó | TB 30 ngày |')
    expect(prompt).toContain('| Thời lượng ngủ | 7,5 giờ | – | 7,5 giờ |')
    expect(prompt).toContain('| Giờ đi ngủ | 23:00 |')
    expect(prompt).toContain('Khi Giờ đi ngủ ≤ 23:00 (19 ngày)')
    expect(prompt).toContain(`Câu hỏi: ${QUESTIONS.week}`)
  })
  it('never includes free text, titles, highlights or photo ids', () => {
    for (const secret of [
      'TIÊU-ĐỀ-RIÊNG',
      'GHI-CHÚ-BÍ-MẬT',
      'photo-123',
      'Phở nhà bà Tư',
      'CON-SỐ-LẠ',
      'HIGHLIGHT-RIÊNG',
      'NOTE-NGÀY',
    ]) {
      expect(prompt).not.toContain(secret)
    }
  })
  it('says so when there is no advice yet', () => {
    expect(
      buildClaudePrompt({
        ctx,
        metrics: allMetrics([]),
        today: '2026-11-08',
        insights: [],
        question: 'q',
      }),
    ).toContain('(chưa có)')
  })
})
