import { describe, expect, it } from "vitest";
import {
	CAPTION_SPOTS,
	clampCaptionOffset,
	closestCaptionSpot,
	dragCaptionOffset,
	SKY_CAPTION_MAX_OFFSET,
} from "./captionPosition";

describe("caption position", () => {
	it("allows captions near the top of the frame", () => {
		expect(clampCaptionOffset(200)).toBe(SKY_CAPTION_MAX_OFFSET);
		expect(clampCaptionOffset(-5)).toBe(0);
		expect(CAPTION_SPOTS.top.bottomOffset).toBeGreaterThan(30);
	});

	it("drags up and down relative to the frame height", () => {
		// dragging 192px up on a 1920px frame raises the caption by 10%
		expect(dragCaptionOffset(6, -192, 1920)).toBe(16);
		expect(dragCaptionOffset(6, 500, 1920)).toBe(0);
	});

	it("finds the closest preset", () => {
		expect(closestCaptionSpot(3)).toBe("bottom");
		expect(closestCaptionSpot(50)).toBe("middle");
		expect(closestCaptionSpot(90)).toBe("top");
	});
});
