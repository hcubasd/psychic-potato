import { matchGrays } from "miniature-waffle";

export type ColorBgConfig = {
	from?: number;
	to?: number;
};

type BgLayer = { div: HTMLDivElement; depth: number };

// Nesting depth (number of bg-class ancestors) drives the color: the outermost
// bg layer gets `from` lightness, the innermost gets `to` lightness (both in
// [0, 1] where 0 = black and 1 = white), and miniature-waffle's matchGrays
// fills the evenly-spaced grays in between.
export function colorBg(
	root: HTMLDivElement,
	config: ColorBgConfig = {},
): number {
	const { from = 0, to = 1 } = config;

	const layers = collectBgWithDepth(root);
	if (layers.length === 0) {
		throw new Error('colorBg: no element with class "bg" was found.');
	}

	let maxDepth = 0;
	for (const { depth } of layers) {
		if (depth > maxDepth) maxDepth = depth;
	}

	const depthCount = maxDepth + 1;
	const grays = matchGrays(depthCount, from * 100, to * 100);

	for (const { div, depth } of layers) {
		const { r, g, b } = grays[depth];
		div.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
	}

	return depthCount;
}

function collectBgWithDepth(root: HTMLDivElement): BgLayer[] {
	const out: BgLayer[] = [];

	const visit = (el: Element, depth: number): void => {
		let childDepth = depth;
		if (el.tagName === "DIV" && el.classList.contains("bg")) {
			out.push({ div: el as HTMLDivElement, depth });
			childDepth = depth + 1;
		}
		for (const child of el.children) visit(child, childDepth);
	};

	visit(root, 0);
	return out;
}
