import { supabase } from "./supabase"

export type CatalogExercise = {
  id: number
  key: string
  label: string
  unit: "reps" | "steps"
  default_target: number
  weight: number
}

const FALLBACK_CATALOG: CatalogExercise[] = [
  { id: 1, key: "push_ups", label: "Push-ups", unit: "reps", default_target: 50, weight: 1 },
  { id: 2, key: "pull_ups", label: "Pull-ups", unit: "reps", default_target: 20, weight: 2 },
  { id: 3, key: "squats", label: "Squats", unit: "reps", default_target: 100, weight: 0.5 },
  { id: 4, key: "dips", label: "Dips", unit: "reps", default_target: 50, weight: 1.5 },
  { id: 5, key: "abs", label: "Abs", unit: "reps", default_target: 50, weight: 0.5 },
  { id: 6, key: "walking", label: "Walking", unit: "steps", default_target: 12000, weight: 0.005 },
]

export async function loadExerciseCatalog(): Promise<{ data: CatalogExercise[]; error?: string }> {
  const { data, error } = await supabase
    .from("exercise_catalog")
    .select("id,key,label,unit,default_target,weight")
    .eq("is_active", true)
    .order("label", { ascending: true })

  if (error) {
    const msg = error.message || ""
    if (msg.includes("exercise_catalog") || msg.includes("schema cache")) {
      return { data: FALLBACK_CATALOG }
    }
    return { data: [], error: msg }
  }
  return { data: (data as CatalogExercise[]) ?? [] }
}
