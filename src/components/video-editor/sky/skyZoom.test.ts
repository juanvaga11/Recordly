import { beforeEach, describe, expect, it } from "vitest";
import type { ZoomRegion } from "../types";
import {
	buildFollowMouseZoom,
	getPreferredZoomDepth,
	hasFollowMouseZoom,
	SKY_DEFAULT_ZOOM_DEPTH,
	setAllZoomDepth,
	setPreferredZoomDepth,
	zoomScaleLabel,
} from "./skyZoom";

const region = (id: string, depth: ZoomRegion["depth"]): ZoomRegion => ({
	id,
	startMs: 0,
	endMs: 1000,
	depth,
	focus: { cx: 0.3, cy: 0.4 },
	mode: "auto",
});

describe("skyZoom", () => {
	beforeEach(() => {
		try {
			globalThis.localStorage?.clear();
		} catch {
			/* no storage in this environment */
		}
	});

	it("labels zoom scales", () => {
		expect(zoomScaleLabel(3)).toBe("1.8×");
		expect(zoomScaleLabel(5)).toBe("3.5×");
	});

	it("applies one level to every zoom and keeps their focus", () => {
		const result = setAllZoomDepth([region("zoom-1", 2), region("zoom-2", 1)], 4);
		expect(result.map((r) => r.depth)).toEqual([4, 4]);
		expect(result[0]?.focus).toEqual({ cx: 0.3, cy: 0.4 });
	});

	it("builds a single auto zoom covering the whole video", () => {
		const [zoom] = buildFollowMouseZoom(57_800.4, 4);
		expect(zoom).toMatchObject({ startMs: 0, endMs: 57_800, depth: 4, mode: "auto" });
		expect(hasFollowMouseZoom(buildFollowMouseZoom(1000, 3))).toBe(true);
		expect(buildFollowMouseZoom(0, 3)).toEqual([]);
	});

	it("remembers the preferred level and falls back to the SKY default", () => {
		expect(getPreferredZoomDepth()).toBe(SKY_DEFAULT_ZOOM_DEPTH);
		setPreferredZoomDepth(5);
		if (globalThis.localStorage) expect(getPreferredZoomDepth()).toBe(5);
	});
});
