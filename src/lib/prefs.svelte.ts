// Client-side display preferences (persisted to localStorage), mirroring the
// i18n store pattern. Currently: whether market odds are shown under matches.
// Default ON — but users who don't want to be influenced by the odds can hide
// every odds display across the app with one toggle.

const store = $state({ showOdds: true });

export function getShowOdds(): boolean {
	return store.showOdds;
}

export function setShowOdds(v: boolean) {
	store.showOdds = v;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('showOdds', v ? '1' : '0');
	}
}

export function toggleOdds() {
	setShowOdds(!store.showOdds);
}

// Read the persisted value on the client (called once from the layout on mount).
export function loadPrefs() {
	if (typeof localStorage !== 'undefined') {
		store.showOdds = localStorage.getItem('showOdds') !== '0';
	}
}
