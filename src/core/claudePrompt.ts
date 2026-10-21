import { addDays } from './date'
import { countLoggedDays } from './rules'
import type { Metric, MetricContext } from './metrics'
import { formatMetric, windowMean } from './stats'
import type { Insight } from './types'

/** Metrics sent to Claude: aggregates only. */
const PROMPT_METRIC_IDS = [
  'sleep_hours',
  'bedtime',
  'wake_time',
  'sleep_quality',
  'bedtime_sd7',
  'sleep_midpoint',
  'social_jetlag',
  'last_coffee_to_bed',
  'coffee_count',
  'dinner_time',
  'skipped_breakfast',
  'late_eating',
  'water_ml',
  'work_hours',
  'deep_work_hours',
  'overtime_hours',
  'exercise_min',
  'habit_rate',
  'mood',
  'energy',
  'stress',
  'focus',
  'day_score',
]

export const QUESTIONS = {
  week: 'Nhận xét tuần vừa rồi của tao: điểm tốt, điểm đáng lo, và 2–3 việc cụ thể nên thử tuần tới.',
  tired:
    'Vì sao tuần này tao hay mệt? Dựa vào số liệu, các nguyên nhân có khả năng nhất là gì và nên chỉnh gì trước?',
  sleep:
    'Giấc ngủ của tao đang có vấn đề gì không? Đồng hồ sinh hoạt (giờ ngủ, độ đều, lệch cuối tuần) nói gì?',
} as const

/**
 * A prompt built only from aggregated numbers (7-day, previous 7-day and 30-day means) and the advice
 * texts the app already produced. Free-text notes, titles, highlights, habit names and photos never go in.
 */
export function buildClaudePrompt(input: {
  ctx: MetricContext
  metrics: Metric[]
  today: string
  insights: Insight[]
  question: string
}): string {
  const { ctx, metrics, today, insights, question } = input
  const byId = new Map(metrics.map((m) => [m.id, m]))
  const rows = PROMPT_METRIC_IDS.map((id) => byId.get(id))
    .filter((m): m is Metric => !!m)
    .map((m) => {
      const cell = (v: number | null) => formatMetric(m.id, m.unit, v)
      return `| ${m.label} | ${cell(windowMean(m, ctx, today, 7))} | ${cell(windowMean(m, ctx, addDays(today, -7), 7))} | ${cell(windowMean(m, ctx, today, 30))} |`
    })
  const advice = insights.length ? insights.map((i) => `- ${i.text}`).join('\n') : '(chưa có)'
  return [
    'Mày là người phân tích thói quen sinh hoạt giúp tao. Dưới đây là số liệu tổng hợp từ app theo dõi cá nhân của tao (giờ Việt Nam, ngày tính từ 04:00 sáng). Ô "–" nghĩa là không có dữ liệu, không phải 0.',
    'Chỉ dựa vào số liệu này, không chẩn đoán bệnh; nếu số liệu chưa đủ kết luận thì nói thẳng là chưa đủ.',
    '',
    `Số ngày có ghi chép: ${countLoggedDays(ctx, today, 365)}. Ngày hôm nay: ${today}.`,
    '',
    '| Chỉ số | 7 ngày gần nhất | 7 ngày trước đó | TB 30 ngày |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Các nhận xét app đã tìm ra:',
    advice,
    '',
    `Câu hỏi: ${question}`,
  ].join('\n')
}
