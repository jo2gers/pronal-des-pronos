import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Every V2 page lives under /<competition-slug>/… — resolve the competition
// once here; children read data.competition.
export const load: LayoutServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: competition } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en, format, active')
		.eq('slug', params.comp)
		.maybeSingle();

	if (!competition) error(404, 'Compétition inconnue');
	return { competition };
};
