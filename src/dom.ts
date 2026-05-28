function stabilityThresholdPx(): number {
	const dpr =
		typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
	// Tolerate sub-pixel jitter from device-pixel snapping. The snapping grid
	// grows with display scaling, so scale the tolerance with dpr rather than
	// pinning it to a fixed CSS pixel.
	return Math.max(1, Math.ceil(dpr));
}

export type Pair = {
	div: HTMLDivElement;
	span: HTMLSpanElement;
	savedDivFont: string;
	savedSpanFont: string;
	insets: { left: number; right: number; top: number; bottom: number };
	stableWidth: number | null;
	stableHeight: number | null;
};

function parsePx(value: string): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

export function getBodyFontSize(): number {
	const raw = parseFloat(getComputedStyle(document.body).fontSize);
	return Number.isFinite(raw) && raw > 0 ? raw : 16;
}

export function collectPairs(roots: HTMLDivElement[]): Pair[] {
	if (roots.length === 0) {
		throw new Error("squeezeText requires at least one root div.");
	}

	const pairs: Pair[] = [];

	for (let i = 0; i < roots.length; i++) {
		const root = roots[i];
		if (!root.isConnected) {
			throw new Error(`squeezeText requires div ${i} to be connected.`);
		}
		walkDiv(root, pairs);
	}

	if (pairs.length === 0) {
		throw new Error("squeezeText: no div containing a span was found.");
	}

	return pairs;
}

function walkDiv(div: HTMLDivElement, pairs: Pair[]): void {
	const directSpans: HTMLSpanElement[] = [];
	const childDivs: HTMLDivElement[] = [];

	for (const child of div.children) {
		if (child.tagName === "SPAN") directSpans.push(child as HTMLSpanElement);
		else if (child.tagName === "DIV") childDivs.push(child as HTMLDivElement);
	}

	if (directSpans.length > 1) {
		throw new Error("squeezeText: a div contains more than one span.");
	}

	if (directSpans.length === 1) {
		const span = directSpans[0];
		const style = getComputedStyle(div);
		pairs.push({
			div,
			span,
			savedDivFont: div.style.fontSize,
			savedSpanFont: span.style.fontSize,
			insets: {
				left: parsePx(style.paddingLeft) + parsePx(style.borderLeftWidth),
				right: parsePx(style.paddingRight) + parsePx(style.borderRightWidth),
				top: parsePx(style.paddingTop) + parsePx(style.borderTopWidth),
				bottom: parsePx(style.paddingBottom) + parsePx(style.borderBottomWidth),
			},
			stableWidth: null,
			stableHeight: null,
		});
		return;
	}

	for (const child of childDivs) {
		walkDiv(child, pairs);
	}
}

export function recordDims(pairs: Pair[]): void {
	for (const pair of pairs) {
		const rect = pair.div.getBoundingClientRect();
		pair.stableWidth = rect.width;
		pair.stableHeight = rect.height;
	}
}

export function setFontSizes(pairs: Pair[], px: number): void {
	for (const { div, span } of pairs) {
		div.style.fontSize = `${px}px`;
		span.style.fontSize = `${px}px`;
	}
}

export function restoreFontSizes(pairs: Pair[]): void {
	for (const { div, span, savedDivFont, savedSpanFont } of pairs) {
		div.style.fontSize = savedDivFont;
		span.style.fontSize = savedSpanFont;
	}
}

export function checkStability(pairs: Pair[]): void {
	const threshold = stabilityThresholdPx();
	for (const pair of pairs) {
		const rect = pair.div.getBoundingClientRect();

		if (
			pair.stableWidth !== null &&
			Math.abs(rect.width - pair.stableWidth) > threshold
		) {
			pair.stableWidth = null;
		}

		if (
			pair.stableHeight !== null &&
			Math.abs(rect.height - pair.stableHeight) > threshold
		) {
			pair.stableHeight = null;
		}

		if (pair.stableWidth === null && pair.stableHeight === null) {
			throw new Error(
				"squeezeText: a div lost all stable dimensions.",
			);
		}
	}
}

export function measureSpanGap(pair: Pair): number {
	const divRect = pair.div.getBoundingClientRect();
	const spanRect = pair.span.getBoundingClientRect();
	const { insets, stableWidth, stableHeight } = pair;
	let minGap = Infinity;

	if (stableWidth !== null) {
		minGap = Math.min(
			minGap,
			spanRect.left - (divRect.left + insets.left),
			divRect.right - insets.right - spanRect.right,
		);
	}

	if (stableHeight !== null) {
		minGap = Math.min(
			minGap,
			spanRect.top - (divRect.top + insets.top),
			divRect.bottom - insets.bottom - spanRect.bottom,
		);
	}

	return minGap;
}

export function allPairsFit(pairs: Pair[]): boolean {
	return pairs.every((pair) => measureSpanGap(pair) >= 0);
}

export function findBoundingPair(pairs: Pair[]): Pair {
	let candidate = pairs[0];
	let minGap = measureSpanGap(candidate);

	for (let i = 1; i < pairs.length; i++) {
		const gap = measureSpanGap(pairs[i]);
		if (gap < minGap) {
			minGap = gap;
			candidate = pairs[i];
		}
	}

	return candidate;
}
