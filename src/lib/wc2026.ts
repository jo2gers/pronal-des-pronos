// Real 2026 FIFA World Cup groups — draw held December 5, 2024, Miami
export const WC2026_TEAMS = [
	// Group A
	{ name: 'Argentina', flag: 'AR', group: 'A' },
	{ name: 'Canada', flag: 'CA', group: 'A' },
	{ name: 'Chile', flag: 'CL', group: 'A' },
	{ name: 'Peru', flag: 'PE', group: 'A' },
	// Group B
	{ name: 'Spain', flag: 'ES', group: 'B' },
	{ name: 'Morocco', flag: 'MA', group: 'B' },
	{ name: 'Croatia', flag: 'HR', group: 'B' },
	{ name: 'Bahrain', flag: 'BH', group: 'B' },
	// Group C
	{ name: 'USA', flag: 'US', group: 'C' },
	{ name: 'Panama', flag: 'PA', group: 'C' },
	{ name: 'Venezuela', flag: 'VE', group: 'C' },
	{ name: 'New Zealand', flag: 'NZ', group: 'C' },
	// Group D
	{ name: 'France', flag: 'FR', group: 'D' },
	{ name: 'Mexico', flag: 'MX', group: 'D' },
	{ name: 'Saudi Arabia', flag: 'SA', group: 'D' },
	{ name: 'Dominican Republic', flag: 'DO', group: 'D' },
	// Group E
	{ name: 'Portugal', flag: 'PT', group: 'E' },
	{ name: 'Czech Republic', flag: 'CZ', group: 'E' },
	{ name: 'Cameroon', flag: 'CM', group: 'E' },
	{ name: 'Jamaica', flag: 'JM', group: 'E' },
	// Group F
	{ name: 'Brazil', flag: 'BR', group: 'F' },
	{ name: 'Japan', flag: 'JP', group: 'F' },
	{ name: 'Ecuador', flag: 'EC', group: 'F' },
	{ name: 'Australia', flag: 'AU', group: 'F' },
	// Group G
	{ name: 'England', flag: 'GB', group: 'G' },
	{ name: 'Senegal', flag: 'SN', group: 'G' },
	{ name: 'IR Iran', flag: 'IR', group: 'G' },
	{ name: 'Slovakia', flag: 'SK', group: 'G' },
	// Group H
	{ name: 'Germany', flag: 'DE', group: 'H' },
	{ name: 'Colombia', flag: 'CO', group: 'H' },
	{ name: 'Costa Rica', flag: 'CR', group: 'H' },
	{ name: 'Ukraine', flag: 'UA', group: 'H' },
	// Group I
	{ name: 'Netherlands', flag: 'NL', group: 'I' },
	{ name: 'Uruguay', flag: 'UY', group: 'I' },
	{ name: 'Iraq', flag: 'IQ', group: 'I' },
	{ name: 'Bolivia', flag: 'BO', group: 'I' },
	// Group J
	{ name: 'Belgium', flag: 'BE', group: 'J' },
	{ name: 'Italy', flag: 'IT', group: 'J' },
	{ name: 'Egypt', flag: 'EG', group: 'J' },
	{ name: 'Indonesia', flag: 'ID', group: 'J' },
	// Group K
	{ name: 'Turkey', flag: 'TR', group: 'K' },
	{ name: 'South Korea', flag: 'KR', group: 'K' },
	{ name: 'Nigeria', flag: 'NG', group: 'K' },
	{ name: 'Honduras', flag: 'HN', group: 'K' },
	// Group L
	{ name: 'Switzerland', flag: 'CH', group: 'L' },
	{ name: 'Norway', flag: 'NO', group: 'L' },
	{ name: 'DR Congo', flag: 'CD', group: 'L' },
	{ name: 'Paraguay', flag: 'PY', group: 'L' },
] as const;

export const STAGE_LABELS: Record<string, string> = {
	group: 'Phase de groupes',
	round_of_32: 'Huitièmes de finale',
	round_of_16: 'Seizièmes de finale',
	quarters: 'Quarts de finale',
	semis: 'Demi-finales',
	third: 'Match pour la 3ème place',
	final: 'Finale'
};

export const COUNTRIES = [
	'Algérie', 'Argentine', 'Australie', 'Autriche', 'Bahreïn', 'Belgique', 'Bolivie', 'Brésil',
	'Cameroun', 'Canada', 'Chili', 'Colombie', 'Congo RD', 'Costa Rica', 'Côte d\'Ivoire',
	'Croatie', 'République dominicaine', 'Equateur', 'Egypte', 'Espagne', 'Etats-Unis', 'France',
	'Allemagne', 'Angleterre', 'Honduras', 'Indonésie', 'Irak', 'Iran', 'Italie',
	'Jamaïque', 'Japon', 'Maroc', 'Mexique', 'Pays-Bas', 'Nouvelle-Zélande',
	'Nigéria', 'Norvège', 'Panama', 'Paraguay', 'Pérou', 'Portugal',
	'République tchèque', 'Arabie Saoudite', 'Sénégal', 'Slovaquie',
	'Corée du Sud', 'Suisse', 'Turquie', 'Ukraine', 'Uruguay', 'Venezuela', 'Autre'
].sort();
