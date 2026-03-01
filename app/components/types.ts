export type Exercise = {
  id: string // uuid from day_exercises
  name: string
  target_reps: number
  sort_order: number
}

export type HistoryEntry = {
  day: number
  date: string // YYYY-MM-DD (Р»РѕРєР°Р»СЊРЅР°СЏ РґР°С‚Р°)
  totalDone: number
  totalTarget: number
}