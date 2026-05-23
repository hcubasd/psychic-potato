import { afterEach, describe, expect, it } from "vitest";

import { squeezeText } from "../src/index.js";

const DEFAULT_FONT_SIZE = 16;
const WIDTH_FACTOR = 0.6;
const HEIGHT_FACTOR = 1.2;

type PairConfig = {
	text: string;
	divWidth: number;
	divHeight: number;
	baseFontSize?: number;
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
	baseFontSize: number;
};

describe("squeezeText", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("throws on mismatched div and span arrays", () => {
		const pair = createPair({ text: "Alpha", divWidth: 120, divHeight: 40 });

		expect(() => squeezeText([pair.div], [])).toThrow(/same length/);
	});

	it("throws when every span is empty", () => {
		const first = createPair({ text: "", divWidth: 120, divHeight: 40 });
		const second = createPair({ text: "", divWidth: 120, divHeight: 40, top: 100 });

		expect(() => squeezeText([first.div, second.div], [first.span, second.span])).toThrow(
			/at least one span with text content/,
		);
	});

	it("throws when a span is not inside its matching div", () => {
		const pair = createPair({ text: "Detached", divWidth: 120, divHeight: 40 });
		document.body.append(pair.span);

		expect(() => squeezeText([pair.div], [pair.span])).toThrow(/contained inside div/);
	});

	it("uses one shared scalar and grows to the tightest inside width fit", () => {
		const first = createPair({ text: "January", divWidth: 132, divHeight: 64 });
		const second = createPair({
			text: "February",
			divWidth: 100,
			divHeight: 64,
			top: 100,
		});

		squeezeText([first.div, second.div], [first.span, second.span], { axis: "width" });

		const firstScalar = readFontSize(first.span) / first.baseFontSize;
		const secondScalar = readFontSize(second.span) / second.baseFontSize;
		const limitingScalar = Math.min(
			first.contentWidth / (WIDTH_FACTOR * first.baseFontSize * "January".length),
			second.contentWidth / (WIDTH_FACTOR * second.baseFontSize * "February".length),
		);

		expect(firstScalar).toBeCloseTo(secondScalar, 4);
		expect(firstScalar).toBeGreaterThan(1);
		expect(firstScalar).toBeCloseTo(limitingScalar, 1);
		expect(measuredWidth(first.span)).toBeLessThanOrEqual(first.contentWidth + 1);
		expect(measuredWidth(second.span)).toBeLessThanOrEqual(second.contentWidth + 1);
	});

	it("shrinks from an oversized initial font size", () => {
		const pair = createPair({
			text: "September",
			divWidth: 92,
			divHeight: 40,
			baseFontSize: 48,
		});

		squeezeText([pair.div], [pair.span], { axis: "width" });

		expect(readFontSize(pair.span)).toBeLessThan(48);
		expect(measuredWidth(pair.span)).toBeLessThanOrEqual(pair.contentWidth + 1);
	});

	it("allows unmeasured-axis container changes when fitting width only", () => {
		const pair = createPair({
			text: "Calendar",
			divWidth: 120,
			divHeight: 24,
			heightScaleWithDivFont: 3,
		});

		expect(() => squeezeText([pair.div], [pair.span], { axis: "width" })).not.toThrow();
		expect(measuredWidth(pair.span)).toBeLessThanOrEqual(pair.contentWidth + 1);
	});

	it("throws when the measured axis container size changes during the sweep", () => {
		const pair = createPair({
			text: "Calendar",
			divWidth: 120,
			divHeight: 40,
			widthScaleWithDivFont: 3,
			baseFontSize: 12,
		});

		expect(() => squeezeText([pair.div], [pair.span], { axis: "width" })).toThrow(
			/size-stable/,
		);
	});

	it("restores original inline font sizes after a fitting failure", () => {
		const pair = createPair({
			text: "Restore",
			divWidth: 120,
			divHeight: 40,
			baseFontSize: 20,
			widthScaleWithDivFont: 3,
		});

		expect(() => squeezeText([pair.div], [pair.span], { axis: "both" })).toThrow(/size-stable/);
		expect(pair.div.style.fontSize).toBe("20px");
		expect(pair.span.style.fontSize).toBe("20px");
	});

	it("can fit height independently of width", () => {
		const pair = createPair({
			text: "Wide",
			divWidth: 40,
			divHeight: 80,
		});

		squeezeText([pair.div], [pair.span], { axis: "height" });

		expect(measuredHeight(pair.span)).toBeLessThanOrEqual(pair.contentHeight + 1);
		expect(measuredWidth(pair.span)).toBeGreaterThan(pair.contentWidth);
	});
});

function createPair(config: PairConfig): PairFixture {
	const {
		text,
		divWidth,
		divHeight,
		baseFontSize = DEFAULT_FONT_SIZE,
		padding = 4,
		border = 1,
		widthScaleWithDivFont = 0,
		heightScaleWithDivFont = 0,
		left = 0,
		top = 0,
	} = config;
	const div = document.createElement("div");
	const span = document.createElement("span");

	div.style.fontSize = `${baseFontSize}px`;
	div.style.padding = `${padding}px`;
	div.style.border = `${border}px solid transparent`;
	span.style.fontSize = `${baseFontSize}px`;
	span.textContent = text;
	div.append(span);
	document.body.append(div);

	div.getBoundingClientRect = () => {
		const currentDivFont = readFontSize(div);
		const width = divWidth + widthScaleWithDivFont * (currentDivFont - baseFontSize);
		const height = divHeight + heightScaleWithDivFont * (currentDivFont - baseFontSize);

		return new DOMRect(left, top, width, height);
	};

	span.getBoundingClientRect = () => {
		const divRect = div.getBoundingClientRect();
		const inset = padding + border;
		const currentSpanFont = readFontSize(span);

		if (text.length === 0) {
			return new DOMRect(divRect.left + inset, divRect.top + inset, 0, 0);
		}

		return new DOMRect(
			divRect.left + inset,
			divRect.top + inset,
			WIDTH_FACTOR * currentSpanFont * text.length,
			HEIGHT_FACTOR * currentSpanFont,
		);
	};

	return {
		div,
		span,
		contentWidth: divWidth - 2 * (padding + border),
		contentHeight: divHeight - 2 * (padding + border),
		baseFontSize,
	};
}

function readFontSize(element: Element): number {
	return Number.parseFloat(getComputedStyle(element).fontSize);
}

function measuredWidth(element: HTMLElement): number {
	return element.getBoundingClientRect().width;
}

function measuredHeight(element: HTMLElement): number {
	return element.getBoundingClientRect().height;
}
