# Spec: Supabase Google-Login + Per-User Cloud Data

**Status:** Approved for implementation · **Date:** 2026-09-08 · **Baseline commit:** `5957e39`

## Overview

The game-stat app is a single static `index.html` deployed to GitHub Pages. Today it
stores one "current state" per game mode in browser `localStorage`, seeds from
`data/*.json`, and supports manual JSON export/import. There are no accounts and no
cross-device access.

This feature is the **first slice** of a larger "track results over time" goal. It adds
**Google sign-in** that gates the app and moves each user's tables into a private
**Supabase (Postgres)** store, keyed by `(user_id, table_id)`. A later spec adds the
`date` dimension to turn this into time-series result tracking.

## Goals & Non-Goals

### Goals
- Google OAuth sign-in that gates the whole app.
- Per-user, private, cross-device table storage in Supabase.
- Safe migration path for existing local data.
- Concurrency guard against cross-device clobbering.
- Self-serve deletion of a user's data.

### Non-Goals (this slice)
- Date-keyed result / time-series tracking (follow-up spec).
- Offline editing / sync queue — the app is online-only.
- Shared or public tables.
- Normalized per-player SQL rows.
- Audit log / undo of edits or imports.
- Full auth-account (`auth.users`) deletion.

## Architecture

```
Visitor → Login gate → Google OAuth → Supabase session → app loads user's rows (RLS) → edit → save (updated_at guard)
```

- Frontend stays a single static `index.html` on GitHub Pages (no build step).
- Supabase JS client loaded via CDN `<script>`.
- Supabase provides Auth (Google provider), Postgres storage, RLS, and an RPC for deletion.
- After login, **Supabase is the source of truth** for table data; the browser's local
  copy is no longer authoritative.

## Auth & Session

- **Method:** Google OAuth only. No email/password, magic link, or GitHub.
- **Scopes:** `openid` + `email` only.
- **Redirect:** allowlisted to the GitHub Pages default URL
  (`https://smallhua22.github.io/game-stat/`) in both Google Cloud Console and Supabase.
- **Session:** Supabase defaults (~1h access / ~7d refresh token, persisted). A visible
  **Sign out** button in the topbar clears the session.
- **Gate:** logged-out visitors see only a sign-in screen; the stats UI is not rendered
  until authenticated.

## Data Model

One row per `(user_id, table_id)`; `table_id` is the game mode.

```sql
create table public.user_tables (
  user_id    uuid        not null references auth.users (id),
  table_id   text        not null check (table_id in ('pawapuro','prospi')),
  data       jsonb       not null,          -- full export shape: { schemaVersion, mode, activeSheet, sheets:{hitters,pitchers} }
  updated_at timestamptz not null default now(),
  primary key (user_id, table_id)
);
```

- `data` is the app's existing **export blob** (both `hitters` and `pitchers` sheets in
  one JSON). This absorbs the divergent pawapuro/prospi field sets with zero schema work.
- **Hybrid decision:** normalize into per-player rows only if/when SQL-level querying is
  actually needed.
- **Future:** the tracking spec adds a `date` column, extending the key to
  `(user_id, table_id, date)`.

### Concurrency (optimistic lock)
Each save sends the `updated_at` value it last read. If the row's current `updated_at`
differs (edited on another device), the write is rejected and the user is prompted to
reload. Prevents silent last-write-wins loss. Implemented as a conditional update:
`update ... where user_id = auth.uid() and table_id = $id and updated_at = $expected`
(0 rows affected → conflict).

## Security

**RLS is the entire security boundary.** The committed anon key grants nothing beyond
what RLS permits.

- **RLS policy:** enable RLS on `user_tables` (deny-by-default). Policy for
  select/insert/update/delete: `user_id = auth.uid()`.
- **Hard release gate:** before deploying, attempt an **unauthenticated read AND write**
  against `user_tables` and confirm both are denied. This test must pass before release.
- **Anon key** is committed in the public repo — safe by design. Rotation, if ever
  needed, is done by provisioning a new Supabase project.
- **Scopes** minimized to `openid` + `email`.

## Migration & Data Safety

- Cloud starts **empty** on first login; no automatic localStorage→cloud migration.
- On first appearance of the login gate, if existing `localStorage` table data is
  detected, prompt the user to **export it first** so nothing is lost.
- After signing in, the user imports that JSON via the existing import button. The
  gitignored `local-data/` files are imported the same way.

## Account & Data Deletion

- A "Delete my data" action calls a `security definer` Postgres function
  (`delete_account()`) that removes the caller's `user_tables` rows.
- The `auth.users` record is intentionally **kept** (orphaned but harmless), avoiding an
  Edge Function. Full auth-user deletion can be added later.

## Configuration

Because there is no build step, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are defined as
plain constants near the top of `index.html` (or a small `config.js`) and committed. This
is acceptable for the Supabase anon key by design.

## Accepted Risks

- **Free tier:** Supabase pauses inactive free-tier projects (~1 week); auth then fails
  until reactivated. Accepted and documented for personal-scale use.
- **Online-only:** no offline editing once cloud is source of truth.
- **Orphaned auth users:** deleted-data accounts leave an unused `auth.users` row.

## Decisions Log

| ID | Topic | Decision | Rationale | Source | Date |
|---|---|---|---|---|---|
| D1 | Identity | Real multi-user with login | Cross-device access needs real accounts | Interview | 2026-09-08 |
| D2 | Backend | Supabase (Postgres + Auth + RLS) | Maps cleanly to (user_id, table_id, date); free tier; frontend stays static | Interview | 2026-09-08 |
| D3 | Scope | First slice = login + per-user cloud data; date tracking is a later spec | Keep first feature shippable | Interview | 2026-09-08 |
| D4 | Auth method | Google OAuth only | No passwords to store/reset; least attack surface | Interview | 2026-09-08 |
| D5 | Login depth | Login gates app; Supabase is source of truth for tables | Deliver real per-user cloud data now | Interview | 2026-09-08 |
| D6 | Data model | JSON blob per (user_id, table_id); table_id = mode; normalize later | Trivial migration; absorbs field divergence | Interview | 2026-09-08 |
| D7 | Migration | Cloud starts empty; manual JSON import | Simplest logic | Interview | 2026-09-08 |
| D8 | Visibility | Strictly private; RLS user_id = auth.uid() | Safest default | Interview | 2026-09-08 |
| D9 | Deletion | Self-serve data deletion (mechanism in D11) | Privacy expectation | Interview | 2026-09-08 |
| D10 | Deploy/config | GitHub Pages default domain; anon key committed | No build step; keep current workflow; anon key public by design | Interview | 2026-09-08 |
| D11 | Deletion mechanism | Postgres RPC deletes data rows; auth user kept | Client can't delete auth.users directly; avoids Edge Function | Red Team | 2026-09-08 |
| D12 | Concurrency | updated_at optimistic lock; reject stale writes | Prevent silent cross-device clobber | Red Team | 2026-09-08 |
| D13 | Data safety | Prompt export of existing localStorage before login gate | Prevent data loss for existing users | Red Team | 2026-09-08 |
| D14 | Session | Sign out button + Supabase default persistence | Standard, low effort | Red Team | 2026-09-08 |
| D15 | Free tier | Accept Supabase auto-pause risk; document | Personal scale | Red Team | 2026-09-08 |
| D16 | Offline | Online-only; no sync queue | Out of scope | Red Team | 2026-09-08 |
| D17 | OAuth scopes | Request openid + email only | Privacy minimization | Red Team | 2026-09-08 |

## Dependency Graph & Implementation Order

```
[Supabase + Google OAuth setup] ──▶ [user_tables schema + RLS] ──▶ [Auth UI: login gate · logout]
                                └──▶ [delete_account RPC] ─────────▶ [Cloud data layer: read/write + updated_at]
                                                                   └▶ [Pre-login export prompt + delete button]
```

1. **Provision Supabase + configure Google OAuth** — create project; enable Google
   provider; allowlist the GitHub Pages redirect URL; capture URL + anon key. *(External — user does this.)*
2. **Create `user_tables` + RLS policy** — columns + owner-only RLS; then run the
   unauthenticated-access denial test (release gate).
3. **Add `delete_account` RPC** — `security definer` function deleting the caller's rows.
4. **Auth UI** — login gate, Google sign-in button, Sign out; wire Supabase client into `index.html`.
5. **Cloud data layer** — swap read/write from localStorage to Supabase; enforce
   `updated_at` optimistic lock; keep import/export.
6. **Pre-login export prompt + delete button** — detect existing localStorage and prompt
   export; surface the delete-data action.
