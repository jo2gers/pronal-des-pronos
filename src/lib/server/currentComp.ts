import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';

// The "current game" the visitor is in. Set by the /[comp] layout when you enter
// a competition; read by the GLOBAL pages (profile, leagues) so PL and UCL stay
// two separate games and never mix, and the finished WC archive never leaks into
// the current view.
export const CURRENT_COMP_COOKIE = 'tifo_comp';

export type CurrentComp = {
	id: string;
	slug: string;
	name_fr: string;
	name_en: string;
	format: string;
	active: boolean;
	starts_at: string | null;
};

// Resolve the competition the visitor is currently playing: an explicit
// `override` slug (from a `?comp=` game-switcher link, persisted to the cookie)
// wins; else the cookie's slug; else the earliest-starting active competition
// (Premier League this season). Also returns the full active list so a global
// page can offer a game switcher. Never returns the WC archive (inactive).
export async function resolveCurrentComp(
	supabase: SupabaseClient,
	cookies: Cookies,
	override?: string | null
): Promise<{ current: CurrentComp | null; active: CurrentComp[] }> {
	const { data } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en, format, active, starts_at')
		.eq('active', true)
		.order('starts_at', { ascending: true, nullsFirst: false });

	const active = (data ?? []) as CurrentComp[];

	const overrideOk = override && active.some((c) => c.slug === override);
	if (overrideOk) {
		cookies.set(CURRENT_COMP_COOKIE, override!, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 180
		});
	}
	const wanted = overrideOk ? override : cookies.get(CURRENT_COMP_COOKIE);
	const current = active.find((c) => c.slug === wanted) ?? active[0] ?? null;
	return { current, active };
}
