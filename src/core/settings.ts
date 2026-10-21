import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  dayStartHour: 4,
  workStart: '08:00',
  workEnd: '17:30',
  workDays: [0, 1, 2, 3, 4],
  sleepTargetHours: 7.5,
  waterTargetMl: 2000,
  exerciseTargetMinPerWeek: 150,
  reviewTime: '21:30',
  skipRestDays: false,
  theme: 'system',
}
