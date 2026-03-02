alter table public.telegram_users
  add column if not exists display_name text;
