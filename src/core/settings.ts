import type { Settings } from './types'
import { DEFAULT_WATER_SIZES } from './water'

export const DEFAULT_SETTINGS: Settings = {
  dayStartHour: 4,
  workStart: '08:00',
  workEnd: '17:30',
  workDays: [0, 1, 2, 3, 4],
  sleepTargetHours: 7.5,
  waterTargetMl: 2000,
  waterSizes: DEFAULT_WATER_SIZES,
  exerciseTargetMinPerWeek: 150,
  reviewTime: '21:30',
  skipRestDays: false,
  photosWifiOnly: false,
  photoFullMonths: 0,
  ruleThresholds: {},
  disabledRules: [],
  weeklyBudgets: { deepWorkHours: 15, baHours: 4, socialHours: 7 },
  theme: 'system',
}
