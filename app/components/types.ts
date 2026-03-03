export type Exercise = {
  id: string // uuid from day_exercises
  name: string
  target_reps: number
  sort_order: number
  catalog_exercise_id?: number | null
  catalog_key?: string
  unit?: string
  weight?: number | null
  default_target?: number | null
  is_user_added?: boolean
  is_one_off?: boolean
}

export type HistoryEntry = {
  day: number
  date: string // YYYY-MM-DD (local date)
  totalDone: number
  totalTarget: number
}
