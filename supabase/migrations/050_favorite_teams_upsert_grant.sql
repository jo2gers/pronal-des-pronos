-- 050: fix "permission denied for table favorite_teams" on the club pick.
--
-- The /[comp]/team ?/pick action does a supabase upsert
-- (INSERT ... ON CONFLICT (user_id, competition_id) DO UPDATE), and PostgREST's
-- DO UPDATE SETs EVERY column in the payload — user_id, competition_id AND team.
-- Migration 046 only granted UPDATE on `team`, so the update of user_id /
-- competition_id was denied → the whole upsert failed for logged-in users
-- picking their favourite club. Grant UPDATE on all three pick columns.
-- bonus_points + locked_at are still NOT granted (INSERT or UPDATE) to
-- authenticated, so they stay service-role-only — the 046 anti-inflation hole
-- fix holds.

grant update (user_id, competition_id, team) on public.favorite_teams to authenticated;
