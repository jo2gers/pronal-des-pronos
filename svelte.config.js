import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter(),
		// Poll for new deploys so an open client learns it's out of date (sets the
		// `updated` store); +layout.svelte then forces a full reload on the next
		// navigation. Without this a client stranded across a deploy can render a
		// new page's data with its stale component → "home button broken after an
		// update".
		version: { pollInterval: 60_000 }
	}
};

export default config;
