import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter(),
		// Poll for a newer deploy every 60s. When one is found, $app/state's
		// `updated` flips true and the layout reloads — so an installed PWA
		// holding a stale/half-updated cache self-heals instead of staying broken.
		version: { pollInterval: 60_000 }
	}
};

export default config;
