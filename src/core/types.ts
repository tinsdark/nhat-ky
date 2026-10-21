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

/** `quick` = tapped in real time on Hôm nay; `backfill` = written afterwards on Ghi bù, times are estimates. */
export type EntrySource = 'manual' | 'quick' | 'backfill'

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
  /** Upload photos only on Wi-Fi (when the browser can tell). */
  photosWifiOnly: boolean
  /** Rule threshold overrides, keyed `<ruleId>.<param>`; missing keys use the rule's default. */
  ruleThresholds: Record<string, number>
  /** Rule ids switched off in Settings. */
  disabledRules: string[]
  /** Weekly time budgets in hours (SPEC 4.4). Rules and the Thời gian screen use them. */
  weeklyBudgets: { deepWorkHours: number; baHours: number; socialHours: number }
  theme: 'light' | 'dark' | 'system'
}

export type InsightStatus = 'new' | 'seen' | 'trying' | 'helpful' | 'wrong' | 'hidden'

export interface Insight {
  /** Stable per `kind`: the same finding keeps its card and its feedback from day to day. */
  id: string
  source: 'rule' | 'correlation'
  /** `rule:<key>` or `corr:<factor>><outcome>:<lag>`; the weight key is derived from it. */
  kind: string
  text: string
  confidence: 'weak' | 'medium' | 'strong' | null
  status: InsightStatus
  /** Hidden until this dateKey (exclusive end); null when visible. */
  hiddenUntil: string | null
  /** What to try, when the finding is actionable (also the experiment's name); null = information only. */
  action: string | null
  /** Ranking score before feedback weights. */
  score: number
  /** Last day the engine produced it / last day it was shown among the daily picks. */
  lastSeenDate: string | null
  lastShownDate: string | null
  createdAt: string
  updatedAt: string
}

export type ExperimentStatus = 'running' | 'finished' | 'kept' | 'dropped'

export interface ExperimentResult {
  /** Days the habit was ticked inside the window, and baseline days before it. */
  nTest: number
  nBase: number
  testMean: number | null
  baseMean: number | null
  /** Cohen's d of test minus baseline; null when too few days. */
  d: number | null
  verdict: 'better' | 'worse' | 'same' | 'insufficient'
}

/** A 14-day trial of one change, run through a temporary habit (SPEC 8.5). */
export interface Experiment {
  id: string
  insightId: string
  /** What is being changed and what is measured; lag 1 = outcome of the day after. */
  factorId: string
  outcomeId: string
  lag: 0 | 1
  title: string
  habitId: string
  startDate: string
  endDate: string
  status: ExperimentStatus
  result: ExperimentResult | null
}

/** Everything the advice engine keeps (synced as one file, `nk_insights.json`). */
export interface InsightStore {
  items: Insight[]
  /** Per insight type (rule id, or `corr:<factor>`): below 1 after "Không đúng", above 1 after "Hữu ích". */
  weights: Record<string, number>
  /** dateKey of the last engine run, so it runs once a day. */
  lastRunDate: string | null
  experiments: Experiment[]
  /** Answers the user pasted back from Claude ("Hỏi Claude"). */
  claudeNotes: ClaudeNote[]
}

export interface ClaudeNote {
  id: string
  createdAt: string
  /** The question asked, and the pasted answer. */
  question: string
  text: string
}

export interface PhotoRecord {
  id: string
  /** Full-size file; null once evicted from the local cache (it is still on Drive). */
  blob: Blob | null
  thumb: Blob | null
  createdAt: string
  /** 1 once both files are on Drive. */
  uploaded: 0 | 1
}
