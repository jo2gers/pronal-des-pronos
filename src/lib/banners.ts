// Predefined site-banner messages. The admin picks one of these (or none) from
// /admin; the layout renders it via the i18n key so every user sees it in their
// own language (FR/EN) — no free-text, always translated.
//
// `i18n` must match a key in src/lib/i18n.svelte.ts (both FR and EN).
// `adminLabel` is the short French label shown in the admin picker (admin is
// intentionally French-only).

export type BannerTone = 'info' | 'warn';

export const BANNER_OPTIONS = [
	{
		id: 'knockout_90min',
		i18n: 'banner_knockout_90min',
		tone: 'info',
		adminLabel: 'Phase finale · règle des 90 minutes'
	},
	{
		id: 'maintenance',
		i18n: 'banner_maintenance',
		tone: 'warn',
		adminLabel: 'Maintenance / bug en cours'
	},
	{
		id: 'thanks',
		i18n: 'banner_thanks',
		tone: 'info',
		adminLabel: 'Fin du tournoi · merci d\'avoir joué'
	}
] as const;

export type BannerId = (typeof BANNER_OPTIONS)[number]['id'];

export function bannerById(id: string | null | undefined) {
	return BANNER_OPTIONS.find((b) => b.id === id) ?? null;
}
