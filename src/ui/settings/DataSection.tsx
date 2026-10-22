import { lazy, Suspense } from 'preact/compat'
import type { Settings } from '../../core/types'
import { saveSettings } from '../../data/repository'
import { BackupSection } from '../BackupSection'
import { Choice } from '../Choice'
import { PurgeSection } from '../PurgeSection'
import { Section, SetRow } from './fields'

const DevPanel = import.meta.env.DEV ? lazy(() => import('../DevPanel')) : null
const save = (patch: Partial<Settings>) => void saveSettings(patch)

/** Photos, backup, export and import (and, in dev only, the test data tools). */
export function DataSection({ settings }: { settings: Settings }) {
  return (
    <>
      <Section
        title="Ảnh"
        hint="Ảnh nén trên máy rồi tải lên Drive nền, không làm chậm đồng bộ dữ liệu."
      >
        <SetRow title="Tải ảnh lên Drive" stacked>
          <Choice
            label=""
            options={[
              { id: 'no', label: 'Mọi mạng' },
              { id: 'yes', label: 'Chỉ Wi-Fi' },
            ]}
            value={settings.photosWifiOnly ? 'yes' : 'no'}
            onChange={(v) => v && save({ photosWifiOnly: v === 'yes' })}
          />
        </SetRow>
        <SetRow title="Giữ ảnh lớn" hint="Sau 12 tháng chỉ giữ ảnh thu nhỏ để nhẹ Drive." stacked>
          <Choice
            label=""
            options={[
              { id: 'forever', label: 'Mãi mãi' },
              { id: '12', label: '12 tháng' },
            ]}
            value={settings.photoFullMonths === 12 ? '12' : 'forever'}
            onChange={(v) => v && save({ photoFullMonths: v === '12' ? 12 : 0 })}
          />
        </SetRow>
      </Section>
      <BackupSection dayStartHour={settings.dayStartHour} />
      <PurgeSection dayStartHour={settings.dayStartHour} />
      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </>
  )
}
