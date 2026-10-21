import type { ComponentChildren } from 'preact'

/** One settings line: title (and a hint) on the left, the control on the right. */
export function SetRow({
  title,
  hint,
  children,
  stacked = false,
}: {
  title: string
  hint?: string
  children: ComponentChildren
  /** Put the control under the text (for wide controls such as pill groups). */
  stacked?: boolean
}) {
  return (
    <div class={stacked ? 'setrow stacked' : 'setrow'}>
      <div class="grow">
        <span class="title">{title}</span>
        {hint && <span class="sub">{hint}</span>}
      </div>
      <div class="ctl">{children}</div>
    </div>
  )
}

export function NumberInput({
  value,
  onSave,
  unit,
}: {
  value: number
  onSave: (v: number) => void
  unit?: string
}) {
  return (
    <span class="numin">
      <input
        key={value}
        inputMode="decimal"
        aria-label={unit}
        defaultValue={String(value).replace('.', ',')}
        onChange={(e) => {
          const v = Number(e.currentTarget.value.replace(',', '.'))
          if (e.currentTarget.value.trim() !== '' && Number.isFinite(v)) onSave(v)
        }}
      />
      {unit && <span class="muted">{unit}</span>}
    </span>
  )
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      class={on ? 'switch on' : 'switch'}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

/** A titled card of settings lines. */
export function Section({
  title,
  hint,
  tint,
  children,
}: {
  title: string
  hint?: string
  tint?: 'ok' | 'warn'
  children: ComponentChildren
}) {
  return (
    <section class={tint ? `panel tint-${tint}` : 'panel'}>
      <div class="panel-head">
        <h2>{title}</h2>
      </div>
      {hint && <p class="muted hint top">{hint}</p>}
      {children}
    </section>
  )
}
