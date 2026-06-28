// Knockout-bracket helpers: human labels for the slot_code tree.
//
// The DB stores each knockout slot's source as a token (see migrations 032/034):
//   W_E / R_A / 3_C  → winner / runner-up / 3rd of a GROUP (feeds the R32)
//   W_R32-1 / L_SF-1 → winner / loser of an earlier SLOT (feeds R16 → Final)
// Until a slot is decided its teams are 'TBD'; we turn the source tokens into a
// readable line ("Winner R16·3", "3rd Grp C") so an undecided round still reads
// like a real fixture sheet instead of "TBD vs TBD".

import { getLang } from '$lib/i18n.svelte';

export const KNOCKOUT_ROUNDS = [
	'round_of_32',
	'round_of_16',
	'quarters',
	'semis',
	'third',
	'final'
] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

// Compact stepper label (mobile). Desktop uses the full STAGE_LABELS.
const SHORT: Record<string, string> = {
	round_of_32: 'R32',
	round_of_16: 'R16',
	quarters: '¼',
	semis: '½',
	third: '3e',
	final: 'F'
};
export function roundShort(stage: string): string {
	return SHORT[stage] ?? stage;
}

function stageOfSlot(slot: string): string {
	if (slot.startsWith('R32')) return 'round_of_32';
	if (slot.startsWith('R16')) return 'round_of_16';
	if (slot.startsWith('QF')) return 'quarters';
	if (slot.startsWith('SF')) return 'semis';
	if (slot === 'THIRD') return 'third';
	if (slot === 'FINAL') return 'final';
	return '';
}

// "R32-3" → "R32·3" ; "FINAL" → "F"
function slotGlyph(slot: string): string {
	const short = SHORT[stageOfSlot(slot)] ?? slot;
	const idx = (slot.match(/\d+/) ?? [''])[0];
	return idx ? `${short}·${idx}` : short;
}

// Human label for a TBD source token, localised.
export function sourceLabel(token: string | null | undefined): string {
	const fr = getLang() === 'fr';
	if (!token) return fr ? 'À déterminer' : 'TBD';
	let m: RegExpMatchArray | null;
	if ((m = token.match(/^W_([A-L])$/))) return fr ? `1er Gr. ${m[1]}` : `Winner Grp ${m[1]}`;
	if ((m = token.match(/^R_([A-L])$/))) return fr ? `2e Gr. ${m[1]}` : `Runner-up Grp ${m[1]}`;
	if ((m = token.match(/^3_([A-L])$/))) return fr ? `3e Gr. ${m[1]}` : `3rd Grp ${m[1]}`;
	if ((m = token.match(/^W_(.+)$/))) return fr ? `Vainqueur ${slotGlyph(m[1])}` : `Winner ${slotGlyph(m[1])}`;
	if ((m = token.match(/^L_(.+)$/))) return fr ? `Perdant ${slotGlyph(m[1])}` : `Loser ${slotGlyph(m[1])}`;
	return fr ? 'À déterminer' : 'TBD';
}

// Forward cue: where this slot's WINNER advances. Returns a short glyph
// ("¼·2", "Finale") or null for the slots that end a path (3rd place, final).
export function feedsIntoLabel(slot: string): string | null {
	const fr = getLang() === 'fr';
	const idx = parseInt((slot.match(/\d+/) ?? ['0'])[0], 10);
	if (slot.startsWith('R32')) return `${SHORT.round_of_16}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('R16')) return `${SHORT.quarters}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('QF')) return `${SHORT.semis}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('SF')) return fr ? 'Finale' : 'Final';
	return null;
}
