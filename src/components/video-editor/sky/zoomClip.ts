/**
 * SKY Academy: keep zooms inside the chart's box in vertical (9:16) videos.
 *
 * Recordly zooms by scaling the whole "camera" container, so in a split Reel
 * layout the zoomed chart grows over the camera, the logo and the captions.
 * In portrait frames we clip the camera container to the recording's unzoomed
 * rectangle, which is what a split layout needs. Landscape keeps the original
 * full-frame zoom look.
 */
import { type Container, Graphics } from "pixi.js";

export interface ClipRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function shouldClipZoomToRecording(stageWidth: number, stageHeight: number): boolean {
	return stageWidth > 0 && stageHeight > stageWidth * 1.05;
}

/**
 * Applies (or removes) the clip. `current` is the graphics object created by a
 * previous call, returned again so callers can keep it in a ref/field.
 */
export function applyZoomClip({
	stage,
	cameraContainer,
	rect,
	stageWidth,
	stageHeight,
	current,
}: {
	stage: Container;
	cameraContainer: Container;
	rect: ClipRect;
	stageWidth: number;
	stageHeight: number;
	current: Graphics | null;
}): Graphics | null {
	if (
		!shouldClipZoomToRecording(stageWidth, stageHeight) ||
		rect.width <= 0 ||
		rect.height <= 0
	) {
		if (current) {
			if (cameraContainer.mask === current) cameraContainer.mask = null;
			current.parent?.removeChild(current);
			current.destroy();
		}
		return null;
	}
	const graphics = current ?? new Graphics();
	if (!graphics.parent) stage.addChild(graphics);
	graphics.clear();
	graphics.rect(rect.x, rect.y, rect.width, rect.height);
	graphics.fill({ color: 0xffffff });
	cameraContainer.mask = graphics;
	return graphics;
}
