// Every bottom sheet (.sheet inside .sheet-backdrop) behaves as a modal dialog: announced as one, closed
// with Esc, and Tab stays inside it. Done once here by watching the DOM, so each sheet keeps its own markup.

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const topBackdrop = (): HTMLElement | null => {
  const all = document.querySelectorAll<HTMLElement>('.sheet-backdrop')
  return all.length ? all[all.length - 1]! : null
}

function enhance(sheet: HTMLElement) {
  if (sheet.dataset.dialog) return
  sheet.dataset.dialog = '1'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-modal', 'true')
  const title = sheet.querySelector('h1,h2,h3')?.textContent?.trim()
  if (title && !sheet.hasAttribute('aria-label')) sheet.setAttribute('aria-label', title)
  // Focus the sheet itself, not a field: a field would pop the on-screen keyboard open.
  sheet.tabIndex = -1
  sheet.focus({ preventScroll: true })
}

export function installDialogs(): void {
  const scan = (root: ParentNode) =>
    root.querySelectorAll<HTMLElement>('.sheet-backdrop > .sheet').forEach(enhance)
  new MutationObserver((records) => {
    for (const r of records)
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) scan(n.matches('.sheet-backdrop') ? n.parentElement! : n)
      })
  }).observe(document.body, { childList: true, subtree: true })

  document.addEventListener('keydown', (e) => {
    const backdrop = topBackdrop()
    if (!backdrop) return
    if (e.key === 'Escape') {
      e.preventDefault()
      backdrop.click() // runs the same onClose a tap outside the sheet runs
      return
    }
    if (e.key !== 'Tab') return
    const sheet = backdrop.querySelector<HTMLElement>('.sheet')
    const items = sheet ? [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
    if (!sheet || items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === sheet)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  })
}
