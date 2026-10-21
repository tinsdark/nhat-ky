// Dev-only: one month of an ordinary office worker, simulated from explicit behavioural hypotheses.
// Pure (no Dexie), deterministic per seed. The hypotheses are data (`HYPOTHESES`) so the report can quote
// them; the simulation below implements exactly those, nothing else is planted.
import { addDays, atTime, dateKeyRange, toIso, weekday } from '../core/date'
import type { Day, Entry } from '../core/types'
import { FAKE_DEVICE, rng, type FakeData } from './fakeData'

export interface Hypothesis {
  id: string
  area: 'Giấc ngủ' | 'Năng lượng' | 'Ăn uống' | 'Làm việc' | 'Vận động' | 'Tinh thần' | 'Lịch'
  claim: string
  /** Why a normal person behaves like this. */
  why: string
  /** How the generator applies it (the assumed effect size). */
  effect: string
}

/** Assumptions, not findings: the direction is common knowledge, every size below is a choice. */
export const HYPOTHESES: Hypothesis[] = [
  {
    id: 'H1',
    area: 'Giấc ngủ',
    claim: 'Cuối tuần ngủ muộn và dậy muộn hơn ngày đi làm (lệch múi giờ xã hội).',
    why: 'Ngày thường báo thức cắt giấc ngủ; cuối tuần cơ thể trả nợ ngủ và đi chơi tối.',
    effect:
      'Giờ ngủ T7/CN muộn thêm ~50 phút; dậy tự nhiên 07:45–09:00; ngày thường báo thức 06:30.',
  },
  {
    id: 'H2',
    area: 'Giấc ngủ',
    claim: 'Cà phê sau 15:00 làm giấc ngủ đêm đó tệ hơn.',
    why: 'Caffeine bán rã vài giờ, vẫn còn tác dụng lúc đi ngủ.',
    effect: 'Chất lượng ngủ −0,8 điểm; số lần thức giấc tăng.',
  },
  {
    id: 'H3',
    area: 'Giấc ngủ',
    claim: 'Dùng màn hình sát giờ ngủ làm ngủ kém đi và đi ngủ muộn hơn.',
    why: 'Ánh sáng và nội dung kích thích làm chậm buồn ngủ.',
    effect: 'Chất lượng ngủ −0,6 điểm; giờ ngủ muộn thêm ~20 phút.',
  },
  {
    id: 'H4',
    area: 'Giấc ngủ',
    claim: 'Ăn tối quá sát giờ ngủ làm ngủ kém.',
    why: 'Tiêu hoá còn hoạt động, khó vào giấc sâu.',
    effect: 'Ăn tối cách giờ ngủ dưới 2,5 giờ: chất lượng −0,5 điểm.',
  },
  {
    id: 'H5',
    area: 'Giấc ngủ',
    claim: 'Căng thẳng cao làm ngủ kém và trằn trọc.',
    why: 'Hưng phấn thần kinh kéo dài sau giờ làm.',
    effect: 'Ngày căng thẳng ≥ 4: chất lượng −0,7 điểm.',
  },
  {
    id: 'H6',
    area: 'Giấc ngủ',
    claim: 'Vận động ban ngày (xong trước 20:00) giúp ngủ sâu hơn.',
    why: 'Mệt thể chất lành mạnh và nhiệt độ cơ thể hạ dần.',
    effect: 'Chất lượng ngủ +0,4 điểm đêm đó.',
  },
  {
    id: 'H7',
    area: 'Năng lượng',
    claim: 'Ngủ đủ giờ và ngủ ngon thì hôm sau nhiều năng lượng hơn.',
    why: 'Nợ ngủ làm giảm tỉnh táo cả ngày.',
    effect:
      'Năng lượng nền +0,5 điểm cho mỗi giờ ngủ trên 6,8 giờ (kẹp ±1) và +0,25 cho mỗi điểm chất lượng trên 3,5.',
  },
  {
    id: 'H8',
    area: 'Năng lượng',
    claim:
      'Năng lượng có nhịp trong ngày: đỉnh khoảng 10:00, tụt sau bữa trưa 14:00–15:30, hồi lại buổi tối.',
    why: 'Nhịp sinh học cộng cơn buồn ngủ sau ăn.',
    effect: 'Cộng điều chỉnh theo giờ (+0,3 lúc 10:00, −0,6 lúc 14:30); bữa trưa nặng thêm −0,4.',
  },
  {
    id: 'H9',
    area: 'Năng lượng',
    claim: 'Cà phê sáng nâng tỉnh táo khoảng 3 giờ; uống thiếu nước làm mệt hơn.',
    why: 'Caffeine kích thích ngắn hạn; mất nước nhẹ cũng giảm tập trung.',
    effect: 'Cà phê trong 3 giờ trước: +0,3 năng lượng; uống dưới 1,25 lít/ngày: −0,3.',
  },
  {
    id: 'H10',
    area: 'Ăn uống',
    claim: 'Ngủ thiếu và dậy muộn thì hay bỏ bữa sáng.',
    why: 'Dậy vội, mất cảm giác đói buổi sáng.',
    effect: 'Xác suất bỏ sáng 30% nền, +20% khi đêm trước ngủ dưới 6,3 giờ.',
  },
  {
    id: 'H11',
    area: 'Ăn uống',
    claim: 'Căng thẳng làm ăn vặt nhiều hơn và uống cà phê chiều nhiều hơn.',
    why: 'Ăn và caffeine như cách tự xoa dịu.',
    effect:
      'Ăn vặt 55% nền, +20% khi căng thẳng ≥ 3,5; cà phê chiều 15% nền, +35% khi căng thẳng cao, +20% khi ngủ thiếu.',
  },
  {
    id: 'H12',
    area: 'Làm việc',
    claim: 'Tập trung buổi sáng tốt hơn buổi chiều; ngủ ngon hôm trước thì tập trung hơn.',
    why: 'Nhịp tỉnh táo và nợ ngủ.',
    effect:
      'Điểm tập trung nền 3,2 +0,35 mỗi điểm chất lượng ngủ trên 3,5 +0,3 mỗi giờ ngủ trên 7; buổi chiều −0,5.',
  },
  {
    id: 'H13',
    area: 'Làm việc',
    claim: 'Ngày họp nhiều thì bị cắt ngang nhiều và căng thẳng hơn.',
    why: 'Mỗi cuộc họp chia vụn thời gian tập trung.',
    effect: 'Căng thẳng +0,15 mỗi cuộc họp; số lần bị cắt ngang tăng khi có họp.',
  },
  {
    id: 'H14',
    area: 'Làm việc',
    claim:
      'Tuần nước rút (deadline) làm tăng giờ làm thêm, giảm vận động và uống nước, đi ngủ muộn.',
    why: 'Áp lực thời hạn đẩy việc cá nhân xuống sau.',
    effect:
      'Tuần 19–23/10: căng thẳng +1,1; OT 1,5–2,5 giờ; bỏ vận động; nước −2 ly; ăn tối ~20:45; ngủ muộn thêm ~25 phút.',
  },
  {
    id: 'H15',
    area: 'Vận động',
    claim: 'Vận động thường xuyên nhưng không đều: cuối tuần dễ tập hơn ngày đi làm.',
    why: 'Ngày đi làm hết sức vào buổi tối.',
    effect: 'Xác suất tập 22% ngày thường, 55% cuối tuần; 30–60 phút, vừa.',
  },
  {
    id: 'H16',
    area: 'Tinh thần',
    claim:
      'Tâm trạng tốt hơn khi vận động và khi gặp bạn bè; kém hơn khi lướt mạng nhiều, căng thẳng cao.',
    why: 'Tương tác xã hội, vận động tạo cảm giác tích cực; lướt mạng thường là cách trốn căng thẳng.',
    effect:
      'Tâm trạng nền 3,4 +0,3×(năng lượng−3) +0,4 vận động +0,5 gặp bạn −0,3 mỗi mức căng thẳng trên 2 −0,3 nếu lướt mạng trên 90 phút.',
  },
  {
    id: 'H17',
    area: 'Tinh thần',
    claim: 'Lướt mạng xã hội nhiều hơn khi căng thẳng và cuối tuần.',
    why: 'Giải trí thụ động là lối thoát dễ nhất.',
    effect: '25 phút nền +25 phút cho mỗi mức căng thẳng trên 2, +30 phút cuối tuần (10–150).',
  },
  {
    id: 'H18',
    area: 'Lịch',
    claim:
      'Ốm thì nghỉ việc, ngủ nhiều, năng lượng thấp, không vận động; đi xa thì nhịp ngày lệch hẳn.',
    why: 'Cơ thể ưu tiên hồi phục; môi trường lạ làm xáo trộn thói quen.',
    effect:
      'Ốm 8–9/10: không đi làm, ngủ thêm 1,5 giờ, năng lượng −1,2. Đi xa 17–18/10: ngủ muộn, đi bộ nhiều, không làm việc.',
  },
]

export interface Scenario {
  sick: string[]
  travel: string[]
  /** Deadline week: extra stress, overtime, late dinners, no exercise. */
  sprint: string[]
}

export const OCT_2026: Scenario = {
  sick: ['2026-10-08', '2026-10-09'],
  travel: ['2026-10-17', '2026-10-18'],
  sprint: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'],
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m) % 60)}`
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

export interface PersonaOptions {
  startKey: string
  days: number
  seed?: number
  scenario?: Scenario
  /** Simulated "now": nothing after it exists, and the last day has no rating yet. */
  nowIso?: string
}

const NO_EVENTS: Scenario = { sick: [], travel: [], sprint: [] }

export function generatePersonaMonth(opts: PersonaOptions): FakeData {
  const seed = opts.seed ?? 7
  const r = rng(seed)
  const gauss = () => (r.next() + r.next() + r.next() + r.next() - 2) * 1.2 // ≈ N(0, 0.8)
  const sc = opts.scenario ?? NO_EVENTS
  const keys = dateKeyRange(opts.startKey, addDays(opts.startKey, opts.days - 1))
  const stamp = atTime(keys[keys.length - 1]!, '23:00')
  const entries: Entry[] = []
  const dayRows: Day[] = []
  let n = 0

  const add = (
    dateKey: string,
    type: Entry['type'],
    startMin: number,
    durMin: number | null,
    over: Partial<Entry> = {},
  ) => {
    const start = atTime(dateKey, hhmm(startMin))
    entries.push({
      id: `persona-${seed}-${n++}`,
      type,
      dateKey,
      start,
      end: durMin === null ? null : toIso(Date.parse(start) + durMin * 60_000),
      categoryId: '',
      title: '',
      value: null,
      unit: '',
      rating: null,
      tags: [],
      photoIds: [],
      payload: {},
      source: 'manual',
      note: '',
      createdAt: stamp,
      updatedAt: stamp,
      deviceId: FAKE_DEVICE,
      deleted: false,
      dirty: 0,
      ...over,
    })
  }

  // The night before the first day is not stored, only remembered.
  let night = { hours: 7.2, quality: 3.6, bedMin: 23 * 60 + 40 }

  for (const d of keys) {
    const dow = weekday(d)
    const weekend = dow >= 5
    const sick = sc.sick.includes(d)
    const trip = sc.travel.includes(d)
    const sprint = sc.sprint.includes(d)
    const works = !weekend && !sick && !trip

    // ---------------------------------------------------------------- stress of the day (H13, H14)
    const meetingsToday = works
      ? (dow === 1 || dow === 3 ? 1 : dow === 2 ? 1 : 0) + (sprint ? 1 : 0)
      : 0
    const stress = clamp(
      (weekend ? 1.7 : 2.5) +
        (sprint ? 1.1 : 0) +
        meetingsToday * 0.15 +
        gauss() * 0.7 +
        (sick ? -0.3 : 0),
      1,
      5,
    )

    // ---------------------------------------------------------------- morning (H7, H10)
    // Clock minute at which last night's sleep ended.
    const wakeClock = (night.bedMin + Math.round(night.hours * 60)) % 1440
    const baseEnergy =
      3.0 +
      clamp((night.hours - 6.8) * 0.5, -1, 1) +
      (night.quality - 3.5) * 0.25 +
      (sick ? -1.2 : 0)

    const skipBreakfast = r.chance(0.3 + (night.hours < 6.3 ? 0.2 : 0))
    if (!skipBreakfast) {
      const t = clamp(wakeClock + r.int(20, 55), 6 * 60, 10 * 60)
      add(d, 'meal', t, null, {
        categoryId: 'cat-breakfast',
        title: 'Ăn sáng',
        payload: {
          mealSlot: 'breakfast',
          place: 'home',
          quality: r.pick([1, 2, 2, 3]),
          items: [r.pick(['Bánh mì trứng', 'Xôi', 'Phở', 'Yến mạch và chuối', 'Bún riêu'])],
        },
      })
    }
    let morningCoffeeAt: number | null = null
    if (r.chance(sick ? 0.3 : 0.85)) {
      morningCoffeeAt = clamp(wakeClock + r.int(45, 100), 6 * 60 + 30, 10 * 60 + 30)
      add(d, 'meal', morningCoffeeAt, null, {
        categoryId: 'cat-drink',
        title: 'Cà phê',
        payload: { drink: 'coffee' },
      })
    }
    if (!sick && r.chance(weekend ? 0.55 : 0.25)) {
      add(d, 'activity', clamp(wakeClock + r.int(30, 80), 6 * 60, 9 * 60), 15, {
        categoryId: 'cat-outdoor',
        title: 'Ra ngoài trời',
      })
    }

    // ---------------------------------------------------------------- work (H12, H13, H14)
    const focusBase = (late: boolean) =>
      3.2 + (night.quality - 3.5) * 0.35 + (night.hours - 7) * 0.3 - (late ? 0.5 : 0)
    const focusScores: number[] = []
    if (works) {
      const commuteIn = 8 * 60 + r.int(0, 20)
      add(d, 'activity', commuteIn, 25, { categoryId: 'cat-commute', title: 'Di chuyển' })
      const d1 = r.int(105, 150)
      const f1 = clamp(Math.round(focusBase(false) + gauss() * 0.7), 1, 5)
      focusScores.push(f1)
      add(d, 'work', 9 * 60 + r.int(5, 20), d1, {
        categoryId: 'cat-deep',
        title: 'Deep work',
        payload: {
          project: r.pick(['CyberApp Golden', 'CyberApp Golden', 'QLBX']),
          focus: f1,
          interruptions: clamp(r.int(0, 2) + meetingsToday, 0, 6),
          location: 'office',
        },
      })
      add(d, 'work', 11 * 60 + 50, 25, { categoryId: 'cat-chat', title: 'Email/chat' })
      // lunch (H8)
      const lunchAt = 12 * 60 + r.int(-5, 30)
      const heavy = r.chance(0.35)
      add(d, 'meal', lunchAt, null, {
        categoryId: 'cat-lunch',
        title: 'Ăn trưa',
        payload: {
          mealSlot: 'lunch',
          place: r.pick(['office', 'out', 'out', 'delivery']),
          quality: heavy ? 3 : r.pick([1, 2, 2]),
          portion: heavy ? 'full' : 'normal',
          items: [
            heavy
              ? r.pick(['Cơm sườn', 'Bún đậu'])
              : r.pick(['Cơm gà', 'Bún chả', 'Cơm văn phòng']),
          ],
        },
      })
      if (dow === 1 || dow === 3) {
        add(d, 'work', 14 * 60, 75, {
          categoryId: 'cat-meeting',
          title: 'Họp',
          payload: { location: 'office' },
        })
      } else if (dow === 2) {
        add(d, 'work', 15 * 60, 60, {
          categoryId: 'cat-meeting',
          title: 'Họp',
          payload: { location: 'office' },
        })
      }
      const f2 = clamp(Math.round(focusBase(true) + gauss() * 0.7 - (heavy ? 0.3 : 0)), 1, 5)
      focusScores.push(f2)
      add(d, 'work', 15 * 60 + 45, r.int(60, 100), {
        categoryId: dow === 4 ? 'cat-learnwork' : r.chance(0.35) ? 'cat-support' : 'cat-deep',
        title: dow === 4 ? 'Học trong việc' : 'Deep work',
        payload: {
          project: 'CyberApp Golden',
          focus: f2,
          interruptions: clamp(r.int(0, 3) + meetingsToday, 0, 6),
          location: 'office',
        },
      })
      add(d, 'activity', 17 * 60 + 50, 25, { categoryId: 'cat-commute', title: 'Di chuyển' })
      if (sprint) {
        const f3 = clamp(Math.round(focusBase(true) - 0.3 + gauss() * 0.7), 1, 5)
        focusScores.push(f3)
        add(d, 'work', 18 * 60 + 40, r.int(90, 150), {
          categoryId: 'cat-deep',
          title: 'Deep work',
          payload: { project: 'QLBX', focus: f3, interruptions: r.int(0, 2), location: 'home' },
        })
      }
    }

    // ---------------------------------------------------------------- food and drink (H8, H9, H11)
    if (!works) {
      add(d, 'meal', 12 * 60 + r.int(0, 80), null, {
        categoryId: 'cat-lunch',
        title: 'Ăn trưa',
        payload: {
          mealSlot: 'lunch',
          place: trip ? 'out' : r.pick(['home', 'home', 'out']),
          quality: sick ? 1 : r.pick([1, 2, 3]),
          items: [sick ? 'Cháo' : r.pick(['Cơm nhà', 'Bún bò', 'Lẩu'])],
        },
      })
    }
    const afternoonCoffee = r.chance(
      0.15 + (stress > 3.5 ? 0.35 : 0) + (night.hours < 6.5 ? 0.2 : 0),
    )
    let afternoonCoffeeAt: number | null = null
    if (afternoonCoffee && !sick) {
      afternoonCoffeeAt = 15 * 60 + r.int(5, 100)
      add(d, 'meal', afternoonCoffeeAt, null, {
        categoryId: 'cat-drink',
        title: 'Cà phê',
        payload: { drink: 'coffee' },
      })
    }
    if (r.chance(0.55 + (stress >= 3.5 ? 0.2 : 0))) {
      add(d, 'meal', 15 * 60 + r.int(10, 110), null, {
        categoryId: 'cat-snack',
        title: 'Ăn vặt',
        payload: {
          mealSlot: 'snack',
          quality: r.pick([2, 3, 3]),
          items: [r.pick(['Bánh quy', 'Trà sữa', 'Hạt', 'Trái cây'])],
        },
      })
    }
    const dinnerAt = sprint
      ? 20 * 60 + 45 + r.int(-20, 25)
      : weekend
        ? 19 * 60 + 30 + r.int(-40, 50)
        : 19 * 60 + r.int(-30, 40)
    add(d, 'meal', dinnerAt, null, {
      categoryId: 'cat-dinner',
      title: 'Ăn tối',
      payload: {
        mealSlot: 'dinner',
        place: sprint ? 'delivery' : r.pick(['home', 'home', 'out']),
        quality: r.pick([1, 2, 2, 3]),
        items: [r.pick(['Cơm nhà', 'Canh và cá', 'Mì', 'Lẩu', 'Gà nướng'])],
      },
    })

    // ---------------------------------------------------------------- exercise, learning, leisure (H15–H17)
    let exerciseDone = false
    const exerciseP = sick || sprint ? 0 : weekend ? 0.55 : 0.22
    if (r.chance(exerciseP) && !trip) {
      const at = weekend ? r.pick([7 * 60 + 10, 17 * 60]) : 18 * 60 + 10
      add(d, 'exercise', at, r.int(30, 60), {
        categoryId: 'cat-exercise',
        title: 'Vận động',
        payload: { kind: r.pick(['Chạy bộ', 'Chạy bộ', 'Gym', 'Đạp xe']), intensity: 'moderate' },
      })
      exerciseDone = true
    }
    if (trip) {
      add(d, 'exercise', 9 * 60 + 30, r.int(60, 120), {
        categoryId: 'cat-exercise',
        title: 'Đi bộ đường dài',
        payload: { kind: 'Đi bộ', intensity: 'light', distance: r.int(4, 9) },
      })
      exerciseDone = true
      add(d, 'activity', 14 * 60, 150, { categoryId: 'cat-outdoor', title: 'Ra ngoài trời' })
    }
    if (!sick && !sprint && !trip && r.chance(weekend ? 0.25 : 0.3)) {
      add(d, 'activity', weekend ? 9 * 60 + 30 : 21 * 60, r.int(45, 90), {
        categoryId: 'cat-ba',
        title: 'Học BA',
        payload: { focus: clamp(Math.round(3 + gauss() * 0.6), 1, 5) },
      })
    }
    if (!sick && r.chance(0.3)) {
      const minutes = r.int(15, 40)
      add(d, 'activity', 21 * 60 + 10, minutes, {
        categoryId: 'cat-readwork',
        title: 'Đọc sách chuyên môn',
      })
      if (minutes >= 20)
        add(d, 'habit', 21 * 60 + 10 + minutes, null, {
          title: 'Đọc sách 20 phút',
          value: minutes,
          unit: 'phút',
          payload: { habitId: 'habit-read' },
          source: 'quick',
        })
    }
    let friends = false
    if (!sick && (weekend ? r.chance(trip ? 0 : 0.5) : r.chance(0.05))) {
      add(d, 'activity', weekend ? 18 * 60 : 19 * 60, r.int(120, 200), {
        categoryId: 'cat-friends',
        title: 'Gặp bạn bè/gia đình',
      })
      friends = true
    }
    if (!works && !sick && !trip && r.chance(0.6)) {
      add(d, 'activity', 8 * 60 + 45 + r.int(0, 60), r.int(30, 60), {
        categoryId: 'cat-chores',
        title: 'Việc nhà',
      })
    }
    if (r.chance(sick ? 0.5 : 0.22)) {
      add(d, 'activity', 20 * 60 + 15, r.int(40, 100), { categoryId: 'cat-fun', title: 'Giải trí' })
    }
    const socialMin = Math.round(
      clamp(25 + 25 * (stress - 2) + (weekend ? 30 : 0) + gauss() * 20, 10, 150),
    )
    add(d, 'activity', 21 * 60 + 40, socialMin, { categoryId: 'cat-social', title: 'Mạng xã hội' })
    const screenBeforeBed = socialMin > 50 || r.chance(0.15)

    // ---------------------------------------------------------------- water (H9)
    const glasses = clamp(
      Math.round(7 + gauss() * 1.6 - (sprint ? 2 : 0) + (sick ? 2 : 0) - (trip ? 2 : 0)),
      2,
      12,
    )
    for (let i = 0; i < glasses; i++)
      add(d, 'water', 8 * 60 + Math.round(((i + r.next() * 0.8) / glasses) * 13 * 60), null, {
        categoryId: 'cat-water',
        title: 'Nước',
        value: 250,
        unit: 'ml',
      })
    const waterMl = glasses * 250

    // ---------------------------------------------------------------- check-ins (H7–H9, H16)
    const energyAt = (m: number) => {
      const circadian =
        m < 11 * 60 ? 0.3 : m < 14 * 60 ? 0 : m < 16 * 60 ? -0.6 : m < 19 * 60 ? -0.1 : 0.1
      const coffee =
        morningCoffeeAt !== null && m >= morningCoffeeAt && m <= morningCoffeeAt + 180 ? 0.3 : 0
      const afterCoffee =
        afternoonCoffeeAt !== null && m >= afternoonCoffeeAt && m <= afternoonCoffeeAt + 180
          ? 0.3
          : 0
      return (
        baseEnergy + circadian + coffee + afterCoffee + (waterMl < 1250 ? -0.3 : 0) + gauss() * 0.4
      )
    }
    const energies: number[] = []
    const moods: number[] = []
    for (const m of [9 * 60 + 30, 12 * 60 + 40, 15 * 60 + 15, 19 * 60 + 30]) {
      if (r.chance(0.2)) continue
      const e = clamp(Math.round(energyAt(m)), 1, 5)
      const mood = clamp(
        Math.round(
          3.4 +
            0.3 * (e - 3) +
            (exerciseDone ? 0.4 : 0) +
            (friends ? 0.5 : 0) -
            0.3 * Math.max(0, stress - 2) -
            (socialMin > 90 ? 0.3 : 0) +
            (weekend ? 0.3 : 0) +
            gauss() * 0.4,
        ),
        1,
        5,
      )
      energies.push(e)
      moods.push(mood)
      add(d, 'note', m + r.int(-15, 20), null, {
        title: 'Check-in',
        payload: { checkin: { energy: e, mood } },
        source: 'quick',
      })
    }

    // ---------------------------------------------------------------- tonight's sleep (H1–H6, H14, H18)
    const lateCoffee = afternoonCoffeeAt !== null
    let bedMin =
      (weekend || trip ? 24 * 60 + 20 + (trip ? 10 : 0) : dow === 4 ? 24 * 60 : 23 * 60 + 30) +
      gauss() * 32 +
      (sprint ? 25 : 0) +
      (screenBeforeBed ? 20 : 0) +
      (sick ? -60 : 0)
    bedMin = clamp(bedMin, 21 * 60 + 30, 26 * 60 + 30)
    const lateDinner = bedMin - dinnerAt < 150
    let q =
      3.6 -
      (lateCoffee ? 0.8 : 0) -
      (screenBeforeBed ? 0.6 : 0) -
      (lateDinner ? 0.5 : 0) -
      (stress >= 4 ? 0.7 : 0) +
      (exerciseDone ? 0.4 : 0) +
      gauss() * 0.5
    q = clamp(q, 1, 5)
    const nextIsWeekday = weekday(addDays(d, 1)) < 5
    const wakeNext = nextIsWeekday
      ? 6 * 60 + 30 + r.int(-10, 12)
      : bedMin - 24 * 60 + Math.round((7.6 + gauss() * 0.6) * 60) + (sick ? 90 : 0)
    const hours = clamp((wakeNext + 24 * 60 - bedMin) / 60, 4, 11.5)
    const durMin = Math.round(hours * 60)
    add(d, 'sleep', bedMin, durMin, {
      categoryId: 'cat-sleep',
      title: 'Ngủ đêm',
      payload: {
        quality: Math.round(q),
        screenBeforeBed,
        alarm: nextIsWeekday,
        wakeUps: clamp(Math.round((5 - q) * 0.6 + (lateCoffee ? 0.6 : 0) + gauss() * 0.4), 0, 4),
      },
    })

    // ---------------------------------------------------------------- the rated day
    const energyDay = avg(energies)
    const moodDay = avg(moods)
    const focusDay = avg(focusScores)
    const label = sick
      ? 'Cả ngày ở nhà, cảm cúm'
      : trip
        ? 'Đi chơi xa cuối tuần'
        : sprint
          ? 'Nước rút deadline, làm đến tối'
          : exerciseDone
            ? 'Có tập, người nhẹ hẳn'
            : friends
              ? 'Gặp bạn bè vui'
              : night.hours < 6.3
                ? 'Thiếu ngủ nên cả ngày uể oải'
                : ''
    dayRows.push({
      dateKey: d,
      mood: moodDay === null ? null : (clamp(Math.round(moodDay), 1, 5) as Day['mood']),
      energy: energyDay === null ? null : (clamp(Math.round(energyDay), 1, 5) as Day['energy']),
      stress: clamp(Math.round(stress), 1, 5) as Day['stress'],
      focus: focusDay === null ? null : (clamp(Math.round(focusDay), 1, 5) as Day['focus']),
      dayScore:
        energyDay === null || moodDay === null
          ? null
          : clamp(
              Math.round(2 + 1.1 * moodDay + 0.9 * energyDay - 0.5 * (stress - 2) + gauss()),
              1,
              10,
            ),
      highlight: label,
      dayType: sick ? 'sick' : trip ? 'travel' : null,
      note: '',
      createdAt: stamp,
      updatedAt: stamp,
      deviceId: FAKE_DEVICE,
      deleted: false,
      dirty: 0,
    })

    night = { hours, quality: q, bedMin: bedMin % 1440 }
  }

  if (opts.nowIso) {
    const now = Date.parse(opts.nowIso)
    const last = keys[keys.length - 1]!
    return {
      entries: entries.filter((e) => Date.parse(e.start) <= now),
      days: dayRows.filter((x) => x.dateKey !== last),
    }
  }
  return { entries, days: dayRows }
}
