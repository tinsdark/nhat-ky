/** Section tabs as pills (Sổ Tiền style): wraps onto a second row when they do not fit. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  className = '',
  label,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  /** Names the group for screen readers, e.g. "Mục cài đặt". */
  label: string
}) {
  return (
    <div class={`pills ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          aria-pressed={o.id === value}
          class={o.id === value ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
