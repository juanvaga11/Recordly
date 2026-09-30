import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_OVERLAY, type WebcamOverlaySettings } from "../types";
import { computePaddedLayout } from "../videoPlayback/layoutUtils";
import { getWebcamOverlayDimensionsPx, getWebcamOverlayPosition } from "../webcamOverlay";
import {
	applyCameraShape,
	buildReelTemplate,
	chartPositionToPadding,
	getCameraShape,
	moveCameraToCorner,
	paddingToChartPosition,
	REEL_TEMPLATES,
	type ReelTemplateId,
	scaleCamera,
} from "./reelTemplates";

const FRAME = { width: 1080, height: 1920 };
// the user's screen recordings are 1728×972 (16:9)
const VIDEO = { width: 1728, height: 972 };

function geometry(id: ReelTemplateId) {
	const webcamIn: WebcamOverlaySettings = {
		...DEFAULT_WEBCAM_OVERLAY,
		enabled: true,
		sourcePath: "/cam.webm",
	};
	const layout = buildReelTemplate(id, webcamIn);
	const chart = computePaddedLayout({
		...FRAME,
		padding: layout.padding,
		cropRegion: layout.cropRegion,
		videoWidth: VIDEO.width,
		videoHeight: VIDEO.height,
	});
	const cam = layout.webcam;
	const margin = (cam.margin * FRAME.width) / 1920;
	const dims = getWebcamOverlayDimensionsPx({
		containerWidth: FRAME.width,
		containerHeight: FRAME.height,
		widthPercent: cam.width,
		heightPercent: cam.height,
		margin,
		zoomScale: 1,
		reactToZoom: cam.reactToZoom,
	});
	const pos = getWebcamOverlayPosition({
		containerWidth: FRAME.width,
		containerHeight: FRAME.height,
		width: dims.width,
		height: dims.height,
		margin,
		positionPreset: cam.positionPreset,
		positionX: cam.positionX,
		positionY: cam.positionY,
		legacyCorner: cam.corner,
	});
	return {
		layout,
		chart: {
			top: chart.centerOffsetY,
			bottom: chart.centerOffsetY + chart.croppedDisplayHeight,
			width: chart.croppedDisplayWidth,
		},
		camera: { top: pos.y, bottom: pos.y + dims.height, left: pos.x, width: dims.width },
	};
}

describe("reel templates", () => {
	it("all templates are 9:16 and keep the recorded webcam", () => {
		for (const template of REEL_TEMPLATES) {
			const { layout } = geometry(template.id);
			expect(layout.aspectRatio).toBe("9:16");
			expect(layout.webcam.sourcePath).toBe("/cam.webm");
			expect(layout.webcam.enabled).toBe(true);
			expect(layout.webcam.reactToZoom).toBe(false);
		}
	});

	it("chart on top, full-width camera filling the bottom", () => {
		const { chart, camera } = geometry("chart-top");
		expect(chart.top).toBeCloseTo(0, 0);
		expect(chart.width).toBeCloseTo(FRAME.width, 0);
		expect(camera.width).toBeCloseTo(FRAME.width, 0);
		expect(camera.bottom).toBeCloseTo(FRAME.height, 0);
		// no gap and no overlap between the two halves (±2%)
		expect(Math.abs(camera.top - chart.bottom)).toBeLessThan(FRAME.height * 0.02);
	});

	it("camera on top, chart at the bottom", () => {
		const { chart, camera } = geometry("camera-top");
		expect(camera.top).toBeCloseTo(0, 0);
		expect(chart.bottom).toBeCloseTo(FRAME.height, 0);
		expect(Math.abs(chart.top - camera.bottom)).toBeLessThan(FRAME.height * 0.02);
	});

	it("small round camera sits on the lower-left corner of the chart", () => {
		const { chart, camera, layout } = geometry("camera-corner");
		expect(layout.webcam.roundness).toBe(100);
		expect(camera.left).toBeLessThan(40);
		expect(camera.bottom).toBeLessThanOrEqual(chart.bottom + 2);
		expect(camera.bottom).toBeGreaterThan(chart.bottom - 60);
	});

	it("chart centered with free space on top and camera at the bottom", () => {
		const { chart, camera } = geometry("chart-center");
		const freeTop = chart.top;
		expect(freeTop).toBeGreaterThan(FRAME.height * 0.2);
		expect(Math.abs(camera.top - chart.bottom)).toBeLessThan(FRAME.height * 0.02);
		expect(camera.bottom).toBeCloseTo(FRAME.height, 0);
	});
});

describe("reel controls", () => {
	it("maps the chart slider to unlinked padding and back", () => {
		expect(chartPositionToPadding(0)).toMatchObject({ top: 0, bottom: 250, linked: false });
		expect(chartPositionToPadding(1)).toMatchObject({ top: 250, bottom: 0 });
		expect(paddingToChartPosition(chartPositionToPadding(0.3))).toBeCloseTo(0.3, 2);
		expect(
			paddingToChartPosition({ top: 20, bottom: 20, left: 20, right: 20, linked: true }),
		).toBe(0.5);
	});

	it("switches camera shapes", () => {
		const rect = { ...DEFAULT_WEBCAM_OVERLAY, width: 100, height: 90, roundness: 0, margin: 0 };
		expect(getCameraShape(rect)).toBe("rectangle");
		const circle = { ...rect, ...applyCameraShape(rect, "circle") };
		expect(getCameraShape(circle)).toBe("circle");
		expect(circle.width).toBe(circle.height);
		expect(circle.width).toBeLessThanOrEqual(60);
		expect(getCameraShape({ ...rect, ...applyCameraShape(rect, "rounded") })).toBe("rounded");
	});

	it("scales the camera keeping proportions within limits", () => {
		const cam = { ...DEFAULT_WEBCAM_OVERLAY, width: 40, height: 30 };
		expect(scaleCamera(cam, 1.5)).toEqual({ width: 60, height: 45, size: 60 });
		expect(scaleCamera(cam, 10).width).toBeLessThanOrEqual(100);
		expect(scaleCamera(cam, 0.01).height).toBeGreaterThanOrEqual(10);
	});
});

describe("logo loop templates", () => {
	it("chart on top with the logo loop below and a small camera in a corner", () => {
		const { layout, chart, camera } = geometry("chart-logo");
		expect(layout.wallpaper).toBe("/wallpapers/sky-logo-abajo.mp4");
		expect(layout.backgroundBlur).toBe(0);
		expect(chart.top).toBeCloseTo(0, 0);
		expect(layout.webcam.roundness).toBe(100);
		expect(camera.top).toBeLessThan(40);
		expect(camera.left).toBeLessThan(40);
		// the camera stays on the chart, the logo band below is free
		expect(camera.bottom).toBeLessThan(chart.bottom);
	});

	it("logo loop on top with the chart below", () => {
		const { layout, chart, camera } = geometry("logo-chart");
		expect(layout.wallpaper).toBe("/wallpapers/sky-logo-arriba.mp4");
		expect(chart.bottom).toBeCloseTo(FRAME.height, 0);
		expect(camera.top).toBeGreaterThan(chart.top);
	});

	it("moves the camera to any corner", () => {
		expect(moveCameraToCorner("top-right")).toMatchObject({ positionX: 1, positionY: 0 });
		expect(moveCameraToCorner("bottom-left")).toMatchObject({ positionX: 0, positionY: 1 });
	});
});
