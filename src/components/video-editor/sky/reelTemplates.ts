/**
 * SKY Academy "Diseño Reel": one-click vertical layouts plus the simple
 * controls behind them (chart position, camera shape and size).
 *
 * Everything is expressed with settings Recordly already renders in preview and
 * export: crop, advanced (unlinked) padding to move the chart vertically, and
 * the webcam overlay (position, width/height, roundness).
 */
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import {
	ADVANCED_VERTICAL_PADDING_MAX,
	type CropRegion,
	type Padding,
	type WebcamOverlaySettings,
} from "../types";
import { SKY_REEL_CROP, SKY_WALLPAPER } from "./skyPresets";

export type ReelTemplateId =
	| "chart-top"
	| "camera-top"
	| "camera-corner"
	| "chart-center"
	| "chart-logo"
	| "logo-chart";

/** Looping JulianVal.fx logo animation placed in the free half of a 9:16 frame. */
export const SKY_LOGO_LOOP_BOTTOM = "/wallpapers/sky-logo-abajo.mp4";
export const SKY_LOGO_LOOP_TOP = "/wallpapers/sky-logo-arriba.mp4";

export interface ReelTemplate {
	id: ReelTemplateId;
	label: string;
	description: string;
	/** Tiny diagram for the picker: top → bottom, "chart" | "camera" | "free". */
	bands: Array<{ kind: "chart" | "camera" | "free" | "logo"; size: number }>;
	/** Where the small round camera sits in the diagram (corner templates). */
	cameraDot?: "top-left" | "bottom-left" | "mid-left";
}

export const REEL_TEMPLATES: ReelTemplate[] = [
	{
		id: "chart-top",
		label: "Gráfico arriba",
		description: "Gráfico arriba y su cámara abajo a lo ancho",
		bands: [
			{ kind: "chart", size: 1 },
			{ kind: "camera", size: 1 },
		],
	},
	{
		id: "camera-top",
		label: "Cámara arriba",
		description: "Su cámara arriba a lo ancho y el gráfico abajo",
		bands: [
			{ kind: "camera", size: 1 },
			{ kind: "chart", size: 1 },
		],
	},
	{
		id: "camera-corner",
		label: "Cámara pequeña",
		description: "Gráfico arriba con la cámara en un círculo; abajo queda libre para textos",
		bands: [
			{ kind: "chart", size: 1 },
			{ kind: "free", size: 1 },
		],
		cameraDot: "mid-left",
	},
	{
		id: "chart-logo",
		label: "Gráfico + logo",
		description:
			"Gráfico arriba, su logo animado en bucle abajo y la cámara pequeña en una esquina",
		bands: [
			{ kind: "chart", size: 1 },
			{ kind: "logo", size: 1 },
		],
		cameraDot: "top-left",
	},
	{
		id: "logo-chart",
		label: "Logo + gráfico",
		description:
			"Su logo animado en bucle arriba, el gráfico abajo y la cámara pequeña en una esquina",
		bands: [
			{ kind: "logo", size: 1 },
			{ kind: "chart", size: 1 },
		],
		cameraDot: "bottom-left",
	},
	{
		id: "chart-center",
		label: "Gráfico al centro",
		description: "Espacio arriba para logo o botón, gráfico al centro y cámara abajo",
		bands: [
			{ kind: "free", size: 1 },
			{ kind: "chart", size: 2 },
			{ kind: "camera", size: 1 },
		],
	},
];

export type CameraShape = "circle" | "rounded" | "rectangle";

export interface ReelLayout {
	aspectRatio: AspectRatio;
	/** Wallpaper blur; logo loops must stay sharp. */
	backgroundBlur: number;
	padding: Padding;
	cropRegion: CropRegion;
	borderRadius: number;
	wallpaper: string;
	webcam: WebcamOverlaySettings;
}

/** 0 = chart at the very top, 1 = at the very bottom. */
export function chartPositionToPadding(position: number): Padding {
	const clamped = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0.5));
	const top = Math.round(clamped * ADVANCED_VERTICAL_PADDING_MAX);
	return {
		top,
		bottom: ADVANCED_VERTICAL_PADDING_MAX - top,
		left: 0,
		right: 0,
		linked: false,
	};
}

/** Inverse of chartPositionToPadding for the slider. Linked padding reads as centered. */
export function paddingToChartPosition(padding: Padding): number {
	if (padding.linked !== false) return 0.5;
	const span = padding.top + padding.bottom;
	return span > 0 ? Math.min(1, Math.max(0, padding.top / span)) : 0.5;
}

/** Recordly's horizontal padding: 100% on one side takes 20% of the frame width. */
const PADDING_SIDE_SHARE = 0.2;

/** Share of the frame width the chart can use with the current side padding (0.6–1). */
export function chartWidthShare(padding: Padding): number {
	const side = (Math.min(100, Math.max(0, padding.left)) / 100) * PADDING_SIDE_SHARE;
	const other = (Math.min(100, Math.max(0, padding.right)) / 100) * PADDING_SIDE_SHARE;
	return Math.max(0, 1 - side - other);
}

/** Moves the chart vertically (0 top … 1 bottom) keeping its width. */
export function moveChart(padding: Padding, position: number): Padding {
	return { ...chartPositionToPadding(position), left: padding.left, right: padding.right };
}

/**
 * Resizes the chart by `factor` using side padding. The chart can shrink to
 * 60% of the frame width and grow back up to the full width.
 */
export function resizeChart(padding: Padding, factor: number): Padding {
	const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
	const share = Math.min(
		1,
		Math.max(1 - 2 * PADDING_SIDE_SHARE, chartWidthShare(padding) * safe),
	);
	const side = Math.round(((1 - share) / 2 / PADDING_SIDE_SHARE) * 1000) / 10;
	const vertical =
		padding.linked === false
			? padding
			: chartPositionToPadding(paddingToChartPosition(padding));
	return { ...vertical, left: side, right: side, linked: false };
}

/**
 * Size of the chart band when the screen recording (16:9) is cropped with the
 * Reel crop and fills the width of a 9:16 frame, as a share of frame height.
 */
function chartBandShare(crop: CropRegion, sourceAspect = 16 / 9, frameAspect = 9 / 16): number {
	const cropAspect = (crop.width * sourceAspect) / Math.max(0.001, crop.height);
	return Math.min(1, frameAspect / cropAspect);
}

/** Webcam height as Recordly measures it: % of the frame's short side (its width in 9:16). */
function bandToWebcamHeightPercent(bandShare: number, frameAspect = 9 / 16): number {
	return Math.round(Math.min(100, Math.max(10, (bandShare / frameAspect) * 100)));
}

const RECTANGLE_CAMERA = {
	roundness: 0,
	shadow: 0,
	margin: 0,
	reactToZoom: false,
} as const;

export function buildReelTemplate(
	id: ReelTemplateId,
	currentWebcam: WebcamOverlaySettings,
): ReelLayout {
	const cropRegion = { ...SKY_REEL_CROP };
	const chartShare = chartBandShare(cropRegion);
	const base = {
		aspectRatio: "9:16" as AspectRatio,
		cropRegion,
		borderRadius: 0,
		wallpaper: SKY_WALLPAPER,
		backgroundBlur: 0,
	};

	switch (id) {
		case "chart-top": {
			const height = bandToWebcamHeightPercent(1 - chartShare);
			return {
				...base,
				padding: chartPositionToPadding(0),
				webcam: {
					...currentWebcam,
					...RECTANGLE_CAMERA,
					positionPreset: "bottom-center",
					positionX: 0.5,
					positionY: 1,
					size: 100,
					width: 100,
					height,
				},
			};
		}
		case "camera-top": {
			const height = bandToWebcamHeightPercent(1 - chartShare);
			return {
				...base,
				padding: chartPositionToPadding(1),
				webcam: {
					...currentWebcam,
					...RECTANGLE_CAMERA,
					positionPreset: "top-center",
					positionX: 0.5,
					positionY: 0,
					size: 100,
					width: 100,
					height,
				},
			};
		}
		case "camera-corner": {
			// circle overlapping the bottom-left corner of the chart
			const size = 34;
			const margin = 24;
			const frameHeightInWidths = 16 / 9;
			const cameraShareOfHeight = size / 100 / frameHeightInWidths;
			const marginShare = margin / 1080 / frameHeightInWidths;
			const available = 1 - cameraShareOfHeight - marginShare * 2;
			const targetTop = Math.max(0, chartShare - cameraShareOfHeight - marginShare);
			const positionY = Math.min(1, Math.max(0, (targetTop - marginShare) / available));
			return {
				...base,
				padding: chartPositionToPadding(0),
				webcam: {
					...currentWebcam,
					positionPreset: "custom",
					positionX: 0,
					positionY: Math.round(positionY * 1000) / 1000,
					size,
					width: size,
					height: size,
					roundness: 100,
					shadow: 0.4,
					margin,
					reactToZoom: false,
				},
			};
		}
		case "chart-logo":
		case "logo-chart": {
			const chartOnTop = id === "chart-logo";
			const size = 30;
			return {
				...base,
				wallpaper: chartOnTop ? SKY_LOGO_LOOP_BOTTOM : SKY_LOGO_LOOP_TOP,
				padding: chartPositionToPadding(chartOnTop ? 0 : 1),
				webcam: {
					...currentWebcam,
					// over the oldest candles (left side) so the latest price stays visible
					positionPreset: chartOnTop ? "top-left" : "bottom-left",
					corner: chartOnTop ? "top-left" : "bottom-left",
					positionX: 0,
					positionY: chartOnTop ? 0 : 1,
					size,
					width: size,
					height: size,
					roundness: 100,
					shadow: 0.4,
					margin: 24,
					reactToZoom: false,
				},
			};
		}
		case "chart-center": {
			const freeBand = (1 - chartShare) / 2;
			const height = bandToWebcamHeightPercent(freeBand);
			return {
				...base,
				padding: chartPositionToPadding(0.5),
				webcam: {
					...currentWebcam,
					...RECTANGLE_CAMERA,
					positionPreset: "bottom-center",
					positionX: 0.5,
					positionY: 1,
					size: 100,
					width: 100,
					height,
				},
			};
		}
	}
}

/** Changes the camera outline while keeping its size and place. */
export function applyCameraShape(
	webcam: WebcamOverlaySettings,
	shape: CameraShape,
): Partial<WebcamOverlaySettings> {
	if (shape === "circle") {
		const side = Math.min(webcam.width, webcam.height, 60);
		return {
			roundness: 100,
			width: side,
			height: side,
			size: side,
			margin: Math.max(webcam.margin, 16),
		};
	}
	if (shape === "rounded") return { roundness: 35 };
	return { roundness: 0 };
}

export function getCameraShape(webcam: WebcamOverlaySettings): CameraShape {
	if (webcam.roundness >= 90 && Math.abs(webcam.width - webcam.height) < 0.5) return "circle";
	if (webcam.roundness > 5) return "rounded";
	return "rectangle";
}

/** Scales the camera keeping its proportions (used by the size slider and mouse wheel). */
export function scaleCamera(
	webcam: WebcamOverlaySettings,
	factor: number,
): Partial<WebcamOverlaySettings> {
	const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
	const ratio = webcam.height / Math.max(1, webcam.width);
	let width = Math.min(100, Math.max(10, webcam.width * safe));
	let height = width * ratio;
	if (height > 100) {
		height = 100;
		width = height / ratio;
	}
	if (height < 10) {
		height = 10;
		width = height / ratio;
	}
	const round = (value: number) => Math.round(value * 10) / 10;
	return { width: round(width), height: round(height), size: round(width) };
}

export type CameraCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Snaps the camera to a corner of the frame (keeps size and shape). */
export function moveCameraToCorner(corner: CameraCorner): Partial<WebcamOverlaySettings> {
	return {
		positionPreset: corner,
		corner,
		positionX: corner.endsWith("right") ? 1 : 0,
		positionY: corner.startsWith("bottom") ? 1 : 0,
	};
}
