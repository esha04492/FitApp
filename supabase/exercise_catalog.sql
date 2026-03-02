-- Exercise catalog + optional relation from day_exercises
create table if not exists public.exercise_catalog (
  id bigserial primary key,
  key text unique not null,
  label text not null,
  unit text not null check (unit in ('reps', 'steps')),
  default_target int not null,
  weight float not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.exercise_catalog enable row level security;

drop policy if exists "exercise_catalog_allow_all" on public.exercise_catalog;
create policy "exercise_catalog_allow_all"
on public.exercise_catalog
for all
using (true)
with check (true);

alter table public.day_exercises
  add column if not exists catalog_exercise_id bigint references public.exercise_catalog(id);

insert into public.exercise_catalog (key, label, unit, default_target, weight, is_active)
values
  ('push_ups', 'Push-ups', 'reps', 50, 1.0, true),
  ('pull_ups', 'Pull-ups', 'reps', 20, 2.0, true),
  ('squats', 'Squats', 'reps', 100, 0.5, true),
  ('dips', 'Dips', 'reps', 50, 1.5, true),
  ('abs', 'Abs', 'reps', 50, 0.5, true),
  ('walking', 'Walking', 'steps', 12000, 0.005, true),
  ('lunges', 'Lunges', 'reps', 40, 0.7, true),
  ('burpees', 'Burpees', 'reps', 30, 1.2, true),
  ('jump_rope', 'Jump rope', 'reps', 300, 0.2, true),
  ('mountain_climbers', 'Mountain climbers', 'reps', 80, 0.6, true)
on conflict (key) do update
set
  label = excluded.label,
  unit = excluded.unit,
  default_target = excluded.default_target,
  weight = excluded.weight,
  is_active = excluded.is_active;

