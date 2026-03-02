create table if not exists public.user_exercise_progress (
  id bigserial primary key,
  user_id text not null,
  local_date text not null,
  day_exercise_id bigint not null references public.day_exercises(id) on delete cascade,
  done int not null
);

alter table public.user_exercise_progress enable row level security;

drop policy if exists "user_exercise_progress_allow_all" on public.user_exercise_progress;
create policy "user_exercise_progress_allow_all"
on public.user_exercise_progress
for all
using (true)
with check (true);

