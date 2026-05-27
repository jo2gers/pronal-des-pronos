-- Migration 019: enable RLS on bracket_template.
--
-- Supabase advisor lint 0013_rls_disabled_in_public flagged this table —
-- it sits in the public schema and is reachable via PostgREST, but RLS
-- had never been enabled, so anyone with the project URL could read AND
-- modify it.
--
-- bracket_template is static reference data (group → R32 → R16 mapping
-- consumed by the resolve_bracket RPC). Reads should be open to all
-- authenticated and anon users; writes are limited to the service role
-- (PostgREST never accepts service-role calls from the browser, so this
-- is safe).
--
-- After this migration:
--   - anon + authenticated roles: SELECT only
--   - service_role: full access (bypasses RLS by default)

ALTER TABLE public.bracket_template ENABLE ROW LEVEL SECURITY;

-- Read access for everyone (anon + authenticated)
DROP POLICY IF EXISTS "public_read_bracket_template" ON public.bracket_template;
CREATE POLICY "public_read_bracket_template"
  ON public.bracket_template
  FOR SELECT
  USING (true);
