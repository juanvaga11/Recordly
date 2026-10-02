/**
 * SKY Academy "Marcar zona de zoom": the user draws a rectangle over the part
 * of the chart that matters and the zoom goes exactly there (manual focus),
 * as close as possible while the whole rectangle stays visible.
 */
import { ZOOM_DEPTH_SCALES, type ZoomDepth, type ZoomFocus, type ZoomRegion } from "../types";
import { SKY_FOLLOW_ZOOM_ID } from "./skyZoom";

export interface NormalizedRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Converts a rectangle drawn on screen (overlay pixels) to the recording's
 * normalized coordinates, undoing the zoom that was on screen while drawing.
 */
export function screenRectToRecordingRect(
	screen: { x: number; y: number; width: number; height: number },
	transform: { scale: number; x: number; y: number },
	baseMask: { x: number; y: number; width: number; height: number },
): NormalizedRect {
	const scale = transform.scale > 0 ? transform.scale : 1;
	const toStage = (px: number, py: number) => ({
		x: (px - transform.x) / scale,
		y: (py - transform.y) / scale,
	});
	const a = toStage(screen.x, screen.y);
	const b = toStage(screen.x + screen.width, screen.y + screen.height);
	const left = clamp01((Math.min(a.x, b.x) - baseMask.x) / Math.max(1, baseMask.width));
	const right = clamp01((Math.max(a.x, b.x) - baseMask.x) / Math.max(1, baseMask.width));
	const top = clamp01((Math.min(a.y, b.y) - baseMask.y) / Math.max(1, baseMask.height));
	const bottom = clamp01((Math.max(a.y, b.y) - baseMask.y) / Math.max(1, baseMask.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

const DEPTHS = (Object.keys(ZOOM_DEPTH_SCALES).map(Number) as ZoomDepth[]).sort((a, b) => a - b);

/** Closest zoom that still shows the whole rectangle, and its focus point. */
export function zoomForArea(area: NormalizedRect): { depth: ZoomDepth; focus: ZoomFocus } {
	const width = Math.max(0.02, area.width);
	const height = Math.max(0.02, area.height);
	const maxScale = Math.min(1 / width, 1 / height);
	let depth: ZoomDepth = DEPTHS[0] ?? 1;
	for (const candidate of DEPTHS) {
		if (ZOOM_DEPTH_SCALES[candidate] <= maxScale + 1e-6) depth = candidate;
	}
	const scale = ZOOM_DEPTH_SCALES[depth];
	const margin = 1 / (2 * scale);
	const clampFocus = (value: number) => Math.min(1 - margin, Math.max(margin, value));
	return {
		depth,
		focus: {
			cx: Math.round(clampFocus(area.x + width / 2) * 1000) / 1000,
			cy: Math.round(clampFocus(area.y + height / 2) * 1000) / 1000,
		},
	};
}

export const SKY_AREA_ZOOM_ID_PREFIX = "zoom-sky-area";
/** Long zooms (like "seguir el mouse") are split instead of being taken over. */
const SPLIT_LONGER_THAN_MS = 6000;
const MIN_PIECE_MS = 300;
export const AREA_ZOOM_DURATION_MS = 3000;

export interface AreaZoomResult {
	regions: ZoomRegion[];
	/** The zoom that now points at the area. */
	zoomId: string;
	created: boolean;
}

/**
 * Points a zoom at `area`:
 * - the selected zoom, if any, is updated;
 * - else the zoom under the playhead (a long one is split so only ~3 s change);
 * - else a new 3 s zoom starts at the playhead.
 */
export function applyZoomArea(
	regions: ZoomRegion[],
	area: NormalizedRect,
	options: {
		playheadMs: number;
		timelineEndMs: number;
		selectedZoomId?: string | null;
		idSeed?: string | number;
	},
): AreaZoomResult {
	const { depth, focus } = zoomForArea(area);
	const seed = options.idSeed ?? Date.now();
	const point = (region: ZoomRegion): ZoomRegion => ({
		...region,
		depth,
		focus,
		mode: "manual",
	});

	const selected = options.selectedZoomId
		? regions.find((region) => region.id === options.selectedZoomId)
		: undefined;
	if (selected) {
		return {
			regions: regions.map((region) => (region.id === selected.id ? point(region) : region)),
			zoomId: selected.id,
			created: false,
		};
	}

	const t = Math.max(0, Math.round(options.playheadMs));
	const covering = regions.find((region) => t >= region.startMs && t < region.endMs);
	if (covering && covering.endMs - covering.startMs <= SPLIT_LONGER_THAN_MS) {
		return {
			regions: regions.map((region) => (region.id === covering.id ? point(region) : region)),
			zoomId: covering.id,
			created: false,
		};
	}

	if (covering) {
		const pieceEnd = Math.min(covering.endMs, t + AREA_ZOOM_DURATION_MS);
		const pieceStart = t - covering.startMs < MIN_PIECE_MS ? covering.startMs : t;
		const zoomId = `${SKY_AREA_ZOOM_ID_PREFIX}-${seed}`;
		const pieces: ZoomRegion[] = [];
		if (pieceStart > covering.startMs) pieces.push({ ...covering, endMs: pieceStart });
		pieces.push(point({ ...covering, id: zoomId, startMs: pieceStart, endMs: pieceEnd }));
		if (covering.endMs - pieceEnd >= MIN_PIECE_MS) {
			const restId = covering.id.startsWith(SKY_FOLLOW_ZOOM_ID)
				? `${SKY_FOLLOW_ZOOM_ID}-${seed}`
				: `${covering.id}-${seed}`;
			pieces.push({ ...covering, id: restId, startMs: pieceEnd });
		} else if (pieceEnd < covering.endMs) {
			pieces[pieces.length - 1] = { ...pieces[pieces.length - 1]!, endMs: covering.endMs };
		}
		return {
			regions: regions.flatMap((region) => (region.id === covering.id ? pieces : [region])),
			zoomId,
			created: true,
		};
	}

	const next = regions
		.filter((region) => region.startMs > t)
		.sort((a, b) => a.startMs - b.startMs)[0];
	const end = Math.min(
		t + AREA_ZOOM_DURATION_MS,
		next ? next.startMs : Number.POSITIVE_INFINITY,
		Math.max(t + MIN_PIECE_MS, Math.round(options.timelineEndMs)),
	);
	const zoomId = `${SKY_AREA_ZOOM_ID_PREFIX}-${seed}`;
	return {
		regions: [
			...regions,
			{
				id: zoomId,
				startMs: t,
				endMs: Math.max(t + MIN_PIECE_MS, end),
				depth,
				focus,
				mode: "manual",
			},
		],
		zoomId,
		created: true,
	};
}
