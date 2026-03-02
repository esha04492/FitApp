import { supabase } from "./supabase"

export type CatalogExercise = {
  id: number
  key: string
  label: string
  unit: "reps" | "steps"
  default_target: number
  weight: number
}

export async function loadExerciseCatalog(): Promise<{ data: CatalogExercise[]; error?: string }> {
  const { data, error } = await supabase
    .from("exercise_catalog")
    .select("id,key,label,unit,default_target,weight")
    .eq("is_active", true)
    .order("label", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data as CatalogExercise[]) ?? [] }
}

