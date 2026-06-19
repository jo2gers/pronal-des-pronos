import type { SupabaseClient } from '@supabase/supabase-js';

// Fetch ALL scored pronostics, paginating past PostgREST's 1000-row response cap.
// We've crossed 1000 scored picks tournament-wide, so a plain
// `.select(...).eq('is_scored', true)` silently returns only the first 1000 rows
// — which under-counts every user whose picks fall in the dropped tail (their
// leaderboard total / rank / snapshot come out far too low). We page through in
// 1000-row chunks with a stable order so nothing is skipped or double-counted.
export async function fetchAllScoredPronostics<T = Record<string, unknown>>(
	supabase: SupabaseClient,
	columns: string
): Promise<T[]> {
	const PAGE = 1000;
	const all: T[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await supabase
			.from('pronostics')
			.select(columns)
			.eq('is_scored', true)
			.order('id', { ascending: true }) // stable order → pages don't overlap/skip
			.range(from, from + PAGE - 1);
		if (error || !data || data.length === 0) break;
		all.push(...(data as T[]));
		if (data.length < PAGE) break;
	}
	return all;
}
