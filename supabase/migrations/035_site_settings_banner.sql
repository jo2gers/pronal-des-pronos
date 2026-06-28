-- Migration 035: site-wide announcement banner.
--
-- A single-row settings table holding one optional banner message shown at the
-- top of every page to ALL visitors (logged in or not). The admin sets/clears it
-- from /admin. security: public SELECT (everyone must see it); writes only via
-- the service-role admin client (which bypasses RLS), so no write policy.

create table if not exists public.site_settings (
  id                 smallint primary key default 1,
  banner_message     text,
  banner_tone        text not null default 'info',
  banner_updated_at  timestamptz,
  constraint site_settings_singleton check (id = 1),
  constraint site_settings_tone check (banner_tone in ('info', 'warn'))
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "public_read_site_settings" on public.site_settings;
create policy "public_read_site_settings" on public.site_settings
  for select to anon, authenticated using (true);

grant select on public.site_settings to anon, authenticated, service_role;
