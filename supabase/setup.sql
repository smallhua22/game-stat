-- Supabase setup for game-stat login + per-user cloud data (spec-supabase-login.md)
-- Run this in the Supabase SQL editor for your project.
-- Prerequisite: enable the Google auth provider in Authentication → Providers,
-- and allowlist your GitHub Pages URL (https://smallhua22.github.io/game-stat/)
-- as a redirect URL in Authentication → URL Configuration.

-- ---------------------------------------------------------------------------
-- 1. Schema: one JSON-blob row per (user_id, table_id). table_id is a free-form
--    identifier for the table instance; type is the game mode it follows.
--    Today the app always sets both to the same value ('pawapuro'/'prospi'),
--    but they're separate columns so table_id can become a user-chosen name
--    later without touching the type/RLS/game-mode model.
-- ---------------------------------------------------------------------------

-- Lookup table of valid game modes, referenced by `type` below instead of
-- an inline CHECK — adding a new mode is then an insert here.
create table if not exists public.game_modes (
  id text primary key
);

insert into public.game_modes (id) values ('pawapuro'), ('prospi')
on conflict (id) do nothing;

create table if not exists public.user_tables (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  table_id   text        not null,
  type       text        not null references public.game_modes (id),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_id)
);

-- The app doesn't send `type` on insert yet (it only knows table_id, which
-- happens to already be the mode name) — default type from table_id so
-- today's writes keep working unchanged.
create or replace function public.default_type_from_table_id()
returns trigger language plpgsql as $$
begin
  if new.type is null then
    new.type := new.table_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_tables_default_type on public.user_tables;
create trigger trg_user_tables_default_type
  before insert on public.user_tables
  for each row execute function public.default_type_from_table_id();

-- Keep updated_at fresh on every UPDATE so it can act as an optimistic lock (D12).
-- The WHERE clause of an UPDATE sees the OLD updated_at (evaluated before this
-- trigger runs), so stale-write detection stays correct.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_tables_touch on public.user_tables;
create trigger trg_user_tables_touch
  before update on public.user_tables
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security: strictly private per user (D8). Deny-by-default.
-- ---------------------------------------------------------------------------
alter table public.user_tables enable row level security;

drop policy if exists "own rows - select" on public.user_tables;
create policy "own rows - select" on public.user_tables
  for select using (auth.uid() = user_id);

drop policy if exists "own rows - insert" on public.user_tables;
create policy "own rows - insert" on public.user_tables
  for insert with check (auth.uid() = user_id);

drop policy if exists "own rows - update" on public.user_tables;
create policy "own rows - update" on public.user_tables
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows - delete" on public.user_tables;
create policy "own rows - delete" on public.user_tables
  for delete using (auth.uid() = user_id);

-- Table-level privileges (needed because the project was created with
-- "Automatically expose new tables" OFF). Grant only to logged-in users and
-- deny the anonymous role entirely — defense-in-depth on top of RLS.
grant select, insert, update, delete on public.user_tables to authenticated;
revoke all on public.user_tables from anon;

grant select on public.game_modes to authenticated;
revoke all on public.game_modes from anon;

-- ---------------------------------------------------------------------------
-- 3. Self-serve data deletion (D9/D11): deletes the caller's rows only.
--    The auth.users record is intentionally kept.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = public as $$
  delete from public.user_tables where user_id = auth.uid();
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RELEASE GATE — before deploying, verify RLS blocks unauthenticated
--    read/write access. Automated in supabase/release-gate-test.mjs (runs in
--    CI before every deploy); see docs/spec-supabase-login.md#release-gate-test
--    for that plus the manual browser-console equivalent.
-- ---------------------------------------------------------------------------
