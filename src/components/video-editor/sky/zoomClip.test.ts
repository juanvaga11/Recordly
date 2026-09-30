import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { applyZoomClip, shouldClipZoomToRecording } from "./zoomClip";

describe("zoom clip", () => {
	it("only clips portrait frames", () => {
		expect(shouldClipZoomToRecording(1080, 1920)).toBe(true);
		expect(shouldClipZoomToRecording(1920, 1080)).toBe(false);
		expect(shouldClipZoomToRecording(1080, 1080)).toBe(false);
	});

	it("masks the camera container in 9:16 and removes the mask in 16:9", () => {
		const stage = new Container();
		const camera = new Container();
		stage.addChild(camera);
		const rect = { x: 0, y: 0, width: 1080, height: 940 };
		const clip = applyZoomClip({
			stage,
			cameraContainer: camera,
			rect,
			stageWidth: 1080,
			stageHeight: 1920,
			current: null,
		});
		expect(clip).not.toBeNull();
		expect(camera.mask).toBe(clip);
		expect(clip?.parent).toBe(stage);
		// reusing the same graphics when the layout changes
		const again = applyZoomClip({
			stage,
			cameraContainer: camera,
			rect: { ...rect, y: 100 },
			stageWidth: 1080,
			stageHeight: 1920,
			current: clip,
		});
		expect(again).toBe(clip);
		const removed = applyZoomClip({
			stage,
			cameraContainer: camera,
			rect,
			stageWidth: 1920,
			stageHeight: 1080,
			current: again,
		});
		expect(removed).toBeNull();
		expect(camera.mask ?? null).toBeNull();
	});
});
