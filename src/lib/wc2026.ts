// Real 2026 FIFA World Cup groups — official draw
export const WC2026_TEAMS = [
	// Group A
	{ name: 'Mexico', flag: 'MX', group: 'A' },
	{ name: 'South Africa', flag: 'ZA', group: 'A' },
	{ name: 'South Korea', flag: 'KR', group: 'A' },
	{ name: 'Czech Republic', flag: 'CZ', group: 'A' },
	// Group B
	{ name: 'Canada', flag: 'CA', group: 'B' },
	{ name: 'Bosnia and Herzegovina', flag: 'BA', group: 'B' },
	{ name: 'Qatar', flag: 'QA', group: 'B' },
	{ name: 'Switzerland', flag: 'CH', group: 'B' },
	// Group C
	{ name: 'USA', flag: 'US', group: 'C' },
	{ name: 'Paraguay', flag: 'PY', group: 'C' },
	{ name: 'Australia', flag: 'AU', group: 'C' },
	{ name: 'Turkey', flag: 'TR', group: 'C' },
	// Group D
	{ name: 'Brazil', flag: 'BR', group: 'D' },
	{ name: 'Morocco', flag: 'MA', group: 'D' },
	{ name: 'Haiti', flag: 'HT', group: 'D' },
	{ name: 'Scotland', flag: 'GB-SCT', group: 'D' },
	// Group E
	{ name: 'Germany', flag: 'DE', group: 'E' },
	{ name: 'Curaçao', flag: 'CW', group: 'E' },
	{ name: 'Ecuador', flag: 'EC', group: 'E' },
	{ name: 'Ivory Coast', flag: 'CI', group: 'E' },
	// Group F
	{ name: 'Netherlands', flag: 'NL', group: 'F' },
	{ name: 'Japan', flag: 'JP', group: 'F' },
	{ name: 'Sweden', flag: 'SE', group: 'F' },
	{ name: 'Tunisia', flag: 'TN', group: 'F' },
	// Group G
	{ name: 'Spain', flag: 'ES', group: 'G' },
	{ name: 'Cape Verde', flag: 'CV', group: 'G' },
	{ name: 'Saudi Arabia', flag: 'SA', group: 'G' },
	{ name: 'Uruguay', flag: 'UY', group: 'G' },
	// Group H
	{ name: 'Belgium', flag: 'BE', group: 'H' },
	{ name: 'Egypt', flag: 'EG', group: 'H' },
	{ name: 'Iran', flag: 'IR', group: 'H' },
	{ name: 'New Zealand', flag: 'NZ', group: 'H' },
	// Group I
	{ name: 'France', flag: 'FR', group: 'I' },
	{ name: 'Senegal', flag: 'SN', group: 'I' },
	{ name: 'Iraq', flag: 'IQ', group: 'I' },
	{ name: 'Norway', flag: 'NO', group: 'I' },
	// Group J
	{ name: 'Argentina', flag: 'AR', group: 'J' },
	{ name: 'Algeria', flag: 'DZ', group: 'J' },
	{ name: 'Austria', flag: 'AT', group: 'J' },
	{ name: 'Jordan', flag: 'JO', group: 'J' },
	// Group K
	{ name: 'England', flag: 'GB-ENG', group: 'K' },
	{ name: 'Croatia', flag: 'HR', group: 'K' },
	{ name: 'Ghana', flag: 'GH', group: 'K' },
	{ name: 'Panama', flag: 'PA', group: 'K' },
	// Group L
	{ name: 'Portugal', flag: 'PT', group: 'L' },
	{ name: 'Uzbekistan', flag: 'UZ', group: 'L' },
	{ name: 'Colombia', flag: 'CO', group: 'L' },
	{ name: 'DR Congo', flag: 'CD', group: 'L' },
] as const;

export const STAGE_LABELS_FR: Record<string, string> = {
	group: 'Phase de groupes',
	round_of_32: 'Huitièmes de finale',
	round_of_16: 'Seizièmes de finale',
	quarters: 'Quarts de finale',
	semis: 'Demi-finales',
	third: 'Match pour la 3ème place',
	final: 'Finale'
};

export const STAGE_LABELS_EN: Record<string, string> = {
	group: 'Group stage',
	round_of_32: 'Round of 32',
	round_of_16: 'Round of 16',
	quarters: 'Quarter-finals',
	semis: 'Semi-finals',
	third: 'Third place match',
	final: 'Final'
};

// kept for any callers that haven't migrated yet
export const STAGE_LABELS = STAGE_LABELS_FR;

export const COUNTRIES = [
	'Afrique du Sud', 'Algérie', 'Allemagne', 'Angleterre', 'Arabie Saoudite', 'Argentine',
	'Australie', 'Autriche', 'Belgique', 'Bosnie-Herzégovine', 'Brésil',
	'Canada', 'Cap-Vert', 'Colombie', 'Congo RD', 'Corée du Sud', 'Côte d\'Ivoire',
	'Croatie', 'Curaçao', 'Ecosse', 'Egypte', 'Equateur', 'Espagne', 'Etats-Unis',
	'France', 'Ghana', 'Haïti', 'Irak', 'Iran', 'Japon', 'Jordanie',
	'Maroc', 'Maurice', 'Mexique', 'Norvège', 'Nouvelle-Zélande',
	'Ouzbékistan', 'Panama', 'Paraguay', 'Pays-Bas', 'Portugal',
	'Qatar', 'République tchèque', 'Sénégal', 'Suède', 'Suisse',
	'Tunisie', 'Turquie', 'Uruguay', 'Autre'
].sort();
