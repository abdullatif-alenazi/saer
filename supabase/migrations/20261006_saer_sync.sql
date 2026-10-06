-- Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.saer_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saer_state enable row level security;

drop policy if exists "Read own Saer state" on public.saer_state;
drop policy if exists "Insert own Saer state" on public.saer_state;
drop policy if exists "Update own Saer state" on public.saer_state;

create policy "Read own Saer state" on public.saer_state for select using (auth.uid() = user_id);
create policy "Insert own Saer state" on public.saer_state for insert with check (auth.uid() = user_id);
create policy "Update own Saer state" on public.saer_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
