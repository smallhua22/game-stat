-- Supabase setup for game-stat login + per-user cloud data (spec-supabase-login.md)
-- Run this in the Supabase SQL editor for your project.
-- Prerequisite: enable the Google auth provider in Authentication → Providers,
-- and allowlist your GitHub Pages URL (https://smallhua22.github.io/game-stat/)
-- as a redirect URL in Authentication → URL Configuration.

-- ---------------------------------------------------------------------------
-- 1. Schema: one JSON-blob row per (user_id, table_id). table_id = game mode.
-- ---------------------------------------------------------------------------
create table if not exists public.user_tables (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  table_id   text        not null check (table_id in ('pawapuro', 'prospi')),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_id)
);

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
-- 4. RELEASE GATE — verify RLS blocks unauthenticated access before deploy.
--    RLS is the ONLY thing protecting user data, so this test must pass.
--
--    Run these from the browser console on the DEPLOYED, SIGNED-OUT site
--    (uses the public anon key, no session):
--
--      const t = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
--      console.log(await t.from('user_tables').select('*'));
--        // EXPECT: error "permission denied for table user_tables"
--        //   (anon has no table privileges — blocked before RLS even applies)
--      console.log(await t.from('user_tables')
--        .insert({ user_id: '00000000-0000-0000-0000-000000000000',
--                  table_id: 'pawapuro', data: {} }));
--        // EXPECT: error — write denied
--      console.log(await t.rpc('delete_account'));
--        // EXPECT: error — anon cannot execute
--
--    If ANY of these return data or succeed without error, DO NOT deploy.
-- ---------------------------------------------------------------------------
