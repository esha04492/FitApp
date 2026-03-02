export type Exercise = {
  id: string // uuid from day_exercises
  name: string
  target_reps: number
  sort_order: number
  catalog_exercise_id?: number | null
  unit?: "reps" | "steps"
  weight?: number | null
}

export type HistoryEntry = {
  day: number
  date: string // YYYY-MM-DD (local date)
  totalDone: number
  totalTarget: number
}
