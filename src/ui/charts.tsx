import { weekday } from '../core/date'
import type { Point } from '../core/stats'

const W = 340
const H = 140
const PAD = 6

function scale(values: number[]): (v: number) => number {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return (v) => H - PAD - ((v - min) / span) * (H - 2 * PAD)
}

/** Raw days as dots, trailing average as a line. Each series is scaled to its own min–max. */
export function TrendChart({
  series,
}: {
  series: { raw: Point[]; avg: Point[]; color: string; label: string }[]
}) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Xu hướng 90 ngày">
      {series.map((s) => {
        const n = s.raw.length
        const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD)
        const present = s.raw.map((p) => p.value).filter((v): v is number => v !== null)
        if (present.length === 0) return null
        const y = scale(present)
        const line = s.avg
          .map((p, i) => (p.value === null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
          .filter(Boolean)
          .join(' ')
        return (
          <g>
            {s.raw.map((p, i) =>
              p.value === null ? null : (
                <circle cx={x(i)} cy={y(p.value)} r="1.6" fill={s.color} opacity="0.35" />
              ),
            )}
            <polyline
              points={line}
              fill="none"
              stroke={s.color}
              stroke-width="2"
              stroke-linejoin="round"
            />
          </g>
        )
      })}
    </svg>
  )
}

/** Seven bars, Monday first. */
export function WeekdayBars({ values }: { values: (number | null)[] }) {
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  const present = values.filter((v): v is number => v !== null)
  const max = present.length ? Math.max(...present, 0) : 1
  const min = Math.min(...present, 0)
  const span = max - min || 1
  return (
    <svg viewBox="0 0 280 120" class="chart" role="img" aria-label="Trung bình theo thứ trong tuần">
      {values.map((v, i) => {
        const h = v === null ? 0 : ((v - min) / span) * 80
        return (
          <g>
            <rect
              x={i * 40 + 8}
              y={90 - h}
              width="24"
              height={Math.max(h, v === null ? 0 : 2)}
              rx="3"
              fill="var(--accent)"
            />
            <text x={i * 40 + 20} y="108" text-anchor="middle" font-size="11" fill="var(--muted)">
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Month grid, Monday first; each day shaded by value within the month's min–max. */
export function MonthCalendar({ month, points }: { month: string; points: Point[] }) {
  const byKey = new Map(points.map((p) => [p.dateKey, p.value]))
  const inMonth = points
    .filter((p) => p.dateKey.startsWith(month) && p.value !== null)
    .map((p) => p.value as number)
  const min = Math.min(...inMonth)
  const max = Math.max(...inMonth)
  const span = max - min || 1
  const first = `${month}-01`
  const lead = weekday(first)
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate()
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  return (
    <div class="month">
      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((l) => (
        <span class="mh">{l}</span>
      ))}
      {cells.map((k) => {
        if (!k) return <span />
        const v = byKey.get(k) ?? null
        const t = v === null ? 0 : 0.2 + 0.8 * ((v - min) / span)
        return (
          <span
            class={v === null ? 'md empty' : 'md'}
            style={
              v === null
                ? undefined
                : {
                    background: `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, var(--bg))`,
                  }
            }
          >
            {Number(k.slice(8))}
          </span>
        )
      })}
    </div>
  )
}

const GROUP_COLORS = ['var(--accent)', 'var(--ok)', 'var(--warn)']

/** Ring split by value; `values` in the same order as `colors`. */
export function Donut({ values, colors = GROUP_COLORS }: { values: number[]; colors?: string[] }) {
  const total = values.reduce((a, b) => a + b, 0)
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Tỷ lệ giờ theo nhóm">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface)" stroke-width="16" />
      {total > 0 &&
        values.map((v, i) => {
          const len = (v / total) * C
          const el = (
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={colors[i]}
              stroke-width="16"
              stroke-dasharray={`${len} ${C - len}`}
              stroke-dashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          )
          offset += len
          return el
        })}
    </svg>
  )
}

/** One stacked column per day. */
export function StackedColumns({
  days,
  labels,
}: {
  days: { values: number[] }[]
  labels: string[]
}) {
  const max = Math.max(1, ...days.map((d) => d.values.reduce((a, b) => a + b, 0)))
  const step = 280 / days.length
  return (
    <svg viewBox="0 0 280 130" class="chart" role="img" aria-label="Giờ theo ngày và nhóm">
      {days.map((d, i) => {
        let y = 100
        return (
          <g>
            {d.values.map((v, k) => {
              const h = (v / max) * 90
              y -= h
              return h > 0 ? (
                <rect x={i * step + 6} y={y} width={step - 12} height={h} fill={GROUP_COLORS[k]} />
              ) : null
            })}
            <text
              x={i * step + step / 2}
              y="118"
              text-anchor="middle"
              font-size="11"
              fill="var(--muted)"
            >
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 7 weekday rows × 24 hour columns; darker = more. Hour labels every 6h. */
export function HourHeatmap({
  minutes,
  focus,
}: {
  minutes: number[][]
  focus?: (number | null)[][]
}) {
  const max = Math.max(1, ...minutes.flat())
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  return (
    <div class="hours" role="img" aria-label="Giờ deep work theo thứ và giờ">
      <span />
      {Array.from({ length: 24 }, (_, h) => (
        <span class="hl">{h % 6 === 0 ? h : ''}</span>
      ))}
      {minutes.map((row, wd) => (
        <>
          <span class="hl">{labels[wd]}</span>
          {row.map((m, h) => {
            const f = focus?.[wd]?.[h]
            return (
              <span
                class={m === 0 ? 'hc empty' : 'hc'}
                title={`${labels[wd]} ${h}h: ${Math.round(m)} phút${f ? `, tập trung ${f.toFixed(1)}` : ''}`}
                style={
                  m === 0
                    ? undefined
                    : {
                        background: `color-mix(in srgb, var(--accent) ${Math.round(20 + 80 * (m / max))}%, var(--bg))`,
                        outline: f && f >= 4 ? '1px solid var(--ok)' : undefined,
                      }
                }
              />
            )
          })}
        </>
      ))}
    </div>
  )
}

/** Night bars (bedtime → wake) on an 18:00–12:00 axis, quality as dots. `bars` in date order. */
export function SleepChart({
  bars,
  from,
  days,
}: {
  bars: { dateKey: string; startH: number; endH: number; quality: number | null }[]
  from: string
  days: number
}) {
  const W2 = 340
  const H2 = 170
  const top = 14
  const bottom = 24
  const span = 18 // 18:00 → 12:00 next day
  const y = (h: number) => top + (Math.min(h, span) / span) * (H2 - top - bottom)
  const step = W2 / days
  const dayIndex = (key: string) =>
    Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
  return (
    <svg viewBox={`0 0 ${W2} ${H2}`} class="chart" role="img" aria-label="Giờ ngủ 30 ngày">
      {[0, 6, 12, 18].map((h) => (
        <g>
          <line x1="0" x2={W2} y1={y(h)} y2={y(h)} stroke="var(--border)" stroke-width="0.5" />
          <text x="2" y={y(h) - 2} font-size="8" fill="var(--muted)">
            {String((18 + h) % 24).padStart(2, '0')}h
          </text>
        </g>
      ))}
      {bars.map((b) => {
        const x = dayIndex(b.dateKey) * step
        return (
          <g>
            <rect
              x={x + 1}
              y={y(b.startH)}
              width={Math.max(2, step - 2)}
              height={Math.max(2, y(b.endH) - y(b.startH))}
              rx="2"
              fill="var(--accent)"
              opacity="0.8"
            />
            {b.quality !== null && (
              <circle
                cx={x + step / 2}
                cy={H2 - 10}
                r="2"
                fill="var(--warn)"
                opacity={0.3 + b.quality * 0.14}
              />
            )}
          </g>
        )
      })}
      <text x="2" y={H2 - 1} font-size="8" fill="var(--muted)">
        chấm vàng = chất lượng ngủ (đậm = tốt)
      </text>
    </svg>
  )
}

/** Mean energy by hour; hours without check-ins are gaps. */
export function EnergyLine({ points }: { points: { hour: number; mean: number | null }[] }) {
  const W3 = 340
  const H3 = 120
  const x = (h: number) => 10 + (h / 23) * (W3 - 20)
  const y = (v: number) => 10 + ((5 - v) / 4) * (H3 - 30)
  const path = points
    .filter((p): p is { hour: number; mean: number } => p.mean !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.hour).toFixed(1)},${y(p.mean).toFixed(1)}`)
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${W3} ${H3}`}
      class="chart"
      role="img"
      aria-label="Đường năng lượng trong ngày"
    >
      {[1, 3, 5].map((v) => (
        <line x1="10" x2={W3 - 10} y1={y(v)} y2={y(v)} stroke="var(--border)" stroke-width="0.5" />
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text x={x(h)} y={H3 - 4} font-size="9" text-anchor="middle" fill="var(--muted)">
          {h}h
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
      {points.map((p) =>
        p.mean === null ? null : (
          <circle cx={x(p.hour)} cy={y(p.mean)} r="2.5" fill="var(--accent)" />
        ),
      )}
    </svg>
  )
}
