// Scoreline probabilities from 1X2 odds — Poisson with the Dixon-Coles
// low-score correction. This powers the V2 exact-score multiplier: instead of
// a flat 3×, an exact score pays ln(1 / P(score)) (clamped), so predicting a
// freak 4-4 is worth far more than the market-favourite 0-0.
//
// Method (industry standard for correct-score pricing):
//   1. Strip the vig from the 3-way odds → outcome probabilities (pH, pD, pA).
//   2. Fit expected goals (λ_home, λ_away) so the Poisson matrix reproduces
//      those probabilities (2 unknowns, grid-refined least squares).
//   3. Apply the Dixon-Coles τ correction (ρ ≈ −0.13) to 0-0 / 1-0 / 0-1 / 1-1
//      — low scores are negatively correlated, independent Poisson mispricess
//      them — then renormalise.
//   4. P(h, a) for every scoreline up to MAX_GOALS.
//
// The fit runs once per match (at the odds freeze), so brute-force refinement
// is perfectly fine performance-wise.

const MAX_GOALS = 10;
const RHO = -0.13;

export const EXACT_MULT_MIN = 2;
export const EXACT_MULT_MAX = 8;

function poissonRow(lambda: number): number[] {
	// P(k) = λ^k e^-λ / k!  computed iteratively for k = 0..MAX_GOALS.
	const row = new Array(MAX_GOALS + 1);
	let p = Math.exp(-lambda);
	row[0] = p;
	for (let k = 1; k <= MAX_GOALS; k++) {
		p = (p * lambda) / k;
		row[k] = p;
	}
	return row;
}

// Dixon-Coles τ — the correction factor applied to the four lowest scorelines.
function tau(h: number, a: number, lh: number, la: number, rho: number): number {
	if (h === 0 && a === 0) return 1 - lh * la * rho;
	if (h === 0 && a === 1) return 1 + lh * rho;
	if (h === 1 && a === 0) return 1 + la * rho;
	if (h === 1 && a === 1) return 1 - rho;
	return 1;
}

/** Full (renormalised) scoreline matrix: matrix[h][a] = P(home h, away a). */
export function scorelineMatrix(lambdaHome: number, lambdaAway: number, rho = RHO): number[][] {
	const ph = poissonRow(lambdaHome);
	const pa = poissonRow(lambdaAway);
	const m: number[][] = [];
	let sum = 0;
	for (let h = 0; h <= MAX_GOALS; h++) {
		const row = new Array(MAX_GOALS + 1);
		for (let a = 0; a <= MAX_GOALS; a++) {
			const p = ph[h] * pa[a] * tau(h, a, lambdaHome, lambdaAway, rho);
			row[a] = p;
			sum += p;
		}
		m.push(row);
	}
	for (const row of m) for (let a = 0; a <= MAX_GOALS; a++) row[a] /= sum;
	return m;
}

function outcomeProbs(m: number[][]): { pH: number; pD: number; pA: number } {
	let pH = 0, pD = 0, pA = 0;
	for (let h = 0; h <= MAX_GOALS; h++)
		for (let a = 0; a <= MAX_GOALS; a++) {
			if (h > a) pH += m[h][a];
			else if (h === a) pD += m[h][a];
			else pA += m[h][a];
		}
	return { pH, pD, pA };
}

/** Strip the bookmaker margin proportionally: 1/odds renormalised to sum 1. */
export function devig(oddsHome: number, oddsDraw: number, oddsAway: number) {
	const rh = 1 / oddsHome, rd = 1 / oddsDraw, ra = 1 / oddsAway;
	const s = rh + rd + ra;
	return { pH: rh / s, pD: rd / s, pA: ra / s };
}

/** Fit λ_home, λ_away so the DC-Poisson matrix reproduces the target 1X2. */
export function fitLambdas(pH: number, pD: number, pA: number): { lambdaHome: number; lambdaAway: number } {
	let best = { lambdaHome: 1.3, lambdaAway: 1.1 };
	let bestErr = Infinity;
	const evalPair = (lh: number, la: number) => {
		const o = outcomeProbs(scorelineMatrix(lh, la));
		const err = (o.pH - pH) ** 2 + (o.pD - pD) ** 2 + (o.pA - pA) ** 2;
		if (err < bestErr) { bestErr = err; best = { lambdaHome: lh, lambdaAway: la }; }
	};
	// Coarse grid, then two refinement passes around the best point.
	for (let lh = 0.2; lh <= 4.0; lh += 0.1)
		for (let la = 0.2; la <= 4.0; la += 0.1) evalPair(lh, la);
	for (const step of [0.02, 0.004]) {
		const { lambdaHome: ch, lambdaAway: ca } = best;
		for (let lh = Math.max(0.05, ch - step * 6); lh <= ch + step * 6; lh += step)
			for (let la = Math.max(0.05, ca - step * 6); la <= ca + step * 6; la += step) evalPair(lh, la);
	}
	return best;
}

export type ScorelineModel = {
	lambdaHome: number;
	lambdaAway: number;
	/** matrix[h][a] = P(exact score h-a), h/a ≤ 10, sums to 1 */
	matrix: number[][];
	/** V2 exact-score multiplier for a given scoreline: clamp(ln(1/P), 2..8) */
	exactMultiplier: (h: number, a: number) => number;
};

/** Build the full scoreline model from the (frozen) 3-way match odds. */
export function scorelineModel(oddsHome: number, oddsDraw: number, oddsAway: number): ScorelineModel {
	const { pH, pD, pA } = devig(oddsHome, oddsDraw, oddsAway);
	const { lambdaHome, lambdaAway } = fitLambdas(pH, pD, pA);
	const matrix = scorelineMatrix(lambdaHome, lambdaAway);
	return {
		lambdaHome,
		lambdaAway,
		matrix,
		exactMultiplier(h: number, a: number): number {
			const hh = Math.min(Math.max(h, 0), MAX_GOALS);
			const aa = Math.min(Math.max(a, 0), MAX_GOALS);
			const p = matrix[hh][aa];
			if (!Number.isFinite(p) || p <= 0) return EXACT_MULT_MAX;
			const raw = Math.log(1 / p);
			return Math.min(EXACT_MULT_MAX, Math.max(EXACT_MULT_MIN, parseFloat(raw.toFixed(1))));
		}
	};
}
