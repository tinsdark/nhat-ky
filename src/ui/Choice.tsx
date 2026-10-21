export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: unknown
  onChange: (v: T | undefined) => void
}) {
  return (
    <div class="field">
      <span class="lbl">{label}</span>
      <div class="choice">
        {options.map((o) => (
          <button
            type="button"
            class={value === o.id ? 'on' : ''}
            onClick={() => onChange(value === o.id ? undefined : o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const scale = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, label: String(i + 1) }))
