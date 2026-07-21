import type { ParamMatcher } from '@sveltejs/kit';

// Competition URL segment = competitions.slug ('pl-2026-27', 'ucl-2026-27').
// Static routes (/matches, /leaderboard…) always win over this dynamic
// segment, so the archive routes are unaffected.
export const match: ParamMatcher = (param) => /^[a-z0-9][a-z0-9-]*$/.test(param);
