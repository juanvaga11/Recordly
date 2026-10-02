import { describe, expect, it } from "vitest";
import type { ZoomRegion } from "../types";
import { buildFollowMouseZoom } from "./skyZoom";
import { applyZoomArea, screenRectToRecordingRect, zoomForArea } from "./zoomArea";

const mask = { x: 0, y: 100, width: 500, height: 300 };

describe("screenRectToRecordingRect", () => {
	it("maps an unzoomed rectangle to the recording", () => {
		const rect = screenRectToRecordingRect(
			{ x: 250, y: 175, width: 125, height: 75 },
			{ scale: 1, x: 0, y: 0 },
			mask,
		);
		expect(rect).toEqual({ x: 0.5, y: 0.25, width: 0.25, height: 0.25 });
	});

	it("undoes the zoom that was on screen and accepts drags in any direction", () => {
		const rect = screenRectToRecordingRect(
			{ x: 300, y: 300, width: -100, height: -100 },
			{ scale: 2, x: -200, y: -200 },
			mask,
		);
		expect(rect.x).toBeCloseTo(0.4);
		expect(rect.y).toBeCloseTo(1 / 3);
		expect(rect.width).toBeCloseTo(0.1);
	});
});

describe("zoomForArea", () => {
	it("zooms as close as possible while the whole area stays visible", () => {
		expect(zoomForArea({ x: 0.6, y: 0.3, width: 0.3, height: 0.3 }).depth).toBe(4); // 2.2× ≤ 3.33
		expect(zoomForArea({ x: 0.1, y: 0.1, width: 0.6, height: 0.2 }).depth).toBe(2); // 1.5× ≤ 1.66
		expect(zoomForArea({ x: 0.45, y: 0.45, width: 0.05, height: 0.05 }).depth).toBe(6);
	});

	it("keeps the focus where the zoomed view stays inside the recording", () => {
		const { focus, depth } = zoomForArea({ x: 0.9, y: 0.0, width: 0.1, height: 0.1 });
		expect(depth).toBe(6);
		expect(focus.cx).toBeLessThanOrEqual(0.9);
		expect(focus.cy).toBeGreaterThanOrEqual(0.1);
	});
});

describe("applyZoomArea", () => {
	const area = { x: 0.6, y: 0.3, width: 0.3, height: 0.3 };

	it("creates a 3 s manual zoom at the playhead when there is none", () => {
		const result = applyZoomArea([], area, {
			playheadMs: 5000,
			timelineEndMs: 60_000,
			idSeed: "a",
		});
		expect(result.created).toBe(true);
		expect(result.regions[0]).toMatchObject({
			startMs: 5000,
			endMs: 8000,
			mode: "manual",
			depth: 4,
		});
	});

	it("updates the selected zoom", () => {
		const zoom: ZoomRegion = {
			id: "zoom-1",
			startMs: 0,
			endMs: 2000,
			depth: 2,
			focus: { cx: 0.5, cy: 0.5 },
			mode: "auto",
		};
		const result = applyZoomArea([zoom], area, {
			playheadMs: 9000,
			timelineEndMs: 60_000,
			selectedZoomId: "zoom-1",
		});
		expect(result.regions).toHaveLength(1);
		expect(result.regions[0]).toMatchObject({ id: "zoom-1", mode: "manual", depth: 4 });
	});

	it("splits a long 'follow the mouse' zoom so only that moment points at the area", () => {
		const follow = buildFollowMouseZoom(50_000, 3);
		const result = applyZoomArea(follow, area, {
			playheadMs: 20_000,
			timelineEndMs: 50_000,
			idSeed: "s",
		});
		expect(result.regions.map((r) => [r.startMs, r.endMs, r.mode])).toEqual([
			[0, 20_000, "auto"],
			[20_000, 23_000, "manual"],
			[23_000, 50_000, "auto"],
		]);
		expect(new Set(result.regions.map((r) => r.id)).size).toBe(3);
	});

	it("never overlaps the next zoom", () => {
		const next: ZoomRegion = {
			id: "zoom-2",
			startMs: 6000,
			endMs: 7000,
			depth: 2,
			focus: { cx: 0.5, cy: 0.5 },
		};
		const result = applyZoomArea([next], area, {
			playheadMs: 5000,
			timelineEndMs: 60_000,
			idSeed: "n",
		});
		expect(result.regions.find((r) => r.id === result.zoomId)?.endMs).toBe(6000);
	});
});
