export function isoToFlag(iso: string | null | undefined): string {
	if (!iso || iso === 'TBD') return '🏳';
	return iso
		.toUpperCase()
		.split('')
		.map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
		.join('');
}

export function formatDate(datetime: string): string {
	return new Date(datetime).toLocaleDateString('fr-FR', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function isMatchLocked(matchDatetime: string): boolean {
	return new Date(matchDatetime) <= new Date();
}

export function timeUntilMatch(matchDatetime: string): string {
	const diff = new Date(matchDatetime).getTime() - Date.now();
	if (diff <= 0) return 'Commencé';
	const days = Math.floor(diff / 86400000);
	const hours = Math.floor((diff % 86400000) / 3600000);
	const mins = Math.floor((diff % 3600000) / 60000);
	if (days > 0) return `J-${days}`;
	if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`;
	return `${mins} min`;
}
