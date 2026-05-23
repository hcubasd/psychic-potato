const SEARCH_EPSILON_START_PX = 1;
const MAX_SWEEP_STEPS = 32;
const MAX_BINARY_STEPS = 32;
const MIN_SCALAR = 1 / 2 ** 32;
const SCALAR_STALL_EPSILON = 1e-7;

import {
	assertAtLeastOneSpanRenders,
	assertDivsStable,
	measureDivTarget,
	measureFit,
	type DivTarget,
	type FitAxis,
} from "./measurement.js";

type FontSizeSnapshot = {
	divInline: string[];
	spanInline: string[];
};

type BaseFontSizes = {
	divs: number[];
	spans: number[];
};

type SweepBracket = {
	insideScalar: number;
	outsideScalar: number;
	initialInsideGap: number;
};

type AppliedScalar = {
	value: number | null;
};

export type SqueezeTextOptions = {
	axis?: FitAxis;
};

export function squeezeText(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	options: SqueezeTextOptions = {},
): void {
	validateInputs(divs, spans);
	const axis = options.axis ?? "both";

	const fontSnapshot = snapshotInlineFontSizes(divs, spans);
	const baseFontSizes = captureBaseFontSizes(divs, spans);
	const divTargets = divs.map((div) => measureDivTarget(div, axis));
	const appliedScalar: AppliedScalar = { value: null };

	try {
		applyScalar(divs, spans, baseFontSizes, appliedScalar, 1);
		assertAtLeastOneSpanRenders(spans);

		const bracket = runExponentialSweep(
			divs,
			spans,
			baseFontSizes,
			divTargets,
			appliedScalar,
			axis,
		);
		runBinarySearch(
			divs,
			spans,
			baseFontSizes,
			divTargets,
			bracket,
			appliedScalar,
			axis,
		);
	} catch (error) {
		restoreInlineFontSizes(divs, spans, fontSnapshot);
		throw error;
	}
}

function validateInputs(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
): void {
	if (divs.length !== spans.length) {
		throw new Error(
			"squeezeText requires div and span arrays of the same length.",
		);
	}

	if (divs.length === 0) {
		throw new Error("squeezeText requires at least one div/span pair.");
	}

	const hasAnyText = spans.some((span) => (span.textContent ?? "").length > 0);

	if (!hasAnyText) {
		throw new Error(
			"squeezeText requires at least one span with text content.",
		);
	}

	for (let index = 0; index < divs.length; index += 1) {
		const div = divs[index];
		const span = spans[index];

		if (!div.isConnected || !span.isConnected) {
			throw new Error("squeezeText requires connected div/span elements.");
		}

		if (!div.contains(span)) {
			throw new Error(
				`squeezeText requires span ${index} to be contained inside div ${index}.`,
			);
		}
	}
}

function snapshotInlineFontSizes(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
): FontSizeSnapshot {
	return {
		divInline: divs.map((div) => div.style.fontSize),
		spanInline: spans.map((span) => span.style.fontSize),
	};
}

function restoreInlineFontSizes(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	snapshot: FontSizeSnapshot,
): void {
	for (let index = 0; index < divs.length; index += 1) {
		divs[index].style.fontSize = snapshot.divInline[index];
		spans[index].style.fontSize = snapshot.spanInline[index];
	}
}

function captureBaseFontSizes(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
): BaseFontSizes {
	return {
		divs: divs.map((div, index) => readFontSize(div, `div ${index}`)),
		spans: spans.map((span, index) => readFontSize(span, `span ${index}`)),
	};
}

function readFontSize(element: Element, label: string): number {
	const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);

	if (!Number.isFinite(fontSize) || fontSize <= 0) {
		throw new Error(
			`squeezeText requires a positive computed font size for ${label}.`,
		);
	}

	return fontSize;
}

function applyScalar(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	baseFontSizes: BaseFontSizes,
	appliedScalar: AppliedScalar,
	scalar: number,
): void {
	if (appliedScalar.value === scalar) {
		return;
	}

	for (let index = 0; index < divs.length; index += 1) {
		divs[index].style.fontSize = `${baseFontSizes.divs[index] * scalar}px`;
	}

	for (let index = 0; index < spans.length; index += 1) {
		spans[index].style.fontSize = `${baseFontSizes.spans[index] * scalar}px`;
	}

	appliedScalar.value = scalar;
}
function runExponentialSweep(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	baseFontSizes: BaseFontSizes,
	divTargets: DivTarget[],
	appliedScalar: AppliedScalar,
	axis: FitAxis,
): SweepBracket {
	let scalar = 1;
	let assessment = measureFit(divs, spans, divTargets, axis);

	for (let step = 0; step < MAX_SWEEP_STEPS; step += 1) {
		if (assessment.fits) {
			const nextScalar = scalar * 2;
			applyScalar(divs, spans, baseFontSizes, appliedScalar, nextScalar);
			assertDivsStable(divs, divTargets, axis);

			const nextAssessment = measureFit(divs, spans, divTargets, axis);

			if (!nextAssessment.fits) {
				return {
					insideScalar: scalar,
					outsideScalar: nextScalar,
					initialInsideGap: assessment.minGap,
				};
			}

			scalar = nextScalar;
			assessment = nextAssessment;
			continue;
		}

		const nextScalar = scalar / 2;

		if (nextScalar < MIN_SCALAR) {
			throw new Error(
				"squeezeText could not find a fitting font size during the sweep.",
			);
		}

		applyScalar(divs, spans, baseFontSizes, appliedScalar, nextScalar);
		assertDivsStable(divs, divTargets, axis);

		const nextAssessment = measureFit(divs, spans, divTargets, axis);

		if (nextAssessment.fits) {
			return {
				insideScalar: nextScalar,
				outsideScalar: scalar,
				initialInsideGap: nextAssessment.minGap,
			};
		}

		scalar = nextScalar;
		assessment = nextAssessment;
	}

	throw new Error("squeezeText could not bracket a fit during the sweep.");
}
function runBinarySearch(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	baseFontSizes: BaseFontSizes,
	divTargets: DivTarget[],
	bracket: SweepBracket,
	appliedScalar: AppliedScalar,
	axis: FitAxis,
): void {
	let inside = bracket.insideScalar;
	let outside = bracket.outsideScalar;
	let bestInside = inside;
	let bestGap = bracket.initialInsideGap;
	let epsilon = SEARCH_EPSILON_START_PX;

	for (let step = 0; step < MAX_BINARY_STEPS; step += 1) {
		const midpoint = (inside + outside) / 2;

		if (
			Math.abs(midpoint - inside) <= SCALAR_STALL_EPSILON ||
			Math.abs(outside - midpoint) <= SCALAR_STALL_EPSILON
		) {
			break;
		}

		applyScalar(divs, spans, baseFontSizes, appliedScalar, midpoint);
		const assessment = measureFit(divs, spans, divTargets, axis);

		if (assessment.fits) {
			inside = midpoint;
			bestInside = midpoint;
			bestGap = assessment.minGap;

			if (assessment.minGap <= epsilon) {
				return;
			}
		} else {
			outside = midpoint;
		}

		epsilon += 1;
	}

	applyScalar(divs, spans, baseFontSizes, appliedScalar, bestInside);

	if (bestGap < 0) {
		throw new Error("squeezeText could not preserve a non-clipping fit.");
	}
}
