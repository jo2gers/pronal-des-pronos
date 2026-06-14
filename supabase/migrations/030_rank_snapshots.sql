-- Per-user total-points snapshots, captured right before each scoring run.
-- The leaderboard derives rank deltas (per subset: global / league / friends)
-- by ranking the current standings vs the latest snapshot. `totals` is a
-- jsonb map { user_id: total_points }.
create table if not exists public.rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  totals jsonb not null
);

alter table public.rank_snapshots enable row level security;

-- Public read: the data is aggregate points already exposed by the leaderboard.
-- Inserts happen via the service-role client (cron), which bypasses RLS.
drop policy if exists rank_snapshots_public_read on public.rank_snapshots;
create policy rank_snapshots_public_read on public.rank_snapshots
  for select using (true);

create index if not exists rank_snapshots_created_at_idx
  on public.rank_snapshots (created_at desc);
