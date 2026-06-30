// Knockout-bracket helpers: human labels for the slot_code tree.
//
// The DB stores each knockout slot's source as a token (see migrations 032/034):
//   W_E / R_A / 3_C  → winner / runner-up / 3rd of a GROUP (feeds the R32)
//   W_R32-1 / L_SF-1 → winner / loser of an earlier SLOT (feeds R16 → Final)
// Until a slot is decided its teams are 'TBD'; we turn the source tokens into a
// readable line ("Winner R16·3", "3rd Grp C") so an undecided round still reads
// like a real fixture sheet instead of "TBD vs TBD".

import { getLang } from '$lib/i18n.svelte';
import { knockoutOutcome } from '$lib/utils';

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

// "R32-3" → "R32·3" ; "FINAL" → "F". Take the digits AFTER the hyphen — the slot
// index — NOT the first digits (which would grab "32" out of the "R32" prefix).
function slotGlyph(slot: string): string {
	const short = SHORT[stageOfSlot(slot)] ?? slot;
	const idx = (slot.match(/-(\d+)/) ?? ['', ''])[1];
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

// A team known to have advanced into / dropped out of a slot, with its flag.
export type SlotTeam = { team: string; flag: string | null };
type SlotResults = { win: Map<string, SlotTeam>; lose: Map<string, SlotTeam> };

type SlotMatch = {
	slot_code: string;
	status: string;
	home_team: string;
	away_team: string;
	home_flag: string | null;
	away_flag: string | null;
	home_score: number | null;
	away_score: number | null;
	ft_home_score?: number | null;
	ft_away_score?: number | null;
	pen_home?: number | null;
	pen_away?: number | null;
};

// Index every DECIDED knockout match by its slot, so a downstream TBD slot can show
// the qualified team flowing forward ("Paraguay") instead of a "Winner R32·3" label.
// Winner uses the effective result (pens > extra time > 90'), matching slot_winner().
export function buildSlotResults(rounds: { matches: SlotMatch[] }[]): SlotResults {
	const win = new Map<string, SlotTeam>();
	const lose = new Map<string, SlotTeam>();
	for (const r of rounds) {
		for (const m of r.matches) {
			if (m.status !== 'finished' || m.home_team === 'TBD' || m.away_team === 'TBD') continue;
			const o = knockoutOutcome(m);
			const homeWon = o ? o.winner === 'home' : (m.home_score ?? 0) > (m.away_score ?? 0);
			const home: SlotTeam = { team: m.home_team, flag: m.home_flag };
			const away: SlotTeam = { team: m.away_team, flag: m.away_flag };
			win.set(m.slot_code, homeWon ? home : away);
			lose.set(m.slot_code, homeWon ? away : home);
		}
	}
	return { win, lose };
}

// Resolve a TBD source token (W_R32-3 / L_SF-1) to the team that filled it, once its
// feeder match is decided. Group tokens (W_E, R_A, 3_C) never match a slot → null.
export function resolveSourceTeam(
	token: string | null | undefined,
	results: SlotResults
): SlotTeam | null {
	if (!token) return null;
	let m: RegExpMatchArray | null;
	if ((m = token.match(/^W_(.+)$/)) && results.win.has(m[1])) return results.win.get(m[1]) ?? null;
	if ((m = token.match(/^L_(.+)$/)) && results.lose.has(m[1])) return results.lose.get(m[1]) ?? null;
	return null;
}

// Forward cue: where this slot's WINNER advances. Returns a short glyph
// ("¼·2", "Finale") or null for the slots that end a path (3rd place, final).
export function feedsIntoLabel(slot: string): string | null {
	const fr = getLang() === 'fr';
	const idx = parseInt((slot.match(/-(\d+)/) ?? ['', '0'])[1], 10);
	if (slot.startsWith('R32')) return `${SHORT.round_of_16}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('R16')) return `${SHORT.quarters}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('QF')) return `${SHORT.semis}·${Math.ceil(idx / 2)}`;
	if (slot.startsWith('SF')) return fr ? 'Finale' : 'Final';
	return null;
}
