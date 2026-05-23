export const DIV_STABILITY_TOLERANCE_PX = 1;

export type FitAxis = "both" | "width" | "height";

export type DivTarget = {
	initialWidth: number;
	initialHeight: number;
	insetLeft: number;
	insetRight: number;
	insetTop: number;
	insetBottom: number;
};

export type FitAssessment = {
	fits: boolean;
	minGap: number;
};

export function measureDivTarget(div: HTMLDivElement, axis: FitAxis): DivTarget {
	const rect = div.getBoundingClientRect();
	const style = getComputedStyle(div);
	const insetLeft =
		parsePixelValue(style.borderLeftWidth) + parsePixelValue(style.paddingLeft);
	const insetRight =
		parsePixelValue(style.borderRightWidth) + parsePixelValue(style.paddingRight);
	const insetTop =
		parsePixelValue(style.borderTopWidth) + parsePixelValue(style.paddingTop);
	const insetBottom =
		parsePixelValue(style.borderBottomWidth) + parsePixelValue(style.paddingBottom);

	const contentWidth = rect.width - insetLeft - insetRight;
	const contentHeight = rect.height - insetTop - insetBottom;

	if ((axis === "both" || axis === "width") && contentWidth <= 0) {
		throw new Error("squeezeText requires each div to have a positive content width.");
	}

	if ((axis === "both" || axis === "height") && contentHeight <= 0) {
		throw new Error("squeezeText requires each div to have a positive content box.");
	}

	return {
		initialWidth: rect.width,
		initialHeight: rect.height,
		insetLeft,
		insetRight,
		insetTop,
		insetBottom,
	};
}

export function assertAtLeastOneSpanRenders(spans: HTMLSpanElement[]): void {
	const anyRenderableSpan = spans.some((span) => {
		const rect = span.getBoundingClientRect();
		return rect.width > 0 || rect.height > 0;
	});

	if (!anyRenderableSpan) {
		throw new Error("squeezeText requires at least one span to render measurable text.");
	}
}

export function assertDivsStable(
	divs: HTMLDivElement[],
	divTargets: DivTarget[],
	axis: FitAxis,
): void {
	for (let index = 0; index < divs.length; index += 1) {
		const rect = divs[index].getBoundingClientRect();
		const target = divTargets[index];
		const widthDelta = Math.abs(rect.width - target.initialWidth);
		const heightDelta = Math.abs(rect.height - target.initialHeight);

		if ((axis === "both" || axis === "width") && widthDelta > DIV_STABILITY_TOLERANCE_PX) {
			throw new Error(
				`squeezeText requires div ${index} to stay size-stable while fitting text.`,
			);
		}

		if ((axis === "both" || axis === "height") && heightDelta > DIV_STABILITY_TOLERANCE_PX) {
			throw new Error(
				`squeezeText requires div ${index} to stay size-stable while fitting text.`,
			);
		}
	}
}

export function measureFit(
	divs: HTMLDivElement[],
	spans: HTMLSpanElement[],
	divTargets: DivTarget[],
	axis: FitAxis,
): FitAssessment {
	let minGap = Number.POSITIVE_INFINITY;

	for (let index = 0; index < divs.length; index += 1) {
		const divRect = divs[index].getBoundingClientRect();
		const spanRect = spans[index].getBoundingClientRect();
		const target = divTargets[index];
		const contentLeft = divRect.left + target.insetLeft;
		const contentRight = divRect.right - target.insetRight;
		const contentTop = divRect.top + target.insetTop;
		const contentBottom = divRect.bottom - target.insetBottom;
		const pairMinGap = measurePairGap(
			spanRect,
			contentLeft,
			contentRight,
			contentTop,
			contentBottom,
			axis,
		);

		minGap = Math.min(minGap, pairMinGap);
	}

	return {
		fits: minGap >= 0,
		minGap,
	};
}

function measurePairGap(
	spanRect: DOMRect,
	contentLeft: number,
	contentRight: number,
	contentTop: number,
	contentBottom: number,
	axis: FitAxis,
): number {
	if (axis === "width") {
		return Math.min(spanRect.left - contentLeft, contentRight - spanRect.right);
	}

	if (axis === "height") {
		return Math.min(spanRect.top - contentTop, contentBottom - spanRect.bottom);
	}

	return Math.min(
		spanRect.left - contentLeft,
		contentRight - spanRect.right,
		spanRect.top - contentTop,
		contentBottom - spanRect.bottom,
	);
}

function parsePixelValue(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
