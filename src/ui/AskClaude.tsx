import { useState } from 'preact/hooks'
import { buildClaudePrompt, QUESTIONS } from '../core/claudePrompt'
import { dailyPicks } from '../core/insights'
import type { Metric, MetricContext } from '../core/metrics'
import { addClaudeNote, deleteClaudeNote, getInsightStore } from '../data/insights'
import { useLive } from './useLive'

const CLAUDE_URL = 'https://claude.ai/new'

export function AskClaude({
  ctx,
  metrics,
  today,
}: {
  ctx: MetricContext
  metrics: Metric[]
  today: string
}) {
  const store = useLive(getInsightStore, [])
  const [preset, setPreset] = useState<keyof typeof QUESTIONS | 'custom'>('week')
  const [custom, setCustom] = useState('')
  const [shown, setShown] = useState('') // prompt text when the clipboard is not available
  const [msg, setMsg] = useState('')
  const [answer, setAnswer] = useState('')
  if (!store) return null

  const question = preset === 'custom' ? custom.trim() : QUESTIONS[preset]
  const prompt = () =>
    buildClaudePrompt({ ctx, metrics, today, insights: dailyPicks(store, today), question })

  const ask = async () => {
    if (!question) return setMsg('Nhập câu hỏi trước.')
    const text = prompt()
    try {
      await navigator.clipboard.writeText(text)
      setShown('')
      setMsg('Đã chép. Dán vào Claude rồi gửi.')
      window.open(CLAUDE_URL, '_blank', 'noopener')
    } catch {
      setShown(text)
      setMsg('Không chép tự động được. Chép đoạn bên dưới rồi mở Claude.')
    }
  }

  return (
    <>
      <h2 class="sub">Hỏi Claude</h2>
      <div class="form">
        <p class="muted hint">
          Chỉ gửi số liệu tổng hợp (trung bình 7 và 30 ngày) và các nhận xét ở trên. Không có ghi
          chú, tiêu đề, tên thói quen hay ảnh.
        </p>
        <select value={preset} onChange={(e) => setPreset(e.currentTarget.value as typeof preset)}>
          <option value="week">Nhận xét tuần</option>
          <option value="tired">Vì sao tuần này mệt?</option>
          <option value="sleep">Giấc ngủ có vấn đề không?</option>
          <option value="custom">Câu hỏi khác…</option>
        </select>
        {preset === 'custom' && (
          <textarea rows={2} value={custom} onInput={(e) => setCustom(e.currentTarget.value)} />
        )}
        <button type="button" class="btn btn-primary" onClick={() => void ask()}>
          Sao chép và mở Claude
        </button>
        {msg && <p class="muted">{msg}</p>}
        {shown && (
          <textarea readOnly rows={8} value={shown} onFocus={(e) => e.currentTarget.select()} />
        )}
        <textarea
          rows={3}
          placeholder="Dán câu trả lời của Claude vào đây để lưu lại"
          value={answer}
          onInput={(e) => setAnswer(e.currentTarget.value)}
        />
        <button
          type="button"
          class="btn"
          disabled={answer.trim() === ''}
          onClick={async () => {
            await addClaudeNote(question, answer.trim())
            setAnswer('')
          }}
        >
          Lưu nhận xét
        </button>
        {store.claudeNotes.slice(0, 5).map((n) => (
          <details class="card">
            <summary>
              {n.createdAt.slice(0, 10)} · {n.question.slice(0, 40)}
            </summary>
            <p class="note-text">{n.text}</p>
            <button type="button" class="btn" onClick={() => void deleteClaudeNote(n.id)}>
              Xoá
            </button>
          </details>
        ))}
      </div>
    </>
  )
}
