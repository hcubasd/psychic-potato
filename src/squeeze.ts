import {
	allPairsFit,
	checkStability,
	collectPairs,
	findBoundingPair,
	getBodyFontSize,
	measureSpanGap,
	recordDims,
	restoreFontSizes,
	setFontSizes,
	type Pair,
} from "./dom.js";

const MAX_SWEEP_STEPS = 32;
const MAX_BINARY_STEPS = 32;
const MIN_SCALAR = 1 / 2 ** 32;
const EPSILON_START_PX = 1;

type SweepResult = {
	candidate: Pair;
	inside: number;
	outside: number;
};

export function squeezeText(roots: HTMLDivElement[]): void {
	const pairs = collectPairs(roots);
	const bodyFs = getBodyFontSize();

	try {
		recordDims(pairs);
		setFontSizes(pairs, bodyFs);
		checkStability(pairs);

		validateSpansRender(pairs);

		const { candidate, inside, outside } = runSweep(pairs, bodyFs);
		const bestScalar = runBinarySearch(candidate, pairs, bodyFs, inside, outside);
		setFontSizes(pairs, bodyFs * bestScalar);
	} catch (err) {
		restoreFontSizes(pairs);
		throw err;
	}
}

function validateSpansRender(pairs: Pair[]): void {
	const anyRenders = pairs.some(({ span }) => {
		const rect = span.getBoundingClientRect();
		return rect.width > 0 || rect.height > 0;
	});
	if (!anyRenders) {
		throw new Error(
			"squeezeText requires at least one span to render measurable text.",
		);
	}
}

function runSweep(pairs: Pair[], bodyFs: number): SweepResult {
	let scalar = 1;
	let fits = allPairsFit(pairs);

	for (let step = 0; step < MAX_SWEEP_STEPS; step++) {
		const nextScalar = fits ? scalar * 2 : scalar / 2;

		if (nextScalar < MIN_SCALAR) {
			throw new Error("squeezeText: could not find a fitting font size.");
		}

		setFontSizes(pairs, bodyFs * nextScalar);
		checkStability(pairs);

		const nextFits = allPairsFit(pairs);

		if (fits !== nextFits) {
			const candidate = findBoundingPair(pairs);
			return fits
				? { candidate, inside: scalar, outside: nextScalar }
				: { candidate, inside: nextScalar, outside: scalar };
		}

		scalar = nextScalar;
		fits = nextFits;
	}

	throw new Error("squeezeText: could not bracket a fit during the sweep.");
}

function runBinarySearch(
	candidate: Pair,
	pairs: Pair[],
	bodyFs: number,
	inside: number,
	outside: number,
): number {
	let bestInside = inside;
	let threshold = EPSILON_START_PX;

	for (let step = 0; step < MAX_BINARY_STEPS; step++) {
		const mid = (inside + outside) / 2;
		setFontSizes(pairs, bodyFs * mid);
		const gap = measureSpanGap(candidate);

		if (gap >= 0) {
			inside = mid;
			bestInside = mid;
			if (gap <= threshold) break;
		} else {
			outside = mid;
		}

		threshold += 1;
	}

	return bestInside;
}
