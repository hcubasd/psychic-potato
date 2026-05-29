import { afterEach, describe, expect, it } from "vitest";

import { squeezeFg } from "../src/index.js";

const BODY_FONT_SIZE = 16;
const WIDTH_FACTOR = 0.6;
const HEIGHT_FACTOR = 1.2;

type PairConfig = {
	text: string;
	fgWidth: number;
	fgHeight: number;
	padding?: number;
	border?: number;
	widthScaleWithFont?: number;
	heightScaleWithFont?: number;
	left?: number;
	top?: number;
};

type PairFixture = {
	fg: HTMLDivElement;
	child: HTMLDivElement;
	contentWidth: number;
	contentHeight: number;
};

describe("squeezeFg", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("throws when the root is not connected", () => {
		const root = document.createElement("div");
		root.className = "fg";
		root.append(document.createElement("div"));
		expect(() => squeezeFg(root)).toThrow(/connected/);
	});

	it("throws when no fg div exists in the tree", () => {
		const root = document.createElement("div");
		root.append(document.createElement("div"));
		document.body.append(root);
		expect(() => squeezeFg(root)).toThrow(/no element with class "fg"/);
	});

	it("throws when an fg div has no child div", () => {
		const fg = document.createElement("div");
		fg.className = "fg";
		document.body.append(fg);
		expect(() => squeezeFg(fg)).toThrow(/exactly one direct child div/);
	});

	it("throws when an fg div has more than one child div", () => {
		const fg = document.createElement("div");
		fg.className = "fg";
		fg.append(document.createElement("div"), document.createElement("div"));
		document.body.append(fg);
		expect(() => squeezeFg(fg)).toThrow(/exactly one direct child div/);
	});

	it("throws when no fg child has measurable content", () => {
		const a = createPair({ text: "", fgWidth: 120, fgHeight: 40 });
		const b = createPair({ text: "", fgWidth: 120, fgHeight: 40, top: 100 });
		const root = wrap(a.fg, b.fg);
		expect(() => squeezeFg(root)).toThrow(/measurable content/);
	});

	it("grows the font to fill a stable container", () => {
		const pair = createPair({ text: "January", fgWidth: 132, fgHeight: 64 });
		const limiting = limitingFont(pair, "January");

		squeezeFg(pair.fg);

		const font = readFontSize(pair.fg);
		expect(font).toBeGreaterThan(BODY_FONT_SIZE);
		expect(Math.abs(font - limiting)).toBeLessThan(1);
		expect(measuredWidth(pair.child)).toBeLessThanOrEqual(
			pair.contentWidth + 1,
		);
		expect(measuredHeight(pair.child)).toBeLessThanOrEqual(
			pair.contentHeight + 1,
		);
	});

	it("shrinks the font when content overflows at the seed size", () => {
		// Narrow container: "September" overflows width at 16px, so it shrinks.
		const pair = createPair({ text: "September", fgWidth: 60, fgHeight: 40 });
		const limiting = limitingFont(pair, "September");

		squeezeFg(pair.fg);

		const font = readFontSize(pair.fg);
		expect(font).toBeLessThan(BODY_FONT_SIZE);
		expect(Math.abs(font - limiting)).toBeLessThan(1);
		expect(measuredWidth(pair.child)).toBeLessThanOrEqual(
			pair.contentWidth + 1,
		);
	});

	it("applies one shared font driven by the tightest pair", () => {
		const first = createPair({ text: "January", fgWidth: 132, fgHeight: 64 });
		const second = createPair({
			text: "February",
			fgWidth: 100,
			fgHeight: 64,
			top: 100,
		});
		const root = wrap(first.fg, second.fg);

		squeezeFg(root);

		expect(readFontSize(first.fg)).toBeCloseTo(readFontSize(second.fg), 4);
		const limiting = Math.min(
			limitingFont(first, "January"),
			limitingFont(second, "February"),
		);
		expect(Math.abs(readFontSize(first.fg) - limiting)).toBeLessThan(1);
		expect(measuredWidth(first.child)).toBeLessThanOrEqual(
			first.contentWidth + 1,
		);
		expect(measuredWidth(second.child)).toBeLessThanOrEqual(
			second.contentWidth + 1,
		);
	});

	it("ignores an axis where the fg hugs its content", () => {
		// Width grows with font faster than the text, so width never binds;
		// only the fixed height constrains the fit.
		const pair = createPair({
			text: "Wide",
			fgWidth: 60,
			fgHeight: 80,
			widthScaleWithFont: 8,
		});

		squeezeFg(pair.fg);

		expect(measuredHeight(pair.child)).toBeLessThanOrEqual(
			pair.contentHeight + 1,
		);
	});

	it("throws when the fg hugs its content in both axes", () => {
		const pair = createPair({
			text: "Calendar",
			fgWidth: 120,
			fgHeight: 40,
			widthScaleWithFont: 8,
			heightScaleWithFont: 8,
		});
		expect(() => squeezeFg(pair.fg)).toThrow(/could not bracket/);
	});

	it("restores the original inline font size after a failure", () => {
		const pair = createPair({
			text: "Restore",
			fgWidth: 120,
			fgHeight: 40,
			widthScaleWithFont: 8,
			heightScaleWithFont: 8,
		});
		pair.fg.style.fontSize = "20px";

		expect(() => squeezeFg(pair.fg)).toThrow();
		expect(pair.fg.style.fontSize).toBe("20px");
	});
});

function createPair(config: PairConfig): PairFixture {
	const {
		text,
		fgWidth,
		fgHeight,
		padding = 4,
		border = 1,
		widthScaleWithFont = 0,
		heightScaleWithFont = 0,
		left = 0,
		top = 0,
	} = config;

	const fg = document.createElement("div");
	const child = document.createElement("div");
	const inset = padding + border;

	fg.className = "fg";
	fg.style.fontSize = `${BODY_FONT_SIZE}px`;
	fg.style.padding = `${padding}px`;
	fg.style.border = `${border}px solid transparent`;
	child.textContent = text;
	fg.append(child);
	document.body.append(fg);

	fg.getBoundingClientRect = () => {
		const fs = readFontSize(fg);
		return new DOMRect(
			left,
			top,
			fgWidth + widthScaleWithFont * (fs - BODY_FONT_SIZE),
			fgHeight + heightScaleWithFont * (fs - BODY_FONT_SIZE),
		);
	};

	child.getBoundingClientRect = () => {
		const fgRect = fg.getBoundingClientRect();
		const fs = readFontSize(fg);

		if (text.length === 0) {
			return new DOMRect(fgRect.left + inset, fgRect.top + inset, 0, 0);
		}

		const w = WIDTH_FACTOR * fs * text.length;
		const h = HEIGHT_FACTOR * fs;
		const cw = fgRect.width - 2 * inset;
		const ch = fgRect.height - 2 * inset;

		return new DOMRect(
			fgRect.left + inset + (cw - w) / 2,
			fgRect.top + inset + (ch - h) / 2,
			w,
			h,
		);
	};

	return {
		fg,
		child,
		contentWidth: fgWidth - 2 * inset,
		contentHeight: fgHeight - 2 * inset,
	};
}

function limitingFont(pair: PairFixture, text: string): number {
	return Math.min(
		pair.contentWidth / (WIDTH_FACTOR * text.length),
		pair.contentHeight / HEIGHT_FACTOR,
	);
}

function wrap(...fgs: HTMLDivElement[]): HTMLDivElement {
	const root = document.createElement("div");
	for (const fg of fgs) root.append(fg);
	document.body.append(root);
	return root;
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
