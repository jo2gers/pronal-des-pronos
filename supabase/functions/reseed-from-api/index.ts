import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ODDS_API_KEY              = Deno.env.get('ODDS_API_KEY') ?? '';
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Team metadata (flag + group) ──────────────────────────────────────────────
const TEAMS: Record<string, { flag: string; group: string }> = {
  // Group A
  'Argentina':          { flag: 'AR', group: 'A' },
  'Canada':             { flag: 'CA', group: 'A' },
  'Chile':              { flag: 'CL', group: 'A' },
  'Peru':               { flag: 'PE', group: 'A' },
  // Group B
  'Spain':              { flag: 'ES', group: 'B' },
  'Morocco':            { flag: 'MA', group: 'B' },
  'Croatia':            { flag: 'HR', group: 'B' },
  'Bahrain':            { flag: 'BH', group: 'B' },
  // Group C
  'USA':                { flag: 'US', group: 'C' },
  'Panama':             { flag: 'PA', group: 'C' },
  'Venezuela':          { flag: 'VE', group: 'C' },
  'New Zealand':        { flag: 'NZ', group: 'C' },
  // Group D
  'France':             { flag: 'FR', group: 'D' },
  'Mexico':             { flag: 'MX', group: 'D' },
  'Saudi Arabia':       { flag: 'SA', group: 'D' },
  'Dominican Republic': { flag: 'DO', group: 'D' },
  // Group E
  'Portugal':           { flag: 'PT', group: 'E' },
  'Czech Republic':     { flag: 'CZ', group: 'E' },
  'Cameroon':           { flag: 'CM', group: 'E' },
  'Jamaica':            { flag: 'JM', group: 'E' },
  // Group F
  'Brazil':             { flag: 'BR', group: 'F' },
  'Japan':              { flag: 'JP', group: 'F' },
  'Ecuador':            { flag: 'EC', group: 'F' },
  'Australia':          { flag: 'AU', group: 'F' },
  // Group G
  'England':            { flag: 'GB', group: 'G' },
  'Senegal':            { flag: 'SN', group: 'G' },
  'IR Iran':            { flag: 'IR', group: 'G' },
  'Slovakia':           { flag: 'SK', group: 'G' },
  // Group H
  'Germany':            { flag: 'DE', group: 'H' },
  'Colombia':           { flag: 'CO', group: 'H' },
  'Costa Rica':         { flag: 'CR', group: 'H' },
  'Ukraine':            { flag: 'UA', group: 'H' },
  // Group I
  'Netherlands':        { flag: 'NL', group: 'I' },
  'Uruguay':            { flag: 'UY', group: 'I' },
  'Iraq':               { flag: 'IQ', group: 'I' },
  'Bolivia':            { flag: 'BO', group: 'I' },
  // Group J
  'Belgium':            { flag: 'BE', group: 'J' },
  'Italy':              { flag: 'IT', group: 'J' },
  'Egypt':              { flag: 'EG', group: 'J' },
  'Indonesia':          { flag: 'ID', group: 'J' },
  // Group K
  'Turkey':             { flag: 'TR', group: 'K' },
  'South Korea':        { flag: 'KR', group: 'K' },
  'Nigeria':            { flag: 'NG', group: 'K' },
  'Honduras':           { flag: 'HN', group: 'K' },
  // Group L
  'Switzerland':        { flag: 'CH', group: 'L' },
  'Norway':             { flag: 'NO', group: 'L' },
  'DR Congo':           { flag: 'CD', group: 'L' },
  'Paraguay':           { flag: 'PY', group: 'L' },
};

// ── Name normalization for Odds API matching ──────────────────────────────────
const ALIASES: Record<string, string> = {
  'united states': 'usa',
  'ir iran': 'iran',
  'korea republic': 'south korea',
  'republic of korea': 'south korea',
  'czechia': 'czech republic',
  'turkiye': 'turkey',
  'congo dr': 'dr congo',
  'democratic republic of congo': 'dr congo',
};

function norm(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return ALIASES[n] ?? n;
}

function matchKey(home: string, away: string): string {
  return [norm(home), norm(away)].sort().join('|');
}

// ── All 72 WC2026 group-stage fixtures (approximate times as fallback) ────────
type Fixture = { home: string; away: string; date: string; group: string };

const FIXTURES: Fixture[] = [
  // ── Group A: Argentina · Canada · Chile · Peru
  { home: 'Argentina',     away: 'Canada',             date: '2026-06-12T20:00:00Z', group: 'A' },
  { home: 'Chile',         away: 'Peru',               date: '2026-06-12T23:00:00Z', group: 'A' },
  { home: 'Argentina',     away: 'Chile',              date: '2026-06-17T20:00:00Z', group: 'A' },
  { home: 'Canada',        away: 'Peru',               date: '2026-06-17T23:00:00Z', group: 'A' },
  { home: 'Argentina',     away: 'Peru',               date: '2026-06-26T00:00:00Z', group: 'A' },
  { home: 'Canada',        away: 'Chile',              date: '2026-06-26T00:00:00Z', group: 'A' },
  // ── Group B: Spain · Morocco · Croatia · Bahrain
  { home: 'Spain',         away: 'Morocco',            date: '2026-06-11T20:00:00Z', group: 'B' },
  { home: 'Croatia',       away: 'Bahrain',            date: '2026-06-11T23:00:00Z', group: 'B' },
  { home: 'Spain',         away: 'Croatia',            date: '2026-06-16T20:00:00Z', group: 'B' },
  { home: 'Morocco',       away: 'Bahrain',            date: '2026-06-16T23:00:00Z', group: 'B' },
  { home: 'Spain',         away: 'Bahrain',            date: '2026-06-26T03:00:00Z', group: 'B' },
  { home: 'Morocco',       away: 'Croatia',            date: '2026-06-26T03:00:00Z', group: 'B' },
  // ── Group C: USA · Panama · Venezuela · New Zealand
  { home: 'USA',           away: 'Panama',             date: '2026-06-13T23:00:00Z', group: 'C' },
  { home: 'Venezuela',     away: 'New Zealand',        date: '2026-06-13T20:00:00Z', group: 'C' },
  { home: 'USA',           away: 'Venezuela',          date: '2026-06-18T23:00:00Z', group: 'C' },
  { home: 'Panama',        away: 'New Zealand',        date: '2026-06-18T20:00:00Z', group: 'C' },
  { home: 'USA',           away: 'New Zealand',        date: '2026-06-27T00:00:00Z', group: 'C' },
  { home: 'Panama',        away: 'Venezuela',          date: '2026-06-27T00:00:00Z', group: 'C' },
  // ── Group D: France · Mexico · Saudi Arabia · Dominican Republic
  { home: 'Mexico',        away: 'Dominican Republic', date: '2026-06-11T17:00:00Z', group: 'D' },
  { home: 'France',        away: 'Saudi Arabia',       date: '2026-06-12T17:00:00Z', group: 'D' },
  { home: 'Mexico',        away: 'France',             date: '2026-06-17T17:00:00Z', group: 'D' },
  { home: 'Saudi Arabia',  away: 'Dominican Republic', date: '2026-06-17T20:00:00Z', group: 'D' },
  { home: 'France',        away: 'Dominican Republic', date: '2026-06-27T03:00:00Z', group: 'D' },
  { home: 'Mexico',        away: 'Saudi Arabia',       date: '2026-06-27T03:00:00Z', group: 'D' },
  // ── Group E: Portugal · Czech Republic · Cameroon · Jamaica
  { home: 'Portugal',      away: 'Czech Republic',     date: '2026-06-14T20:00:00Z', group: 'E' },
  { home: 'Cameroon',      away: 'Jamaica',            date: '2026-06-14T23:00:00Z', group: 'E' },
  { home: 'Portugal',      away: 'Cameroon',           date: '2026-06-19T20:00:00Z', group: 'E' },
  { home: 'Czech Republic', away: 'Jamaica',           date: '2026-06-19T23:00:00Z', group: 'E' },
  { home: 'Portugal',      away: 'Jamaica',            date: '2026-06-28T00:00:00Z', group: 'E' },
  { home: 'Czech Republic', away: 'Cameroon',          date: '2026-06-28T00:00:00Z', group: 'E' },
  // ── Group F: Brazil · Japan · Ecuador · Australia
  { home: 'Brazil',        away: 'Japan',              date: '2026-06-15T20:00:00Z', group: 'F' },
  { home: 'Ecuador',       away: 'Australia',          date: '2026-06-15T23:00:00Z', group: 'F' },
  { home: 'Brazil',        away: 'Ecuador',            date: '2026-06-20T20:00:00Z', group: 'F' },
  { home: 'Japan',         away: 'Australia',          date: '2026-06-20T23:00:00Z', group: 'F' },
  { home: 'Brazil',        away: 'Australia',          date: '2026-06-28T03:00:00Z', group: 'F' },
  { home: 'Japan',         away: 'Ecuador',            date: '2026-06-28T03:00:00Z', group: 'F' },
  // ── Group G: England · Senegal · IR Iran · Slovakia
  { home: 'England',       away: 'Senegal',            date: '2026-06-13T17:00:00Z', group: 'G' },
  { home: 'IR Iran',       away: 'Slovakia',           date: '2026-06-13T20:00:00Z', group: 'G' },
  { home: 'England',       away: 'IR Iran',            date: '2026-06-18T17:00:00Z', group: 'G' },
  { home: 'Senegal',       away: 'Slovakia',           date: '2026-06-18T20:00:00Z', group: 'G' },
  { home: 'England',       away: 'Slovakia',           date: '2026-06-29T00:00:00Z', group: 'G' },
  { home: 'Senegal',       away: 'IR Iran',            date: '2026-06-29T00:00:00Z', group: 'G' },
  // ── Group H: Germany · Colombia · Costa Rica · Ukraine
  { home: 'Germany',       away: 'Colombia',           date: '2026-06-14T17:00:00Z', group: 'H' },
  { home: 'Costa Rica',    away: 'Ukraine',            date: '2026-06-14T20:00:00Z', group: 'H' },
  { home: 'Germany',       away: 'Costa Rica',         date: '2026-06-19T17:00:00Z', group: 'H' },
  { home: 'Colombia',      away: 'Ukraine',            date: '2026-06-19T20:00:00Z', group: 'H' },
  { home: 'Germany',       away: 'Ukraine',            date: '2026-06-29T03:00:00Z', group: 'H' },
  { home: 'Colombia',      away: 'Costa Rica',         date: '2026-06-29T03:00:00Z', group: 'H' },
  // ── Group I: Netherlands · Uruguay · Iraq · Bolivia
  { home: 'Netherlands',   away: 'Uruguay',            date: '2026-06-16T17:00:00Z', group: 'I' },
  { home: 'Iraq',          away: 'Bolivia',            date: '2026-06-16T20:00:00Z', group: 'I' },
  { home: 'Netherlands',   away: 'Iraq',               date: '2026-06-21T17:00:00Z', group: 'I' },
  { home: 'Uruguay',       away: 'Bolivia',            date: '2026-06-21T20:00:00Z', group: 'I' },
  { home: 'Netherlands',   away: 'Bolivia',            date: '2026-06-30T00:00:00Z', group: 'I' },
  { home: 'Uruguay',       away: 'Iraq',               date: '2026-06-30T00:00:00Z', group: 'I' },
  // ── Group J: Belgium · Italy · Egypt · Indonesia
  { home: 'Belgium',       away: 'Italy',              date: '2026-06-16T23:00:00Z', group: 'J' },
  { home: 'Egypt',         away: 'Indonesia',          date: '2026-06-17T17:00:00Z', group: 'J' },
  { home: 'Belgium',       away: 'Egypt',              date: '2026-06-22T17:00:00Z', group: 'J' },
  { home: 'Italy',         away: 'Indonesia',          date: '2026-06-22T20:00:00Z', group: 'J' },
  { home: 'Belgium',       away: 'Indonesia',          date: '2026-06-30T03:00:00Z', group: 'J' },
  { home: 'Italy',         away: 'Egypt',              date: '2026-06-30T03:00:00Z', group: 'J' },
  // ── Group K: Turkey · South Korea · Nigeria · Honduras
  { home: 'Turkey',        away: 'South Korea',        date: '2026-06-15T17:00:00Z', group: 'K' },
  { home: 'Nigeria',       away: 'Honduras',           date: '2026-06-15T20:00:00Z', group: 'K' },
  { home: 'Turkey',        away: 'Nigeria',            date: '2026-06-20T17:00:00Z', group: 'K' },
  { home: 'South Korea',   away: 'Honduras',           date: '2026-06-20T20:00:00Z', group: 'K' },
  { home: 'Turkey',        away: 'Honduras',           date: '2026-07-01T00:00:00Z', group: 'K' },
  { home: 'South Korea',   away: 'Nigeria',            date: '2026-07-01T00:00:00Z', group: 'K' },
  // ── Group L: Switzerland · Norway · DR Congo · Paraguay
  { home: 'Switzerland',   away: 'Norway',             date: '2026-06-13T23:00:00Z', group: 'L' },
  { home: 'DR Congo',      away: 'Paraguay',           date: '2026-06-13T17:00:00Z', group: 'L' },
  { home: 'Switzerland',   away: 'DR Congo',           date: '2026-06-18T23:00:00Z', group: 'L' },
  { home: 'Norway',        away: 'Paraguay',           date: '2026-06-18T20:00:00Z', group: 'L' },
  { home: 'Switzerland',   away: 'Paraguay',           date: '2026-07-01T03:00:00Z', group: 'L' },
  { home: 'Norway',        away: 'DR Congo',           date: '2026-07-01T03:00:00Z', group: 'L' },
];

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── 1. Try to enrich datetimes from The Odds API ──────────────────────────
    let apiConfirmed = 0;
    const oddsMap = new Map<string, string>(); // matchKey → commence_time

    try {
      const oddsResp = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`,
        { headers: { Accept: 'application/json' } }
      );
      if (oddsResp.ok) {
        const events = await oddsResp.json();
        if (Array.isArray(events)) {
          for (const e of events) {
            oddsMap.set(matchKey(e.home_team, e.away_team), e.commence_time);
          }
        }
      }
    } catch {
      // Odds API unavailable — use hardcoded dates for all fixtures
    }

    // ── 2. Build rows (72 fixtures, Odds API datetime where available) ─────────
    const toInsert = FIXTURES.map((f) => {
      const key     = matchKey(f.home, f.away);
      const apiDate = oddsMap.get(key);
      if (apiDate) apiConfirmed++;

      return {
        home_team:      f.home,
        away_team:      f.away,
        home_flag:      TEAMS[f.home]?.flag ?? null,
        away_flag:      TEAMS[f.away]?.flag ?? null,
        stage:          'group' as const,
        group_label:    f.group,
        match_datetime: apiDate ?? f.date,
        status:         'upcoming' as const,
      };
    });

    // ── 3. Delete existing group + friendly matches (and their pronostics) ─────
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .in('stage', ['group', 'friendly']);

    const existingIds = (existing ?? []).map((m) => m.id);

    if (existingIds.length > 0) {
      await supabase.from('pronostics').delete().in('match_id', existingIds);
      await supabase.from('matches').delete().in('id', existingIds);
    }

    // ── 4. Insert ─────────────────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('matches').insert(toInsert);
    if (insertError) throw new Error(insertError.message);

    return new Response(
      JSON.stringify({
        success:       true,
        inserted:      toInsert.length,
        api_confirmed: apiConfirmed,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
