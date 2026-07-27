// One-shot fixture ingestion for a V2 competition, run from the repo root:
//
//   node --experimental-strip-types scripts/sync-fixtures.mjs pl-2026-27 2026-08-01 2027-06-02
//
// Reads the service-role key from .env (never committed). Idempotent — safe to
// re-run any time (reschedules update in place; live/finished rows untouched).
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { syncCompetitionFixtures } from '../src/lib/server/fixtures.ts';

const [slug, from, to] = process.argv.slice(2);
if (!slug || !from || !to) {
	console.error('usage: node --experimental-strip-types scripts/sync-fixtures.mjs <competition-slug> <from ISO date> <to ISO date>');
	process.exit(1);
}

const env = Object.fromEntries(
	fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
		.split(/\r?\n/)
		.filter((l) => l.includes('=') && !l.trim().startsWith('#'))
		.map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
);

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const result = await syncCompetitionFixtures(supabase, slug, { from, to });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
