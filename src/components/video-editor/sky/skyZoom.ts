/**
 * SKY Academy zoom controls: how close the camera gets to the chart and a
 * one-click "follow the mouse the whole video" zoom.
 *
 * In 9:16 Reels the zoom is clipped to the chart band (zoomClip.ts), so strong
 * zooms no longer spill over the camera or the logo.
 */
import { ZOOM_DEPTH_SCALES, type ZoomDepth, type ZoomRegion } from "../types";

export interface SkyZoomLevel {
	depth: ZoomDepth;
	label: string;
	hint: string;
}

export const SKY_ZOOM_LEVELS: SkyZoomLevel[] = [
	{ depth: 2, label: "Suave", hint: "Se ve casi todo el gráfico" },
	{ depth: 3, label: "Medio", hint: "Recomendado para SMC: zona + contexto" },
	{ depth: 4, label: "Fuerte", hint: "Velas grandes, poco contexto" },
	{ depth: 5, label: "Máximo", hint: "Solo la zona donde está el mouse" },
];

/** SKY default: 1.8×. The chart band is small in 9:16, 1.5× felt far away. */
export const SKY_DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;
const PREFERENCE_KEY = "sky.zoomDepth";

export function zoomScaleLabel(depth: ZoomDepth): string {
	return `${ZOOM_DEPTH_SCALES[depth].toFixed(1).replace(/\.0$/, "")}×`;
}

function isZoomDepth(value: unknown): value is ZoomDepth {
	return typeof value === "number" && value in ZOOM_DEPTH_SCALES;
}

/** Zoom level used for new zooms (last one chosen in the menu). */
export function getPreferredZoomDepth(): ZoomDepth {
	try {
		const stored = Number(globalThis.localStorage?.getItem(PREFERENCE_KEY));
		return isZoomDepth(stored) ? stored : SKY_DEFAULT_ZOOM_DEPTH;
	} catch {
		return SKY_DEFAULT_ZOOM_DEPTH;
	}
}

export function setPreferredZoomDepth(depth: ZoomDepth): void {
	try {
		globalThis.localStorage?.setItem(PREFERENCE_KEY, String(depth));
	} catch {
		// preference is a convenience only
	}
}

/** Same zoom level for every zoom of the video. */
export function setAllZoomDepth(regions: ZoomRegion[], depth: ZoomDepth): ZoomRegion[] {
	return regions.map((region) => ({ ...region, depth }));
}

export const SKY_FOLLOW_ZOOM_ID = "zoom-sky-follow";

/**
 * One zoom from start to end in "auto" mode: the camera stays close to the
 * chart and slides to wherever the mouse goes.
 */
export function buildFollowMouseZoom(timelineDurationMs: number, depth: ZoomDepth): ZoomRegion[] {
	const endMs = Math.round(timelineDurationMs);
	if (!Number.isFinite(endMs) || endMs <= 0) return [];
	return [
		{
			id: SKY_FOLLOW_ZOOM_ID,
			startMs: 0,
			endMs,
			depth,
			focus: { cx: 0.5, cy: 0.5 },
			mode: "auto",
		},
	];
}

export function hasFollowMouseZoom(regions: ZoomRegion[]): boolean {
	return regions.some((region) => isFollowMouseZoom(region));
}

/** Pieces of a split "follow the mouse" zoom keep the same id prefix. */
export function isFollowMouseZoom(region: Pick<ZoomRegion, "id">): boolean {
	return region.id.startsWith(SKY_FOLLOW_ZOOM_ID);
}
