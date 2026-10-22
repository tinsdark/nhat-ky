import { useState } from 'preact/hooks'
import { getSettings } from '../../data/repository'
import { Pills } from '../Pills'
import { Alerts } from '../settings/Alerts'
import { AppSection } from '../settings/AppSection'
import { Categories } from '../settings/Categories'
import { DataSection } from '../settings/DataSection'
import { Display } from '../settings/Display'
import { Goals } from '../settings/Goals'
import { useLive } from '../useLive'

type Section = 'categories' | 'goals' | 'alerts' | 'display' | 'data' | 'app'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'categories', label: 'Danh mục' },
  { id: 'goals', label: 'Mục tiêu' },
  { id: 'alerts', label: 'Cảnh báo' },
  { id: 'display', label: 'Hiển thị' },
  { id: 'data', label: 'Dữ liệu' },
  { id: 'app', label: 'Ứng dụng' },
]

const KEY = 'nk_settingsTab'
const readTab = (): Section => {
  try {
    const v = sessionStorage.getItem(KEY)
    return SECTIONS.some((s) => s.id === v) ? (v as Section) : 'categories'
  } catch {
    return 'categories'
  }
}

/** Settings split into six sections (as in Sổ Tiền) instead of one long page. */
export function Settings({
  onSignedOut,
  onLogin,
}: {
  onSignedOut: () => void
  onLogin: () => void
}) {
  const settings = useLive(getSettings, [])
  const [section, setSection] = useState<Section>(readTab)
  if (!settings) return null
  const pick = (s: Section) => {
    setSection(s)
    try {
      sessionStorage.setItem(KEY, s)
    } catch {
      // the section just is not remembered
    }
  }
  return (
    <section class="screen settings">
      <h1>Cài đặt</h1>
      <Pills options={SECTIONS} value={section} onChange={pick} />
      {section === 'categories' && <Categories />}
      {section === 'goals' && <Goals settings={settings} />}
      {section === 'alerts' && <Alerts settings={settings} />}
      {section === 'display' && <Display settings={settings} />}
      {section === 'data' && <DataSection settings={settings} />}
      {section === 'app' && <AppSection onSignedOut={onSignedOut} onLogin={onLogin} />}
    </section>
  )
}
