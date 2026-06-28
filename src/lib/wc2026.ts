// Real 2026 FIFA World Cup groups — official draw.
// `name` is the canonical English string that's stored in the DB (matches.home_team,
// matches.away_team, profiles.favorite_team). `nameFr` is the French display label.
// Always render team labels via teamLabel() below, never `team.name` directly.
export const WC2026_TEAMS = [
	// Group A
	{ name: 'Mexico',                 nameFr: 'Mexique',              flag: 'MX',     group: 'A' },
	{ name: 'South Africa',           nameFr: 'Afrique du Sud',       flag: 'ZA',     group: 'A' },
	{ name: 'South Korea',            nameFr: 'Corée du Sud',         flag: 'KR',     group: 'A' },
	{ name: 'Czech Republic',         nameFr: 'République tchèque',   flag: 'CZ',     group: 'A' },
	// Group B
	{ name: 'Canada',                 nameFr: 'Canada',               flag: 'CA',     group: 'B' },
	{ name: 'Bosnia and Herzegovina', nameFr: 'Bosnie-Herzégovine',   flag: 'BA',     group: 'B' },
	{ name: 'Qatar',                  nameFr: 'Qatar',                flag: 'QA',     group: 'B' },
	{ name: 'Switzerland',            nameFr: 'Suisse',               flag: 'CH',     group: 'B' },
	// Group C
	{ name: 'USA',                    nameFr: 'États-Unis',           flag: 'US',     group: 'C' },
	{ name: 'Paraguay',               nameFr: 'Paraguay',             flag: 'PY',     group: 'C' },
	{ name: 'Australia',              nameFr: 'Australie',            flag: 'AU',     group: 'C' },
	{ name: 'Turkey',                 nameFr: 'Turquie',              flag: 'TR',     group: 'C' },
	// Group D
	{ name: 'Brazil',                 nameFr: 'Brésil',               flag: 'BR',     group: 'D' },
	{ name: 'Morocco',                nameFr: 'Maroc',                flag: 'MA',     group: 'D' },
	{ name: 'Haiti',                  nameFr: 'Haïti',                flag: 'HT',     group: 'D' },
	{ name: 'Scotland',               nameFr: 'Écosse',               flag: 'GB-SCT', group: 'D' },
	// Group E
	{ name: 'Germany',                nameFr: 'Allemagne',            flag: 'DE',     group: 'E' },
	{ name: 'Curaçao',                nameFr: 'Curaçao',              flag: 'CW',     group: 'E' },
	{ name: 'Ecuador',                nameFr: 'Équateur',             flag: 'EC',     group: 'E' },
	{ name: 'Ivory Coast',            nameFr: "Côte d'Ivoire",        flag: 'CI',     group: 'E' },
	// Group F
	{ name: 'Netherlands',            nameFr: 'Pays-Bas',             flag: 'NL',     group: 'F' },
	{ name: 'Japan',                  nameFr: 'Japon',                flag: 'JP',     group: 'F' },
	{ name: 'Sweden',                 nameFr: 'Suède',                flag: 'SE',     group: 'F' },
	{ name: 'Tunisia',                nameFr: 'Tunisie',              flag: 'TN',     group: 'F' },
	// Group G
	{ name: 'Spain',                  nameFr: 'Espagne',              flag: 'ES',     group: 'G' },
	{ name: 'Cape Verde',             nameFr: 'Cap-Vert',             flag: 'CV',     group: 'G' },
	{ name: 'Saudi Arabia',           nameFr: 'Arabie saoudite',      flag: 'SA',     group: 'G' },
	{ name: 'Uruguay',                nameFr: 'Uruguay',              flag: 'UY',     group: 'G' },
	// Group H
	{ name: 'Belgium',                nameFr: 'Belgique',             flag: 'BE',     group: 'H' },
	{ name: 'Egypt',                  nameFr: 'Égypte',               flag: 'EG',     group: 'H' },
	{ name: 'Iran',                   nameFr: 'Iran',                 flag: 'IR',     group: 'H' },
	{ name: 'New Zealand',            nameFr: 'Nouvelle-Zélande',     flag: 'NZ',     group: 'H' },
	// Group I
	{ name: 'France',                 nameFr: 'France',               flag: 'FR',     group: 'I' },
	{ name: 'Senegal',                nameFr: 'Sénégal',              flag: 'SN',     group: 'I' },
	{ name: 'Iraq',                   nameFr: 'Irak',                 flag: 'IQ',     group: 'I' },
	{ name: 'Norway',                 nameFr: 'Norvège',              flag: 'NO',     group: 'I' },
	// Group J
	{ name: 'Argentina',              nameFr: 'Argentine',            flag: 'AR',     group: 'J' },
	{ name: 'Algeria',                nameFr: 'Algérie',              flag: 'DZ',     group: 'J' },
	{ name: 'Austria',                nameFr: 'Autriche',             flag: 'AT',     group: 'J' },
	{ name: 'Jordan',                 nameFr: 'Jordanie',             flag: 'JO',     group: 'J' },
	// Group K
	{ name: 'England',                nameFr: 'Angleterre',           flag: 'GB-ENG', group: 'K' },
	{ name: 'Croatia',                nameFr: 'Croatie',              flag: 'HR',     group: 'K' },
	{ name: 'Ghana',                  nameFr: 'Ghana',                flag: 'GH',     group: 'K' },
	{ name: 'Panama',                 nameFr: 'Panama',               flag: 'PA',     group: 'K' },
	// Group L
	{ name: 'Portugal',               nameFr: 'Portugal',             flag: 'PT',     group: 'L' },
	{ name: 'Uzbekistan',             nameFr: 'Ouzbékistan',          flag: 'UZ',     group: 'L' },
	{ name: 'Colombia',               nameFr: 'Colombie',             flag: 'CO',     group: 'L' },
	{ name: 'DR Congo',               nameFr: 'Congo RD',             flag: 'CD',     group: 'L' },
] as const;

// Fast English → French lookup for team labels.
const TEAM_NAME_FR: Record<string, string> = Object.fromEntries(
	WC2026_TEAMS.map((t) => [t.name, t.nameFr])
);

import { getLang } from './i18n.svelte';

// Localised display label for a team. Reads getLang() so it stays reactive
// when called from a Svelte template. Unknown team strings (e.g., "TBD",
// stage placeholders, future teams) fall through unchanged.
export function teamLabel(name: string | null | undefined): string {
	if (!name) return '';
	if (getLang() === 'en') return name;
	return TEAM_NAME_FR[name] ?? name;
}

export const STAGE_LABELS_FR: Record<string, string> = {
	group: 'Groupes',
	// 32 teams / 16 matches = seizièmes; 16 teams / 8 matches = huitièmes
	round_of_32: 'Seizièmes de finale',
	round_of_16: 'Huitièmes de finale',
	quarters: 'Quarts de finale',
	semis: 'Demi-finales',
	third: 'Match pour la 3ème place',
	final: 'Finale'
};

export const STAGE_LABELS_EN: Record<string, string> = {
	group: 'Groups',
	round_of_32: 'Round of 32',
	round_of_16: 'Round of 16',
	quarters: 'Quarter-finals',
	semis: 'Semi-finals',
	third: 'Third place match',
	final: 'Final'
};

// Country list for the profile "where are you from" picker. The `value` field
// is stored in profiles.country (kept as French for backward compatibility with
// existing rows); `fr` and `en` are the localised display labels.
export const COUNTRIES: { value: string; fr: string; en: string }[] = [
	{ value: 'Afrique du Sud',      fr: 'Afrique du Sud',      en: 'South Africa' },
	{ value: 'Algérie',             fr: 'Algérie',             en: 'Algeria' },
	{ value: 'Allemagne',           fr: 'Allemagne',           en: 'Germany' },
	{ value: 'Angleterre',          fr: 'Angleterre',          en: 'England' },
	{ value: 'Arabie Saoudite',     fr: 'Arabie Saoudite',     en: 'Saudi Arabia' },
	{ value: 'Argentine',           fr: 'Argentine',           en: 'Argentina' },
	{ value: 'Australie',           fr: 'Australie',           en: 'Australia' },
	{ value: 'Autriche',            fr: 'Autriche',            en: 'Austria' },
	{ value: 'Belgique',            fr: 'Belgique',            en: 'Belgium' },
	{ value: 'Bosnie-Herzégovine',  fr: 'Bosnie-Herzégovine',  en: 'Bosnia & Herzegovina' },
	{ value: 'Brésil',              fr: 'Brésil',              en: 'Brazil' },
	{ value: 'Canada',              fr: 'Canada',              en: 'Canada' },
	{ value: 'Cap-Vert',            fr: 'Cap-Vert',            en: 'Cape Verde' },
	{ value: 'Colombie',            fr: 'Colombie',            en: 'Colombia' },
	{ value: 'Congo RD',            fr: 'Congo RD',            en: 'DR Congo' },
	{ value: 'Corée du Sud',        fr: 'Corée du Sud',        en: 'South Korea' },
	{ value: "Côte d'Ivoire",       fr: "Côte d'Ivoire",       en: 'Ivory Coast' },
	{ value: 'Croatie',             fr: 'Croatie',             en: 'Croatia' },
	{ value: 'Curaçao',             fr: 'Curaçao',             en: 'Curaçao' },
	{ value: 'Ecosse',              fr: 'Ecosse',              en: 'Scotland' },
	{ value: 'Egypte',              fr: 'Egypte',              en: 'Egypt' },
	{ value: 'Equateur',            fr: 'Equateur',            en: 'Ecuador' },
	{ value: 'Espagne',             fr: 'Espagne',             en: 'Spain' },
	{ value: 'Etats-Unis',          fr: 'Etats-Unis',          en: 'United States' },
	{ value: 'France',              fr: 'France',              en: 'France' },
	{ value: 'Ghana',               fr: 'Ghana',               en: 'Ghana' },
	{ value: 'Haïti',               fr: 'Haïti',               en: 'Haiti' },
	{ value: 'Irak',                fr: 'Irak',                en: 'Iraq' },
	{ value: 'Iran',                fr: 'Iran',                en: 'Iran' },
	{ value: 'Japon',               fr: 'Japon',               en: 'Japan' },
	{ value: 'Jordanie',            fr: 'Jordanie',            en: 'Jordan' },
	{ value: 'Maroc',               fr: 'Maroc',               en: 'Morocco' },
	{ value: 'Maurice',             fr: 'Maurice',             en: 'Mauritius' },
	{ value: 'Mexique',             fr: 'Mexique',             en: 'Mexico' },
	{ value: 'Norvège',             fr: 'Norvège',             en: 'Norway' },
	{ value: 'Nouvelle-Zélande',    fr: 'Nouvelle-Zélande',    en: 'New Zealand' },
	{ value: 'Ouzbékistan',         fr: 'Ouzbékistan',         en: 'Uzbekistan' },
	{ value: 'Panama',              fr: 'Panama',              en: 'Panama' },
	{ value: 'Paraguay',            fr: 'Paraguay',            en: 'Paraguay' },
	{ value: 'Pays-Bas',            fr: 'Pays-Bas',            en: 'Netherlands' },
	{ value: 'Portugal',            fr: 'Portugal',            en: 'Portugal' },
	{ value: 'Qatar',               fr: 'Qatar',               en: 'Qatar' },
	{ value: 'République tchèque',  fr: 'République tchèque',  en: 'Czech Republic' },
	{ value: 'Sénégal',             fr: 'Sénégal',             en: 'Senegal' },
	{ value: 'Suède',               fr: 'Suède',               en: 'Sweden' },
	{ value: 'Suisse',              fr: 'Suisse',              en: 'Switzerland' },
	{ value: 'Tunisie',             fr: 'Tunisie',             en: 'Tunisia' },
	{ value: 'Turquie',             fr: 'Turquie',             en: 'Turkey' },
	{ value: 'Uruguay',             fr: 'Uruguay',             en: 'Uruguay' },
	{ value: 'Autre',               fr: 'Autre',               en: 'Other' }
];
