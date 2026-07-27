import { error } from '@sveltejs/kit';
import { CURRENT_COMP_COOKIE } from '$lib/server/currentComp';
import type { LayoutServerLoad } from './$types';

// Every V2 page lives under /<competition-slug>/… — resolve the competition
// once here; children read data.competition. There is no cross-competition
// switcher anymore (you commit to one competition from the home chooser), so we
// only need the one competition this URL names.
export const load: LayoutServerLoad = async ({ params, cookies, locals: { supabase } }) => {
	const { data: competition } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en, format, active, starts_at')
		.eq('slug', params.comp)
		.maybeSingle();

	if (!competition) error(404, 'Compétition inconnue');

	// Remember the game you're in. The GLOBAL pages (profile, leagues) read this
	// cookie so they show THIS competition — PL and UCL stay two separate games,
	// never mixed, and the finished WC archive never leaks into the current view.
	if (competition.active) {
		cookies.set(CURRENT_COMP_COOKIE, competition.slug, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 180
		});
	}

	return { competition };
};
