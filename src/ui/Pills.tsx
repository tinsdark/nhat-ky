/** Section tabs as pills (Sổ Tiền style): one row, scrolls sideways when it does not fit. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div class={`pills ${className}`} role="tablist">
      {options.map((o) => (
        <button
          type="button"
          role="tab"
          aria-selected={o.id === value}
          class={o.id === value ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
