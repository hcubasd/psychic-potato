import { afterEach, describe, expect, it } from "vitest";

import { squeezeText } from "../src/index.js";

const BODY_FONT_SIZE = 16;
const WIDTH_FACTOR = 0.6;
const HEIGHT_FACTOR = 1.2;

type PairConfig = {
	text: string;
	divWidth: number;
	divHeight: number;
	padding?: number;
	border?: number;
	widthScaleWithDivFont?: number;
	heightScaleWithDivFont?: number;
	left?: number;
	top?: number;
};

type PairFixture = {
	div: HTMLDivElement;
	span: HTMLSpanElement;
	contentWidth: number;
	contentHeight: number;
};

describe("squeezeText", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("throws on empty roots array", () => {
		expect(() => squeezeText([])).toThrow(/at least one root/);
	});

	it("throws when no div-span pair exists in the tree", () => {
		const div = document.createElement("div");
		document.body.append(div);
		expect(() => squeezeText([div])).toThrow(/no div containing a span/);
	});

	it("throws when a div contains more than one span", () => {
		const div = document.createElement("div");
		const s1 = document.createElement("span");
		const s2 = document.createElement("span");
		s1.textContent = "Hello";
		s2.textContent = "World";
		div.append(s1, s2);
		document.body.append(div);
		expect(() => squeezeText([div])).toThrow(/more than one span/);
	});

	it("finds a pair in a nested div structure", () => {
		const root = document.createElement("div");
		const inner = document.createElement("div");
		const span = document.createElement("span");

		span.textContent = "Hi";
		inner.append(span);
		root.append(inner);
		document.body.append(root);

		inner.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40);
		span.getBoundingClientRect = () => {
			const fs = parseFloat(getComputedStyle(span).fontSize) || BODY_FONT_SIZE;
			return new DOMRect(0, 0, WIDTH_FACTOR * fs * 2, HEIGHT_FACTOR * fs);
		};

		expect(() => squeezeText([root])).not.toThrow();
	});

	it("throws when all spans have no renderable size", () => {
		const first = createPair({ text: "", divWidth: 120, divHeight: 40 });
		const second = createPair({ text: "", divWidth: 120, divHeight: 40, top: 100 });
		expect(() => squeezeText([first.div, second.div])).toThrow(
			/at least one span to render/,
		);
	});

	it("throws when setting initial font destabilizes all dimensions", () => {
		const pair = createPair({
			text: "Unstable",
			divWidth: 120,
			divHeight: 40,
			widthScaleWithDivFont: 3,
			heightScaleWithDivFont: 3,
		});

		// Initial font 48px → body font 16px causes both dims to change
		pair.div.style.fontSize = "48px";
		pair.span.style.fontSize = "48px";

		expect(() => squeezeText([pair.div])).toThrow(/lost all stable/);
	});

	it("grows font to fill a stable container", () => {
		const pair = createPair({ text: "January", divWidth: 132, divHeight: 64 });

		squeezeText([pair.div]);

		expect(readFontSize(pair.span)).toBeGreaterThan(BODY_FONT_SIZE);
		expect(measuredWidth(pair.span)).toBeLessThanOrEqual(pair.contentWidth + 1);
		expect(measuredHeight(pair.span)).toBeLessThanOrEqual(pair.contentHeight + 1);
	});

	it("shrinks from an oversized initial font", () => {
		const pair = createPair({ text: "September", divWidth: 92, divHeight: 40 });

		pair.div.style.fontSize = "48px";
		pair.span.style.fontSize = "48px";

		squeezeText([pair.div]);

		expect(readFontSize(pair.span)).toBeLessThan(48);
		expect(measuredWidth(pair.span)).toBeLessThanOrEqual(pair.contentWidth + 1);
	});

	it("uses the binding pair as the constraint across multiple pairs", () => {
		const first = createPair({ text: "January", divWidth: 132, divHeight: 64 });
		const second = createPair({
			text: "February",
			divWidth: 100,
			divHeight: 64,
			top: 100,
		});

		squeezeText([first.div, second.div]);

		const scalar = readFontSize(first.span) / BODY_FONT_SIZE;
		const limitingScalar = Math.min(
			first.contentWidth / (WIDTH_FACTOR * BODY_FONT_SIZE * "January".length),
			second.contentWidth / (WIDTH_FACTOR * BODY_FONT_SIZE * "February".length),
		);

		expect(readFontSize(first.span)).toBeCloseTo(readFontSize(second.span), 4);
		expect(scalar).toBeGreaterThan(1);
		expect(scalar).toBeCloseTo(limitingScalar, 1);
		expect(measuredWidth(first.span)).toBeLessThanOrEqual(first.contentWidth + 1);
		expect(measuredWidth(second.span)).toBeLessThanOrEqual(second.contentWidth + 1);
	});

	it("ignores unstable width and fits height only", () => {
		// divWidth=60 ensures span fits width at initial scalar so algorithm grows;
		// as it grows the div expands (widthScaleWithDivFont=2) and width is nulled,
		// leaving height as the only constraint.
		const pair = createPair({
			text: "Wide",
			divWidth: 60,
			divHeight: 80,
			widthScaleWithDivFont: 2,
		});

		const originalContentWidth = pair.contentWidth;

		squeezeText([pair.div]);

		expect(measuredHeight(pair.span)).toBeLessThanOrEqual(pair.contentHeight + 1);
		expect(measuredWidth(pair.span)).toBeGreaterThan(originalContentWidth);
	});

	it("throws during sweep when all dimensions become unstable", () => {
		const pair = createPair({
			text: "Calendar",
			divWidth: 120,
			divHeight: 40,
			widthScaleWithDivFont: 3,
			heightScaleWithDivFont: 3,
		});

		expect(() => squeezeText([pair.div])).toThrow(/lost all stable/);
	});

	it("restores original inline font sizes after a failure", () => {
		const pair = createPair({
			text: "Restore",
			divWidth: 120,
			divHeight: 40,
			widthScaleWithDivFont: 3,
			heightScaleWithDivFont: 3,
		});

		pair.div.style.fontSize = "20px";
		pair.span.style.fontSize = "20px";

		expect(() => squeezeText([pair.div])).toThrow();
		expect(pair.div.style.fontSize).toBe("20px");
		expect(pair.span.style.fontSize).toBe("20px");
	});
});

function createPair(config: PairConfig): PairFixture {
	const {
		text,
		divWidth,
		divHeight,
		padding = 4,
		border = 1,
		widthScaleWithDivFont = 0,
		heightScaleWithDivFont = 0,
		left = 0,
		top = 0,
	} = config;

	const div = document.createElement("div");
	const span = document.createElement("span");
	const inset = padding + border;

	div.style.fontSize = `${BODY_FONT_SIZE}px`;
	div.style.padding = `${padding}px`;
	div.style.border = `${border}px solid transparent`;
	span.style.fontSize = `${BODY_FONT_SIZE}px`;
	span.textContent = text;
	div.append(span);
	document.body.append(div);

	div.getBoundingClientRect = () => {
		const fs = readFontSize(div);
		return new DOMRect(
			left,
			top,
			divWidth + widthScaleWithDivFont * (fs - BODY_FONT_SIZE),
			divHeight + heightScaleWithDivFont * (fs - BODY_FONT_SIZE),
		);
	};

	span.getBoundingClientRect = () => {
		const divRect = div.getBoundingClientRect();
		const fs = readFontSize(span);

		if (text.length === 0) {
			return new DOMRect(divRect.left + inset, divRect.top + inset, 0, 0);
		}

		return new DOMRect(
			divRect.left + inset,
			divRect.top + inset,
			WIDTH_FACTOR * fs * text.length,
			HEIGHT_FACTOR * fs,
		);
	};

	return {
		div,
		span,
		contentWidth: divWidth - 2 * inset,
		contentHeight: divHeight - 2 * inset,
	};
}

function readFontSize(element: Element): number {
	return parseFloat(getComputedStyle(element).fontSize);
}

function measuredWidth(element: HTMLElement): number {
	return element.getBoundingClientRect().width;
}

function measuredHeight(element: HTMLElement): number {
	return element.getBoundingClientRect().height;
}
