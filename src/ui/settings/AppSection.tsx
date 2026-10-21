import { useEffect, useState } from 'preact/hooks'
import { signOut } from '../../auth'
import { appLock } from '../../lock'
import { applyUpdate, checkForUpdate, getUpdateState, subscribeUpdate } from '../../pwa'
import { engine } from '../../sync'
import { Choice } from '../Choice'
import { Icon } from '../Icon'
import { Section, SetRow } from './fields'

const build = new Date(__BUILD_TIME__)

/** Account and sync, the app lock, and which version is running. */
export function AppSection({ onSignedOut }: { onSignedOut: () => void }) {
  const [lockOn, setLockOn] = useState(() => appLock.isEnabled())
  const [lockMsg, setLockMsg] = useState('')
  const [update, setUpdate] = useState(getUpdateState())
  useEffect(() => subscribeUpdate(setUpdate), [])
  return (
    <>
      <Section title="Tài khoản và đồng bộ">
        <div class="btnlist">
          <button type="button" class="btn" onClick={() => void engine.run()}>
            <Icon name="refresh" size={16} /> Đồng bộ ngay
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={async () => {
              await signOut()
              engine.markAuthRequired()
              onSignedOut()
            }}
          >
            Đăng xuất
          </button>
        </div>
        <p class="muted hint">
          Đăng xuất chỉ xoá quyền truy cập Drive trên máy này, dữ liệu trên máy vẫn còn.
        </p>
      </Section>

      <Section
        title="Khoá app"
        hint='Khoá bằng Face ID, vân tay hoặc mã máy, chỉ trên máy này. Chỉ chặn người cầm máy mở app, không mã hoá dữ liệu. Không có máy chủ nên không có "quên mã": nếu mất quyền truy cập, xoá dữ liệu trang rồi đăng nhập lại để đồng bộ từ Drive.'
      >
        <SetRow title="Khoá khi mở app" hint="Tự khoá lại sau 2 phút không dùng.">
          <Choice
            label=""
            options={[
              { id: 'off', label: 'Tắt' },
              { id: 'on', label: 'Bật' },
            ]}
            value={lockOn ? 'on' : 'off'}
            onChange={async (v) => {
              if (v === 'on' && !lockOn) {
                const ok = await appLock.enable()
                setLockOn(ok)
                setLockMsg(ok ? 'Đã bật khoá.' : 'Không bật được: máy không hỗ trợ hoặc đã huỷ.')
              }
              if (v === 'off' && lockOn && (await appLock.unlock())) {
                appLock.disable()
                setLockOn(false)
                setLockMsg('Đã tắt khoá.')
              }
            }}
          />
        </SetRow>
        {lockMsg && <p class="muted hint">{lockMsg}</p>}
      </Section>

      <Section title="Về app">
        <SetRow title="Nhật ký" hint="Theo dõi đồng hồ sinh hoạt. Không theo dõi tiền.">
          <span class="muted">
            Bản dựng {build.toLocaleDateString('vi-VN')}{' '}
            {build.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </SetRow>
        <div class="btnlist">
          {update === 'available' ? (
            <button type="button" class="btn btn-primary" onClick={() => void applyUpdate()}>
              <Icon name="refresh" size={16} /> Cập nhật và tải lại
            </button>
          ) : (
            <button
              type="button"
              class="btn"
              disabled={update === 'checking'}
              onClick={() => void checkForUpdate()}
            >
              <Icon name="refresh" size={16} />{' '}
              {update === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra bản mới'}
            </button>
          )}
        </div>
        <p class="muted hint">
          {update === 'available'
            ? 'Có bản mới. Bấm để cập nhật, app sẽ tải lại (dữ liệu giữ nguyên).'
            : update === 'latest'
              ? 'Đang dùng bản mới nhất.'
              : update === 'unsupported'
                ? 'Chỉ kiểm tra được trên bản đã cài (không phải khi chạy dev).'
                : 'Bản mới sẽ không tự áp dụng, bấm nút khi muốn cập nhật.'}
        </p>
      </Section>
    </>
  )
}
