// Plain data types shared by core, data, sync and ui. No runtime code here.

/** Sync bookkeeping on every stored record. `dirty` is 0/1 because IndexedDB cannot index booleans. */
export interface SyncFields {
  createdAt: string
  updatedAt: string
  deviceId: string
  deleted: boolean
  dirty: 0 | 1
}

export type EntryType =
  'sleep' | 'meal' | 'work' | 'habit' | 'exercise' | 'activity' | 'water' | 'note'

export type EntrySource = 'manual' | 'timer' | 'quick'

export type Rating = 1 | 2 | 3 | 4 | 5

export interface Entry extends SyncFields {
  id: string
  type: EntryType
  /** Logical day, computed only by toDateKey. */
  dateKey: string
  start: string
  end: string | null
  categoryId: string
  title: string
  value: number | null
  unit: string
  rating: Rating | null
  tags: string[]
  /** At most 3. */
  photoIds: string[]
  /** Per-type fields, typed per module later. */
  payload: Record<string, unknown>
  source: EntrySource
  note: string
}

export type DayType = 'workday' | 'weekend' | 'holiday' | 'sick' | 'travel'

export interface Day extends SyncFields {
  dateKey: string
  mood: Rating | null
  energy: Rating | null
  stress: Rating | null
  focus: Rating | null
  dayScore: number | null
  highlight: string
  dayType: DayType | null
  note: string
}

export interface Category {
  id: string
  name: string
  entryType: EntryType
  color: string
  icon: string
  order: number
  archived: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface QuickAction {
  id: string
  name: string
  icon: string
  order: number
  type: EntryType
  categoryId: string
  title: string
  value: number | null
  unit: string
}

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // Monday = 0 … Sunday = 6
  | { kind: 'timesPerWeek'; times: number }

export interface Habit {
  id: string
  name: string
  direction: 'build' | 'quit'
  kind: 'check' | 'count' | 'duration'
  target: { op: '>=' | '<=' | '='; value: number }
  schedule: HabitSchedule
  reminderTime: string | null
  /** Auto-count from another entry type, e.g. water. */
  linkedRule: { entryType: EntryType; categoryId?: string } | null
  startDate: string
  archived: boolean
}

export interface Defs {
  categories: Category[]
  habits: Habit[]
  quickActions: QuickAction[]
  tags: Tag[]
}

export interface Settings {
  dayStartHour: number
  /** HH:mm */
  workStart: string
  workEnd: string
  /** Monday = 0 … Sunday = 6 */
  workDays: number[]
  sleepTargetHours: number
  waterTargetMl: number
  exerciseTargetMinPerWeek: number
  /** HH:mm after which the in-app "rate the day" banner appears. */
  reviewTime: string
  /** Habit streaks and rates skip days typed sick or travel. */
  skipRestDays: boolean
  theme: 'light' | 'dark' | 'system'
}

export type InsightStatus = 'new' | 'seen' | 'trying' | 'helpful' | 'wrong' | 'hidden'

export interface Insight {
  id: string
  source: 'rule' | 'correlation'
  /** Rule id or correlation key; used to down-weight rejected insight kinds. */
  kind: string
  text: string
  confidence: 'weak' | 'medium' | 'strong' | null
  status: InsightStatus
  hiddenUntil: string | null
  createdAt: string
  updatedAt: string
}

export interface PhotoRecord {
  id: string
  blob: Blob
  thumb: Blob
  createdAt: string
  /** 1 once both files are on Drive. */
  uploaded: 0 | 1
}
