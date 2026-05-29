import {
	collectPairs,
	getBodyFontSize,
	minGap,
	type Pair,
	restoreFont,
	setFont,
} from "./dom.js";

const MAX_SWEEP_STEPS = 16;
const MAX_BINARY_STEPS = 1024;
const CONVERGENCE_STD_PX = 1;

type Bracket = { inside: number; outside: number };

export function squeezeFg(root: HTMLDivElement): void {
	const pairs = collectPairs(root);
	const seed = getBodyFontSize();

	try {
		setFont(pairs, seed);
		validateRenders(pairs);

		const { inside, outside } = sweep(pairs, seed);
		const best = refine(pairs, inside, outside);
		setFont(pairs, best);
	} catch (err) {
		restoreFont(pairs);
		throw err;
	}
}

function validateRenders(pairs: Pair[]): void {
	const anyRenders = pairs.some(({ child }) => {
		const rect = child.getBoundingClientRect();
		return rect.width > 0 || rect.height > 0;
	});
	if (!anyRenders) {
		throw new Error(
			"squeezeFg requires at least one fg child with measurable content.",
		);
	}
}

// Exponential search: grow while everything fits, shrink while anything
// overflows, until the fit state flips. Brackets the answer between the last
// fitting font (`inside`) and the first overflowing font (`outside`).
function sweep(pairs: Pair[], seed: number): Bracket {
	let font = seed;
	let fits = minGap(pairs) >= 0;

	for (let step = 0; step < MAX_SWEEP_STEPS; step++) {
		const next = fits ? font * 2 : font / 2;
		setFont(pairs, next);
		const nextFits = minGap(pairs) >= 0;

		if (fits !== nextFits) {
			return fits
				? { inside: font, outside: next }
				: { inside: next, outside: font };
		}

		font = next;
		fits = nextFits;
	}

	throw new Error("squeezeFg: could not bracket a fit during the sweep.");
}

// Binary search refinement. We track the running mean and variance (Welford) of
// the sampled font size and stop once its standard deviation drops below a pixel
// — at that point the search has exhausted any meaningful resolution. We apply
// `inside`, the largest font that still fit. By the time the std-dev stop fires
// the bracket has halved to a sliver (it shrinks exponentially while the std-dev
// only falls like 1/sqrt(n)), so inside sits within a hair of the true boundary
// on the safe side — a free fit guarantee since we don't control the fg's
// overflow behavior.
function refine(pairs: Pair[], inside: number, outside: number): number {
	let mean = 0;
	let m2 = 0;
	let n = 0;

	for (let step = 0; step < MAX_BINARY_STEPS; step++) {
		const mid = (inside + outside) / 2;
		setFont(pairs, mid);
		const gap = minGap(pairs);

		n += 1;
		const delta = mid - mean;
		mean += delta / n;
		m2 += delta * (mid - mean);

		if (gap >= 0) inside = mid;
		else outside = mid;

		if (n >= 2 && Math.sqrt(m2 / n) < CONVERGENCE_STD_PX) break;
	}

	return inside;
}
