import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Every V2 page lives under /<competition-slug>/… — resolve the competition
// once here; children read data.competition. `activeCompetitions` feeds the
// switcher in the V2 sub-nav (PL ⇄ UCL).
export const load: LayoutServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: competitions } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en, format, active, starts_at')
		.or(`active.eq.true,slug.eq.${params.comp}`);

	const competition = (competitions ?? []).find((c) => c.slug === params.comp);
	if (!competition) error(404, 'Compétition inconnue');

	return {
		competition,
		activeCompetitions: (competitions ?? []).filter((c) => c.active)
	};
};
