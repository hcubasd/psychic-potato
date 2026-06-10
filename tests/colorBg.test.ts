import { matchGrays, type RgbColor } from "miniature-waffle";
import { afterEach, describe, expect, it } from "vitest";

import { colorBg } from "../src/index.js";

describe("colorBg", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("throws when no bg div exists in the tree", () => {
		const root = document.createElement("div");
		const child = document.createElement("div");
		root.append(child);
		document.body.append(root);
		expect(() => colorBg(root)).toThrow(/no element with class "bg"/);
	});

	it("colors a single bg layer with the startL gray", () => {
		const root = bg();
		document.body.append(root);

		colorBg(root);

		const [start] = matchGrays(1, 0, 100);
		expect(root.style.backgroundColor).toBe(expectedBg(start));
	});

	it("maps depth to grays: outer=startL, inner=endL", () => {
		const root = bg();
		const inner = bg();
		root.append(inner);
		document.body.append(root);

		colorBg(root);

		const grays = matchGrays(2, 0, 100);
		expect(root.style.backgroundColor).toBe(expectedBg(grays[0]));
		expect(inner.style.backgroundColor).toBe(expectedBg(grays[1]));
	});

	it("steps three nested layers through the gray ramp", () => {
		const root = bg();
		const mid = bg();
		const leaf = bg();
		mid.append(leaf);
		root.append(mid);
		document.body.append(root);

		colorBg(root);

		const grays = matchGrays(3, 0, 100);
		expect(root.style.backgroundColor).toBe(expectedBg(grays[0]));
		expect(mid.style.backgroundColor).toBe(expectedBg(grays[1]));
		expect(leaf.style.backgroundColor).toBe(expectedBg(grays[2]));
	});

	it("gives siblings at the same depth the same color", () => {
		const root = bg();
		const a = bg();
		const b = bg();
		root.append(a, b);
		document.body.append(root);

		colorBg(root);

		expect(a.style.backgroundColor).toBe(b.style.backgroundColor);
		expect(root.style.backgroundColor).not.toBe(a.style.backgroundColor);
	});

	it("uses the deepest branch to size the ramp", () => {
		// One branch is 3 deep, another only 2; ramp must span all 3 levels.
		const root = bg();
		const deep = bg();
		const leaf = bg();
		const shallow = bg();
		deep.append(leaf);
		root.append(deep, shallow);
		document.body.append(root);

		colorBg(root);

		const grays = matchGrays(3, 0, 100);
		expect(root.style.backgroundColor).toBe(expectedBg(grays[0]));
		expect(deep.style.backgroundColor).toBe(expectedBg(grays[1]));
		expect(shallow.style.backgroundColor).toBe(expectedBg(grays[1]));
		expect(leaf.style.backgroundColor).toBe(expectedBg(grays[2]));
	});

	it("respects a custom from/to range", () => {
		const root = bg();
		const inner = bg();
		root.append(inner);
		document.body.append(root);

		colorBg(root, { from: 0.2, to: 0.8 });

		const grays = matchGrays(2, 20, 80);
		expect(root.style.backgroundColor).toBe(expectedBg(grays[0]));
		expect(inner.style.backgroundColor).toBe(expectedBg(grays[1]));
	});

	it("returns the number of distinct depth levels", () => {
		const root = bg();
		const mid = bg();
		const leaf = bg();
		mid.append(leaf);
		root.append(mid);
		document.body.append(root);

		const depth = colorBg(root);

		expect(depth).toBe(3);
	});

	it("returns 1 for a single bg layer", () => {
		const root = bg();
		document.body.append(root);

		expect(colorBg(root)).toBe(1);
	});

	it("ignores non-bg divs when counting depth", () => {
		// A plain wrapper between bg layers must not add a depth level.
		const root = bg();
		const wrapper = document.createElement("div");
		const inner = bg();
		wrapper.append(inner);
		root.append(wrapper);
		document.body.append(root);

		colorBg(root);

		const grays = matchGrays(2, 0, 100);
		expect(root.style.backgroundColor).toBe(expectedBg(grays[0]));
		expect(inner.style.backgroundColor).toBe(expectedBg(grays[1]));
	});
});

function bg(): HTMLDivElement {
	const div = document.createElement("div");
	div.className = "bg";
	return div;
}

function expectedBg(color: RgbColor): string {
	const probe = document.createElement("div");
	probe.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
	return probe.style.backgroundColor;
}
