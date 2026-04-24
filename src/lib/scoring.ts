export function calculatePoints(
	predictedHome: number,
	predictedAway: number,
	actualHome: number,
	actualAway: number,
	oddsUsed: number
): number {
	console.log('calculatePoints input:', { predictedHome, predictedAway, actualHome, actualAway, oddsUsed });
	if (predictedHome === actualHome && predictedAway === actualAway) {
		return +(3 * oddsUsed).toFixed(2);
	}
	const predictedResult = Math.sign(predictedHome - predictedAway);
	const actualResult = Math.sign(actualHome - actualAway);
	if (predictedResult === actualResult) {
		return +(1 * oddsUsed).toFixed(2);
	}
	return 0;
}
