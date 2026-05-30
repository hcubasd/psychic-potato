import { afterEach, describe, expect, it } from "vitest";

import { squeezeFg } from "../src/index.js";

const BODY_FONT_SIZE = 16;
const WIDTH_FACTOR = 0.6;
const HEIGHT_FACTOR = 1.2;

type PairConfig = {
	text: string;
	bgWidth: number;
	bgHeight: number;
	padding?: number;
	border?: number;
	widthScaleWithFont?: number;
	heightScaleWithFont?: number;
	left?: number;
	top?: number;
};

type PairFixture = {
	bg: HTMLDivElement;
	fg: HTMLDivElement;
	contentWidth: number;
	contentHeight: number;
};

describe("squeezeFg", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("throws when the root is not connected", () => {
		const root = document.createElement("div");
		expect(() => squeezeFg(root)).toThrow(/connected/);
	});

	it("throws when no bg div has a direct fg child", () => {
		const root = document.createElement("div");
		root.append(document.createElement("div"));
		document.body.append(root);
		expect(() => squeezeFg(root)).toThrow(/no bg.*fg/i);
	});

	it("throws when a bg div has more than one fg child", () => {
		const bg = document.createElement("div");
		bg.className = "bg";
		const fg1 = document.createElement("div");
		fg1.className = "fg";
		const fg2 = document.createElement("div");
		fg2.className = "fg";
		bg.append(fg1, fg2);
		document.body.append(bg);
		expect(() => squeezeFg(bg)).toThrow(/exactly one.*fg/i);
	});

	it("throws when no fg has measurable content", () => {
		const a = createPair({ text: "", bgWidth: 120, bgHeight: 40 });
		const b = createPair({ text: "", bgWidth: 120, bgHeight: 40, top: 100 });
		const root = wrap(a.bg, b.bg);
		expect(() => squeezeFg(root)).toThrow(/measurable content/);
	});

	it("grows the font to fill a stable container", () => {
		const pair = createPair({ text: "January", bgWidth: 132, bgHeight: 64 });
		const limiting = limitingFont(pair, "January");

		squeezeFg(pair.bg);

		const font = readFontSize(pair.fg);
		expect(font).toBeGreaterThan(BODY_FONT_SIZE);
		expect(Math.abs(font - limiting)).toBeLessThan(1);
		expect(measuredWidth(pair.fg)).toBeLessThanOrEqual(pair.contentWidth + 1);
		expect(measuredHeight(pair.fg)).toBeLessThanOrEqual(pair.contentHeight + 1);
	});

	it("shrinks the font when content overflows at the seed size", () => {
		const pair = createPair({ text: "September", bgWidth: 60, bgHeight: 40 });
		const limiting = limitingFont(pair, "September");

		squeezeFg(pair.bg);

		const font = readFontSize(pair.fg);
		expect(font).toBeLessThan(BODY_FONT_SIZE);
		expect(Math.abs(font - limiting)).toBeLessThan(1);
		expect(measuredWidth(pair.fg)).toBeLessThanOrEqual(pair.contentWidth + 1);
	});

	it("applies one shared font driven by the tightest pair", () => {
		const first = createPair({ text: "January", bgWidth: 132, bgHeight: 64 });
		const second = createPair({
			text: "February",
			bgWidth: 100,
			bgHeight: 64,
			top: 100,
		});
		const root = wrap(first.bg, second.bg);

		squeezeFg(root);

		expect(readFontSize(first.fg)).toBeCloseTo(readFontSize(second.fg), 4);
		const limiting = Math.min(
			limitingFont(first, "January"),
			limitingFont(second, "February"),
		);
		expect(Math.abs(readFontSize(first.fg) - limiting)).toBeLessThan(1);
		expect(measuredWidth(first.fg)).toBeLessThanOrEqual(first.contentWidth + 1);
		expect(measuredWidth(second.fg)).toBeLessThanOrEqual(
			second.contentWidth + 1,
		);
	});

	it("ignores an axis where the bg hugs the fg", () => {
		// bg width grows with font faster than fg, so width never binds;
		// only the fixed height constrains the fit.
		const pair = createPair({
			text: "Wide",
			bgWidth: 60,
			bgHeight: 80,
			widthScaleWithFont: 8,
		});

		squeezeFg(pair.bg);

		expect(measuredHeight(pair.fg)).toBeLessThanOrEqual(pair.contentHeight + 1);
	});

	it("throws when the bg hugs the fg in both axes", () => {
		const pair = createPair({
			text: "Calendar",
			bgWidth: 120,
			bgHeight: 40,
			widthScaleWithFont: 8,
			heightScaleWithFont: 8,
		});
		expect(() => squeezeFg(pair.bg)).toThrow(/could not bracket/);
	});

	it("restores the original inline font size after a failure", () => {
		const pair = createPair({
			text: "Restore",
			bgWidth: 120,
			bgHeight: 40,
			widthScaleWithFont: 8,
			heightScaleWithFont: 8,
		});
		pair.fg.style.fontSize = "20px";

		expect(() => squeezeFg(pair.bg)).toThrow();
		expect(pair.fg.style.fontSize).toBe("20px");
	});
});

function createPair(config: PairConfig): PairFixture {
	const {
		text,
		bgWidth,
		bgHeight,
		padding = 4,
		border = 1,
		widthScaleWithFont = 0,
		heightScaleWithFont = 0,
		left = 0,
		top = 0,
	} = config;

	const bg = document.createElement("div");
	const fg = document.createElement("div");
	const inset = padding + border;

	bg.className = "bg";
	bg.style.padding = `${padding}px`;
	bg.style.border = `${border}px solid transparent`;
	fg.className = "fg";
	fg.style.fontSize = `${BODY_FONT_SIZE}px`;
	fg.textContent = text;
	bg.append(fg);
	document.body.append(bg);

	bg.getBoundingClientRect = () => {
		const fs = readFontSize(fg);
		return new DOMRect(
			left,
			top,
			bgWidth + widthScaleWithFont * (fs - BODY_FONT_SIZE),
			bgHeight + heightScaleWithFont * (fs - BODY_FONT_SIZE),
		);
	};

	fg.getBoundingClientRect = () => {
		const bgRect = bg.getBoundingClientRect();
		const fs = readFontSize(fg);

		if (text.length === 0) {
			return new DOMRect(bgRect.left + inset, bgRect.top + inset, 0, 0);
		}

		const w = WIDTH_FACTOR * fs * text.length;
		const h = HEIGHT_FACTOR * fs;
		const cw = bgRect.width - 2 * inset;
		const ch = bgRect.height - 2 * inset;

		return new DOMRect(
			bgRect.left + inset + (cw - w) / 2,
			bgRect.top + inset + (ch - h) / 2,
			w,
			h,
		);
	};

	return {
		bg,
		fg,
		contentWidth: bgWidth - 2 * inset,
		contentHeight: bgHeight - 2 * inset,
	};
}

function limitingFont(pair: PairFixture, text: string): number {
	return Math.min(
		pair.contentWidth / (WIDTH_FACTOR * text.length),
		pair.contentHeight / HEIGHT_FACTOR,
	);
}

function wrap(...bgs: HTMLDivElement[]): HTMLDivElement {
	const root = document.createElement("div");
	for (const bg of bgs) root.append(bg);
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
