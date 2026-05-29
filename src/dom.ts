export type Pair = {
	fg: HTMLDivElement;
	child: HTMLDivElement;
	insets: { left: number; right: number; top: number; bottom: number };
	savedFont: string;
};

function parsePx(value: string): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

export function getBodyFontSize(): number {
	const raw = parseFloat(getComputedStyle(document.body).fontSize);
	return Number.isFinite(raw) && raw > 0 ? raw : 16;
}

export function collectByClass(
	root: HTMLDivElement,
	className: string,
): HTMLDivElement[] {
	const out: HTMLDivElement[] = [];

	const visit = (el: Element): void => {
		if (el.tagName === "DIV" && el.classList.contains(className)) {
			out.push(el as HTMLDivElement);
		}
		for (const child of el.children) visit(child);
	};

	visit(root);
	return out;
}

export function collectPairs(root: HTMLDivElement): Pair[] {
	if (!root.isConnected) {
		throw new Error("squeezeFg requires a connected root div.");
	}

	const fgs = collectByClass(root, "fg");
	if (fgs.length === 0) {
		throw new Error('squeezeFg: no element with class "fg" was found.');
	}

	const pairs: Pair[] = [];

	for (const fg of fgs) {
		const childDivs: HTMLDivElement[] = [];
		for (const child of fg.children) {
			if (child.tagName === "DIV") childDivs.push(child as HTMLDivElement);
		}

		if (childDivs.length !== 1) {
			throw new Error(
				"squeezeFg: each fg div must contain exactly one direct child div.",
			);
		}

		const style = getComputedStyle(fg);
		pairs.push({
			fg,
			child: childDivs[0],
			insets: {
				left: parsePx(style.paddingLeft) + parsePx(style.borderLeftWidth),
				right: parsePx(style.paddingRight) + parsePx(style.borderRightWidth),
				top: parsePx(style.paddingTop) + parsePx(style.borderTopWidth),
				bottom: parsePx(style.paddingBottom) + parsePx(style.borderBottomWidth),
			},
			savedFont: fg.style.fontSize,
		});
	}

	return pairs;
}

export function setFont(pairs: Pair[], px: number): void {
	for (const { fg } of pairs) fg.style.fontSize = `${px}px`;
}

export function restoreFont(pairs: Pair[]): void {
	for (const { fg, savedFont } of pairs) fg.style.fontSize = savedFont;
}

// Signed distance from the child's box to the fg content box, taking the
// tightest of the two axes. Negative means the child overflows; >= 0 means it
// fits. An axis where the fg hugs its child sits at ~0 and never drives the
// crossing, so the fixed axis wins naturally — no stability tracking needed.
export function measureGap(pair: Pair): number {
	const fg = pair.fg.getBoundingClientRect();
	const child = pair.child.getBoundingClientRect();
	const { insets } = pair;

	const widthGap = Math.min(
		child.left - (fg.left + insets.left),
		fg.right - insets.right - child.right,
	);
	const heightGap = Math.min(
		child.top - (fg.top + insets.top),
		fg.bottom - insets.bottom - child.bottom,
	);

	return Math.min(widthGap, heightGap);
}

export function minGap(pairs: Pair[]): number {
	let min = Infinity;
	for (const pair of pairs) {
		const gap = measureGap(pair);
		if (gap < min) min = gap;
	}
	return min;
}
