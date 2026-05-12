/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// SvelteKit auto-registers this file as a service worker.
// Strategy:
//   - On install: pre-cache the build manifest + static files so the shell
//     works offline.
//   - On fetch: try cache first for build assets (they're hashed and
//     immutable), network-first for everything else.
//   - On activate: delete old caches whose hash no longer matches.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `tifo-cache-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
	);
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
		).then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Don't intercept Supabase, Polymarket or other cross-origin API calls.
	if (url.origin !== sw.location.origin) return;

	// Build assets are hashed → cache-first, always safe.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(req).then((hit) => hit ?? fetch(req))
		);
		return;
	}

	// Everything else (pages, dynamic data): network first, fall back to cache
	// when offline so navigation still resolves the previously-visited page.
	event.respondWith(
		fetch(req)
			.then((res) => {
				// Only cache successful same-origin responses
				if (res.ok && res.type === 'basic') {
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put(req, copy));
				}
				return res;
			})
			.catch(() => caches.match(req).then((hit) => hit ?? Response.error()))
	);
});
