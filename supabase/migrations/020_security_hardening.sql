-- Migration 020: address Supabase advisor security warnings.
--
-- After running this:
--   - All 5 functions get an immutable search_path (no shadowing risk)
--   - Trigger functions and internal helpers stop being RPC-callable
--   - The avatars storage bucket no longer exposes a file listing
--
-- Intentional public RPCs (resolve_bracket, create_group, join_group_by_code,
-- approve_join_request, decline_join_request, respond_to_invite, leave_group,
-- invite_friend_to_group, compute_group_standings, get_my_group_ids,
-- get_my_admin_group_ids) are left untouched — they're called from the app.

-- ── 1. Pin search_path on all flagged functions ────────────────────────────
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_group_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_admin_group_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.stamp_match_odds_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.stamp_wc_winner_odds_updated_at() SET search_path = public, pg_temp;

-- ── 2. Revoke EXECUTE on trigger / internal-helper functions ───────────────
-- Trigger functions: never meant to be called via PostgREST RPC. They run
-- with their original DEFINER privileges from the trigger itself.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_match_odds_updated_at()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_wc_winner_odds_updated_at()       FROM anon, authenticated;

-- Internal helpers: called only by other server-side functions, not by the app.
REVOKE EXECUTE ON FUNCTION public.compute_best_thirds()                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.slot_winner(p_slot text)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.slot_loser(p_slot text)                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_source(p_src text)              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_complete(p_group_label text)   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_phase_complete()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_public_group(gid uuid)               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(gid uuid, uid uuid)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_resolve_bracket()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_group_by_invite_code(code_input text) FROM anon, authenticated;

-- ── 3. Avatars bucket: drop the listing policy ─────────────────────────────
-- Public buckets serve files via direct URLs (no auth needed). The SELECT
-- policy on storage.objects only governs LIST operations, which leaks
-- filenames (user IDs) to anyone with the project URL.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
