export type Pair = {
	bg: HTMLDivElement;
	fg: HTMLDivElement;
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

	const bgs = collectByClass(root, "bg");
	const pairs: Pair[] = [];

	for (const bg of bgs) {
		const fgChildren: HTMLDivElement[] = [];
		for (const child of bg.children) {
			if (child.tagName === "DIV" && child.classList.contains("fg")) {
				fgChildren.push(child as HTMLDivElement);
			}
		}

		if (fgChildren.length === 0) continue;

		if (fgChildren.length > 1) {
			throw new Error(
				"squeezeFg: each bg div must contain exactly one direct fg child.",
			);
		}

		const style = getComputedStyle(bg);
		pairs.push({
			bg,
			fg: fgChildren[0],
			insets: {
				left: parsePx(style.paddingLeft) + parsePx(style.borderLeftWidth),
				right: parsePx(style.paddingRight) + parsePx(style.borderRightWidth),
				top: parsePx(style.paddingTop) + parsePx(style.borderTopWidth),
				bottom: parsePx(style.paddingBottom) + parsePx(style.borderBottomWidth),
			},
			savedFont: fgChildren[0].style.fontSize,
		});
	}

	if (pairs.length === 0) {
		throw new Error(
			"squeezeFg: no bg element with a direct fg child was found.",
		);
	}

	return pairs;
}

export function setFont(pairs: Pair[], px: number): void {
	for (const { fg } of pairs) fg.style.fontSize = `${px}px`;
}

export function restoreFont(pairs: Pair[]): void {
	for (const { fg, savedFont } of pairs) fg.style.fontSize = savedFont;
}

// Signed distance from the fg's box to the bg's content box, taking the
// tightest of the two axes. Negative means fg overflows; >= 0 means it fits.
// An axis where the bg hugs its fg sits at ~0 and never drives the crossing,
// so the fixed axis wins naturally — no stability tracking needed.
export function measureGap(pair: Pair): number {
	const bg = pair.bg.getBoundingClientRect();
	const fg = pair.fg.getBoundingClientRect();
	const { insets } = pair;

	const widthGap = Math.min(
		fg.left - (bg.left + insets.left),
		bg.right - insets.right - fg.right,
	);
	const heightGap = Math.min(
		fg.top - (bg.top + insets.top),
		bg.bottom - insets.bottom - fg.bottom,
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
