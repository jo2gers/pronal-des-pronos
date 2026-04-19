import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const GET: RequestHandler = async () => {
	try {
		const resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-odds`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
				'Content-Type': 'application/json'
			}
		});

		const data = await resp.json();
		return json(data);
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
