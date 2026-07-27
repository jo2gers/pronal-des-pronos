-- 043: Polymarket series id as competition DATA (they change per season —
-- EPL uses the evergreen series 36, UCL had 'ucl-2025' id 10204 and will get a
-- new id for 2026-27; the WC used 11433). Null = no odds sync yet.
alter table public.competitions add column polymarket_series_id text;
update public.competitions set polymarket_series_id = '36'    where slug = 'pl-2026-27';
update public.competitions set polymarket_series_id = '11433' where slug = 'wc-2026';
-- ucl-2026-27 stays null until Polymarket opens the season's series.
