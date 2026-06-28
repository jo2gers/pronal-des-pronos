-- Migration 036: switch the site banner from free text to a predefined key.
--
-- The banner is now chosen from a fixed set of translated messages (see
-- src/lib/banners.ts) so it always renders in the visitor's language (FR/EN)
-- instead of whatever single language the admin typed. We store only the key.
-- The old free-text columns are left in place (unused) to avoid a destructive
-- change; the app reads/writes banner_key from here on.

alter table public.site_settings add column if not exists banner_key text;
