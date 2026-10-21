import type { Category, Defs, EntryType, Habit, QuickAction } from './types'

// Ids are fixed strings (not UUIDs) so two devices that both seed produce the same records.
const WORK_COLOR = '#3b4a9e'
const GROWTH_COLOR = '#2e7d32'
const PERSONAL_COLOR = '#ef6c00'
const MEAL_COLOR = '#c2185b'
const BODY_COLOR = '#00838f'

function cat(
  id: string,
  name: string,
  entryType: EntryType,
  color: string,
  icon: string,
  order: number,
): Category {
  return { id, name, entryType, color, icon, order, archived: false }
}

export const DEFAULT_CATEGORIES: Category[] = [
  cat('cat-deep', 'Deep work', 'work', WORK_COLOR, '💻', 1),
  cat('cat-meeting', 'Họp', 'work', WORK_COLOR, '👥', 2),
  cat('cat-support', 'Hỗ trợ/fix lỗi khách', 'work', WORK_COLOR, '🛠', 3),
  cat('cat-chat', 'Email/chat', 'work', WORK_COLOR, '✉️', 4),
  cat('cat-learnwork', 'Học trong việc', 'work', WORK_COLOR, '📘', 5),
  cat('cat-ba', 'Học BA', 'activity', GROWTH_COLOR, '📊', 6),
  cat('cat-side', 'Side project', 'activity', GROWTH_COLOR, '🚀', 7),
  cat('cat-readwork', 'Đọc sách chuyên môn', 'activity', GROWTH_COLOR, '📖', 8),
  cat('cat-chores', 'Việc nhà', 'activity', PERSONAL_COLOR, '🧹', 9),
  cat('cat-commute', 'Di chuyển', 'activity', PERSONAL_COLOR, '🛵', 10),
  cat('cat-fun', 'Giải trí', 'activity', PERSONAL_COLOR, '🎮', 11),
  cat('cat-social', 'Mạng xã hội', 'activity', PERSONAL_COLOR, '📱', 12),
  cat('cat-friends', 'Gặp bạn bè/gia đình', 'activity', PERSONAL_COLOR, '🧑‍🤝‍🧑', 13),
  cat('cat-outdoor', 'Ra ngoài trời', 'activity', GROWTH_COLOR, '🌤', 14),
  cat('cat-breakfast', 'Ăn sáng', 'meal', MEAL_COLOR, '🥐', 15),
  cat('cat-lunch', 'Ăn trưa', 'meal', MEAL_COLOR, '🍱', 16),
  cat('cat-dinner', 'Ăn tối', 'meal', MEAL_COLOR, '🍜', 17),
  cat('cat-snack', 'Ăn vặt', 'meal', MEAL_COLOR, '🍪', 18),
  cat('cat-drink', 'Đồ uống', 'meal', MEAL_COLOR, '☕', 19),
  cat('cat-sleep', 'Ngủ đêm', 'sleep', BODY_COLOR, '🌙', 20),
  cat('cat-nap', 'Ngủ trưa', 'sleep', BODY_COLOR, '😴', 21),
  cat('cat-exercise', 'Vận động', 'exercise', BODY_COLOR, '🏃', 22),
  cat('cat-water', 'Nước', 'water', BODY_COLOR, '💧', 23),
]

function qa(
  id: string,
  name: string,
  icon: string,
  order: number,
  type: EntryType,
  categoryId: string,
  extra: Partial<Pick<QuickAction, 'value' | 'unit'>> = {},
): QuickAction {
  return { id, name, icon, order, type, categoryId, title: name, value: null, unit: '', ...extra }
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  qa('qa-wake', 'Thức dậy', '☀️', 1, 'sleep', 'cat-sleep'),
  qa('qa-sleep', 'Đi ngủ', '🌙', 2, 'sleep', 'cat-sleep'),
  qa('qa-breakfast', 'Ăn sáng', '🥐', 3, 'meal', 'cat-breakfast'),
  qa('qa-lunch', 'Ăn trưa', '🍱', 4, 'meal', 'cat-lunch'),
  qa('qa-dinner', 'Ăn tối', '🍜', 5, 'meal', 'cat-dinner'),
  qa('qa-work', 'Làm việc', '💻', 6, 'work', 'cat-deep'),
  qa('qa-water', 'Uống nước', '💧', 7, 'water', 'cat-water', { value: 250, unit: 'ml' }),
  qa('qa-coffee', 'Cà phê', '☕', 8, 'meal', 'cat-drink'),
  qa('qa-outdoor', 'Ra ngoài trời', '🌤', 9, 'activity', 'cat-outdoor'),
]

function habit(
  id: string,
  name: string,
  kind: Habit['kind'],
  target: Habit['target'],
  startDate: string,
  extra: Partial<Pick<Habit, 'linkedRule' | 'archived' | 'metricRule'>> = {},
): Habit {
  return {
    id,
    name,
    direction: 'build',
    kind,
    target,
    schedule: { kind: 'daily' },
    reminderTime: null,
    linkedRule: null,
    startDate,
    archived: true,
    ...extra,
  }
}

/** Six sample habits; the first three are active, the rest are archived until the user turns them on. */
export function defaultHabits(startDate: string): Habit[] {
  return [
    habit('habit-water', 'Uống đủ 2 lít nước', 'count', { op: '>=', value: 2000 }, startDate, {
      archived: false,
      linkedRule: { entryType: 'water' },
    }),
    habit('habit-read', 'Đọc sách 20 phút', 'duration', { op: '>=', value: 20 }, startDate, {
      archived: false,
    }),
    habit('habit-exercise', 'Vận động 30 phút', 'duration', { op: '>=', value: 30 }, startDate, {
      archived: false,
      linkedRule: { entryType: 'exercise' },
    }),
    habit('habit-wake7', 'Dậy trước 7h', 'check', { op: '>=', value: 1 }, startDate, {
      metricRule: { metricId: 'wake_time', op: '<=', value: 7, previousNight: true },
    }),
    habit('habit-sleep2330', 'Ngủ trước 23h30', 'check', { op: '>=', value: 1 }, startDate, {
      metricRule: { metricId: 'bedtime', op: '<=', value: 23.5 },
    }),
    habit(
      'habit-nopreview',
      'Không màn hình 30 phút trước ngủ',
      'check',
      { op: '>=', value: 1 },
      startDate,
    ),
  ]
}

export function defaultDefs(startDate: string): Defs {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    habits: defaultHabits(startDate),
    quickActions: DEFAULT_QUICK_ACTIONS.map((q) => ({ ...q })),
    tags: [],
  }
}
