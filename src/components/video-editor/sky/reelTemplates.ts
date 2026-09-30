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

export type ReelTemplateId = "chart-top" | "camera-top" | "camera-corner" | "chart-center";

export interface ReelTemplate {
	id: ReelTemplateId;
	label: string;
	description: string;
	/** Tiny diagram for the picker: top → bottom, "chart" | "camera" | "free". */
	bands: Array<{ kind: "chart" | "camera" | "free"; size: number }>;
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
