import { matchGrays } from "miniature-waffle";

export type ColorBgConfig = {
	startL?: number;
	endL?: number;
};

type BgLayer = { div: HTMLDivElement; depth: number };

// Nesting depth (number of bg-class ancestors) drives the color: the outermost
// bg layer gets startL, the innermost gets endL, and miniature-waffle's
// matchGrays fills the evenly-spaced grays in between.
export function colorBg(
	root: HTMLDivElement,
	config: ColorBgConfig = {},
): void {
	const { startL = 0, endL = 100 } = config;

	const layers = collectBgWithDepth(root);
	if (layers.length === 0) {
		throw new Error('colorBg: no element with class "bg" was found.');
	}

	let maxDepth = 0;
	for (const { depth } of layers) {
		if (depth > maxDepth) maxDepth = depth;
	}

	const grays = matchGrays(maxDepth + 1, startL, endL);

	for (const { div, depth } of layers) {
		const { r, g, b } = grays[depth];
		div.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
	}
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
