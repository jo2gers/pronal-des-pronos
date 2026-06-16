import type { RequestHandler } from './$types';

// Same-origin flag proxy. Flags used to be loaded straight from flagcdn.com, but
// some users' networks / DNS / content blockers (AdGuard, NextDNS, ISP filters…)
// block that third-party domain, leaving empty flag boxes. Serving the image from
// our OWN origin — which the user can obviously reach since they're on the app —
// sidesteps all client-side blocking. The upstream fetch happens server-side and
// the response is cached hard at the edge (flags never change).

const WIDTHS = new Set([20, 40, 80, 160, 320]);
// flagcdn codes: 2-letter ISO, optionally a subdivision (e.g. gb-sct, gb-eng).
const CODE_RE = /^[a-z]{2}(-[a-z]{2,4})?$/;

export const GET: RequestHandler = async ({ params, url }) => {
	const code = (params.code ?? '').toLowerCase();
	if (!CODE_RE.test(code)) return new Response(null, { status: 404 });

	const wParam = Number(url.searchParams.get('w'));
	const w = WIDTHS.has(wParam) ? wParam : 80;

	let upstream: Response;
	try {
		upstream = await fetch(`https://flagcdn.com/w${w}/${code}.png`);
	} catch {
		return new Response(null, { status: 502 });
	}
	if (!upstream.ok) return new Response(null, { status: upstream.status });

	const body = await upstream.arrayBuffer();
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': upstream.headers.get('content-type') ?? 'image/png',
			// Immutable: a country's flag for a given size never changes. Cache long
			// in the browser and at Vercel's edge so the function runs ~once per flag.
			'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable'
		}
	});
};
