-- Enable RLS on wc_top_scorers — flagged by Supabase security advisor
-- (rls_disabled_in_public). The table was created via MCP earlier in the
-- project and the original migration didn't enable RLS.
--
-- Reads: anyone can see players + odds + goals (mirrors wc_winner_odds).
-- Writes: blocked for everyone except the service-role key, which is what
-- the admin page already uses (adminClient() in admin/+page.server.ts).

ALTER TABLE public.wc_top_scorers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_wc_top_scorers"
  ON public.wc_top_scorers
  FOR SELECT
  USING (true);
