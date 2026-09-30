/**
 * SKY Academy: captions anywhere on the frame. Recordly positions captions by
 * `bottomOffset` (% of frame height from the bottom); upstream capped it at
 * 30%, which keeps captions on top of the logo / camera in split Reels.
 */
export const SKY_CAPTION_MAX_OFFSET = 92;

export type CaptionSpot = "top" | "middle" | "bottom";

export const CAPTION_SPOTS: Record<CaptionSpot, { label: string; bottomOffset: number }> = {
	top: { label: "Arriba", bottomOffset: 82 },
	middle: { label: "Centro", bottomOffset: 46 },
	bottom: { label: "Abajo", bottomOffset: 6 },
};

export function clampCaptionOffset(value: number): number {
	if (!Number.isFinite(value)) return 3;
	return Math.round(Math.min(SKY_CAPTION_MAX_OFFSET, Math.max(0, value)) * 10) / 10;
}

/** New offset after dragging the caption vertically by `deltaPx` (down is positive). */
export function dragCaptionOffset(
	startOffset: number,
	deltaPx: number,
	frameHeightPx: number,
): number {
	if (!Number.isFinite(frameHeightPx) || frameHeightPx <= 0)
		return clampCaptionOffset(startOffset);
	return clampCaptionOffset(startOffset - (deltaPx / frameHeightPx) * 100);
}

export function closestCaptionSpot(offset: number): CaptionSpot {
	let best: CaptionSpot = "bottom";
	let distance = Number.POSITIVE_INFINITY;
	for (const [spot, value] of Object.entries(CAPTION_SPOTS) as Array<
		[CaptionSpot, { bottomOffset: number }]
	>) {
		const d = Math.abs(value.bottomOffset - offset);
		if (d < distance) {
			distance = d;
			best = spot;
		}
	}
	return best;
}
