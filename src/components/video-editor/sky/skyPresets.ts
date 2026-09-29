/**
 * SKY Academy / JulianVal.fx brand kit for the Recordly editor.
 *
 * Everything here is pure data + pure functions so it can be unit tested and
 * reused by the annotation panel and the "Vertical Reels" preset button.
 */
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type {
	AnnotationRegion,
	AnnotationTextStyle,
	CropRegion,
	Padding,
	WebcamOverlaySettings,
} from "../types";

export const SKY_GOLD = "#D4AF37";
export const SKY_GOLD_LIGHT = "#F5E6B3";
export const SKY_BLACK = "#0A0A0A";
export const SKY_GREEN = "#10B981";
export const SKY_RED = "#EF4444";
export const SKY_FONT = "Arial, sans-serif";

export const SKY_WALLPAPER = "/wallpapers/sky-negro-dorado.jpg";

/** A patch applied on top of the selected annotation. */
export type SkyAnnotationPatch = Partial<Omit<AnnotationRegion, "id" | "style">> & {
	style?: Partial<AnnotationTextStyle>;
	/** When true, the annotation is stretched to cover the whole video. */
	fullDuration?: boolean;
};

export type SkyPresetKind = "zone" | "label";

export interface SkyAnnotationPreset {
	id: string;
	/** Short name shown on the button. */
	label: string;
	/** Tooltip / longer description. */
	description: string;
	kind: SkyPresetKind;
	/** Swatch color for the button. */
	swatch: string;
	patch: SkyAnnotationPatch;
}

const LABEL_BASE_STYLE: Partial<AnnotationTextStyle> = {
	fontFamily: SKY_FONT,
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "center",
	verticalAlign: "middle",
	borderRadius: 8,
	boxFill: undefined,
	boxBorderColor: undefined,
	boxBorderWidth: undefined,
};

const ZONE_BASE_STYLE: Partial<AnnotationTextStyle> = {
	fontFamily: SKY_FONT,
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "left",
	verticalAlign: "top",
	fontSize: 26,
	backgroundColor: "transparent",
	borderRadius: 6,
	boxBorderWidth: 3,
};

function textPatch(content: string): Pick<SkyAnnotationPatch, "type" | "content" | "textContent"> {
	return { type: "text", content, textContent: content };
}

function zone(
	id: string,
	label: string,
	description: string,
	text: string,
	color: string,
	fill: string,
	size: { width: number; height: number } = { width: 32, height: 12 },
): SkyAnnotationPreset {
	return {
		id,
		label,
		description,
		kind: "zone",
		swatch: color,
		patch: {
			...textPatch(text),
			pinToFrame: false,
			size,
			style: {
				...ZONE_BASE_STYLE,
				color,
				boxFill: fill,
				boxBorderColor: color,
			},
		},
	};
}

function tag(
	id: string,
	label: string,
	description: string,
	text: string,
	color: string,
	background: string,
): SkyAnnotationPreset {
	return {
		id,
		label,
		description,
		kind: "label",
		swatch: background === "transparent" ? color : background,
		patch: {
			...textPatch(text),
			pinToFrame: false,
			size: { width: 14, height: 8 },
			style: {
				...LABEL_BASE_STYLE,
				fontSize: 30,
				color,
				backgroundColor: background,
			},
		},
	};
}

/** Smart Money Concepts presets — "Geometría del Mercado". */
export const SKY_SMC_PRESETS: SkyAnnotationPreset[] = [
	zone(
		"ob-bull",
		"OB alcista",
		"Order Block alcista (zona verde)",
		"OB ▲",
		SKY_GREEN,
		"rgba(16, 185, 129, 0.22)",
	),
	zone(
		"ob-bear",
		"OB bajista",
		"Order Block bajista (zona roja)",
		"OB ▼",
		SKY_RED,
		"rgba(239, 68, 68, 0.22)",
	),
	zone(
		"fvg",
		"FVG",
		"Fair Value Gap / desequilibrio (zona dorada)",
		"FVG",
		SKY_GOLD,
		"rgba(212, 175, 55, 0.20)",
		{ width: 32, height: 8 },
	),
	zone(
		"premium",
		"Premium",
		"Zona premium (por encima del 50%)",
		"PREMIUM",
		SKY_RED,
		"rgba(239, 68, 68, 0.10)",
		{ width: 60, height: 25 },
	),
	zone(
		"discount",
		"Descuento",
		"Zona de descuento (por debajo del 50%)",
		"DESCUENTO",
		SKY_GREEN,
		"rgba(16, 185, 129, 0.10)",
		{ width: 60, height: 25 },
	),
	tag("bos", "BOS", "Break of Structure", "BOS", SKY_BLACK, SKY_GOLD),
	tag("choch", "CHoCH", "Change of Character", "CHoCH", SKY_GOLD, SKY_BLACK),
	tag(
		"liquidity",
		"Liquidez",
		"Liquidez ($$$)",
		"$$$ LIQUIDEZ",
		SKY_GOLD,
		"rgba(10, 10, 10, 0.85)",
	),
	tag(
		"equilibrium",
		"50%",
		"Equilibrio (50%)",
		"EQ 50%",
		SKY_GOLD_LIGHT,
		"rgba(10, 10, 10, 0.85)",
	),
	tag("entry", "Entrada", "Punto de entrada", "ENTRADA ✓", "#FFFFFF", SKY_GREEN),
	tag("sl", "SL", "Stop Loss", "SL ✕", "#FFFFFF", SKY_RED),
	tag("tp", "TP", "Take Profit", "TP ★", SKY_BLACK, SKY_GOLD),
];

export const SKY_WATERMARK_TEXT = "JulianVal.fx";

/* ------------------------------------------------------------------------- */
/* Frame-aware sizing                                                         */
/* ------------------------------------------------------------------------- */

/** Width (in base units) of the reference frame used by Recordly annotations. */
const BASE_WIDTH = 1920;
/** Inner padding of SKY boxes, must match SKY_BOX_TEXT_PADDING in the renderer. */
const BOX_PADDING = 20;
/** Average glyph width of bold Arial (caps + digits) relative to the font size. */
const BOLD_CHAR_WIDTH = 0.72;

export function isVerticalFrame(frameAspect: number): boolean {
	return Number.isFinite(frameAspect) && frameAspect > 0 && frameAspect < 1;
}

/**
 * Recordly scales text by the video width, so in a vertical Reel (1080 wide)
 * labels come out ~45% smaller than in a 1920 wide video. SKY presets compensate.
 */
export function skyTextScale(frameAspect: number): number {
	return isVerticalFrame(frameAspect) ? 1.8 : 1;
}

function clampPercent(value: number, max = 95): number {
	return Math.round(Math.min(max, Math.max(1, value)) * 10) / 10;
}

/** Makes an SMC zone/label preset readable on the current frame shape. */
export function adaptSkyPatchToAspect(
	patch: SkyAnnotationPatch,
	frameAspect: number,
): SkyAnnotationPatch {
	const scale = skyTextScale(frameAspect);
	if (scale === 1) return patch;
	return {
		...patch,
		size: patch.size
			? {
					width: clampPercent(patch.size.width * scale),
					height: clampPercent(patch.size.height * 1.25),
				}
			: undefined,
		style: patch.style
			? {
					...patch.style,
					fontSize: patch.style.fontSize
						? Math.round(patch.style.fontSize * scale)
						: undefined,
				}
			: undefined,
	};
}

export type SkyLogoVariant = "jv" | "full";

/** Width / height of the bundled logo files (skyLogos.ts). */
export const SKY_LOGO_ASPECT: Record<SkyLogoVariant, number> = {
	jv: 315 / 331,
	full: 616 / 488,
};

/*
 * Brand corner layout. The logo and the text watermark share one corner and are
 * stacked so they never overlap when both are used:
 *   - vertical (Reels/TikTok): top-right, logo on top, text right below it.
 *     The bottom and right edge are covered by the app buttons.
 *   - horizontal: bottom-right, text at the bottom, logo right above it.
 */
const BRAND_GAP = 0.8;

function brandMarginX(frameAspect: number): number {
	return isVerticalFrame(frameAspect) ? 4 : 3;
}

function watermarkFontSize(frameAspect: number): number {
	return Math.round(30 * skyTextScale(frameAspect));
}

function watermarkTextHeight(frameAspect: number): number {
	const fontSize = watermarkFontSize(frameAspect);
	return clampPercent(((fontSize * 1.4 + 20) / BASE_WIDTH) * frameAspect * 100);
}

function logoSize(variant: SkyLogoVariant, frameAspect: number) {
	const widthByVariant = isVerticalFrame(frameAspect)
		? { jv: 16, full: 24 }
		: { jv: 8, full: 14 };
	const width = widthByVariant[variant];
	return { width, height: clampPercent((width * frameAspect) / SKY_LOGO_ASPECT[variant]) };
}

function textWatermarkY(frameAspect: number): number {
	if (isVerticalFrame(frameAspect)) {
		// below the tallest logo variant, so it works with either logo
		const tallest = Math.max(
			logoSize("jv", frameAspect).height,
			logoSize("full", frameAspect).height,
		);
		return clampPercent(7 + tallest + BRAND_GAP);
	}
	return clampPercent(100 - watermarkTextHeight(frameAspect) - 4.5);
}

function logoWatermarkY(variant: SkyLogoVariant, frameAspect: number): number {
	if (isVerticalFrame(frameAspect)) return 7;
	return clampPercent(
		textWatermarkY(frameAspect) - logoSize(variant, frameAspect).height - BRAND_GAP,
	);
}

/** Brand watermark (text): gold, pinned to the frame, whole video. */
export function buildSkyWatermarkPatch(
	text = SKY_WATERMARK_TEXT,
	frameAspect = 16 / 9,
): SkyAnnotationPatch {
	const content = text.trim() || SKY_WATERMARK_TEXT;
	const fontSize = watermarkFontSize(frameAspect);
	const width = clampPercent(
		((content.length * BOLD_CHAR_WIDTH * fontSize + 40) / BASE_WIDTH) * 100,
	);
	const size = { width, height: watermarkTextHeight(frameAspect) };
	return {
		...textPatch(content),
		pinToFrame: true,
		fullDuration: true,
		position: {
			x: clampPercent(100 - width - brandMarginX(frameAspect)),
			y: textWatermarkY(frameAspect),
		},
		size,
		style: {
			...LABEL_BASE_STYLE,
			fontSize,
			color: "rgba(212, 175, 55, 0.9)",
			backgroundColor: "transparent",
			textAlign: "right",
			verticalAlign: "middle",
		},
	};
}

/** Brand watermark (logo image): pinned to the frame, whole video. */
export function buildSkyLogoWatermarkPatch(
	imageDataUrl: string,
	variant: SkyLogoVariant = "jv",
	frameAspect = 16 / 9,
): SkyAnnotationPatch {
	const size = logoSize(variant, frameAspect);
	return {
		type: "image",
		content: imageDataUrl,
		imageContent: imageDataUrl,
		pinToFrame: true,
		fullDuration: true,
		position: {
			x: clampPercent(100 - size.width - brandMarginX(frameAspect)),
			y: logoWatermarkY(variant, frameAspect),
		},
		size,
	};
}

export type SkyTradeDirection = "compra" | "venta";

export interface SkyTradeCardInput {
	symbol: string;
	direction: SkyTradeDirection;
	entry: string;
	stopLoss: string;
	takeProfit: string;
	/** Free text such as "+3R", "+$120" or "-1R". Optional. */
	result?: string;
}

function parsePrice(value: string): number | null {
	const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Risk:reward from entry / SL / TP. Returns null when the numbers are missing,
 * the risk is zero, or SL/TP are on the wrong side for the direction.
 */
export function computeRiskReward(input: SkyTradeCardInput): number | null {
	const entry = parsePrice(input.entry);
	const stop = parsePrice(input.stopLoss);
	const target = parsePrice(input.takeProfit);
	if (entry === null || stop === null || target === null) return null;

	const isBuy = input.direction === "compra";
	const risk = isBuy ? entry - stop : stop - entry;
	const reward = isBuy ? target - entry : entry - target;
	if (risk <= 0 || reward <= 0) return null;
	return reward / risk;
}

export function formatRiskReward(ratio: number | null): string {
	if (ratio === null) return "—";
	const rounded = Math.round(ratio * 10) / 10;
	return `1:${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

export function buildTradeCardText(input: SkyTradeCardInput): string {
	const symbol = input.symbol.trim().toUpperCase() || "XAUUSD";
	const direction = input.direction === "compra" ? "COMPRA ▲" : "VENTA ▼";
	const lines = [
		`${symbol} · ${direction}`,
		`Entrada: ${input.entry.trim() || "—"}`,
		`SL: ${input.stopLoss.trim() || "—"}`,
		`TP: ${input.takeProfit.trim() || "—"}`,
		`R:R ${formatRiskReward(computeRiskReward(input))}`,
	];
	const result = input.result?.trim();
	if (result) {
		const isLoss = result.startsWith("-");
		lines.push(`Resultado: ${result} ${isLoss ? "✕" : "✓"}`);
	}
	return lines.join("\n");
}

export function buildTradeCardPatch(
	input: SkyTradeCardInput,
	frameAspect = 16 / 9,
): SkyAnnotationPatch {
	const content = buildTradeCardText(input);
	const lines = content.split("\n");
	const fontSize = Math.round(28 * skyTextScale(frameAspect));
	const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
	const boxChrome = BOX_PADDING * 2 + 16;
	const width = clampPercent(
		((longest * BOLD_CHAR_WIDTH * fontSize + boxChrome) / BASE_WIDTH) * 100,
	);
	const height = clampPercent(
		(((lines.length + 0.5) * fontSize * 1.4 + boxChrome) / BASE_WIDTH) * frameAspect * 100,
		90,
	);
	return {
		...textPatch(content),
		// Fixed in the corner of the video: zooming into the chart does not move it.
		pinToFrame: true,
		position: { x: 4, y: isVerticalFrame(frameAspect) ? 7 : 5 },
		size: { width, height },
		style: {
			fontFamily: SKY_FONT,
			fontWeight: "bold",
			fontStyle: "normal",
			textDecoration: "none",
			fontSize,
			color: SKY_GOLD_LIGHT,
			backgroundColor: "transparent",
			textAlign: "left",
			verticalAlign: "middle",
			borderRadius: 18,
			boxFill: "rgba(10, 10, 10, 0.88)",
			boxBorderColor: SKY_GOLD,
			boxBorderWidth: 3,
		},
	};
}

/** Removes box styling so a preset can be undone back to a plain text label. */
export const SKY_CLEAR_BOX_STYLE: Partial<AnnotationTextStyle> = {
	boxFill: undefined,
	boxBorderColor: undefined,
	boxBorderWidth: undefined,
	verticalAlign: undefined,
};

/**
 * Turns a preset patch into the concrete AnnotationRegion update.
 * `durationMs` is only used when the patch asks for the whole video.
 */
export function resolveSkyAnnotationPatch(
	region: AnnotationRegion,
	patch: SkyAnnotationPatch,
	durationMs: number,
): AnnotationRegion {
	const { fullDuration, style, ...rest } = patch;
	const next: AnnotationRegion = {
		...region,
		...rest,
		style: { ...region.style, ...(style ?? {}) },
	};
	if (fullDuration && Number.isFinite(durationMs) && durationMs > 0) {
		next.startMs = 0;
		next.endMs = Math.max(1, Math.round(durationMs));
	}
	return next;
}

/* ------------------------------------------------------------------------- */
/* Vertical Reels preset                                                      */
/* ------------------------------------------------------------------------- */

export interface SkyReelLayoutInput {
	padding: Padding;
	cropRegion: CropRegion;
	webcam: WebcamOverlaySettings;
	wallpaper: string;
	borderRadius: number;
}

export interface SkyReelLayout extends SkyReelLayoutInput {
	aspectRatio: AspectRatio;
}

/**
 * Crop used by the Reels button: drops the browser tabs / toolbar at the top
 * and keeps the right ~60% of the screen, where the latest candles are.
 * The user can fine-tune it afterwards with "Recortar video".
 */
export const SKY_REEL_CROP: CropRegion = { x: 0.4, y: 0.07, width: 0.6, height: 0.93 };

export function buildSkyReelWebcam(current: WebcamOverlaySettings): WebcamOverlaySettings {
	return {
		...current,
		positionPreset: "bottom-center",
		positionX: 0.5,
		positionY: 1,
		size: 42,
		width: 42,
		height: 42,
		reactToZoom: false,
	};
}

export function buildSkyReelLayout(current: SkyReelLayoutInput): SkyReelLayout {
	return {
		aspectRatio: "9:16",
		padding: { top: 0, bottom: 0, left: 0, right: 0, linked: true },
		cropRegion: { ...SKY_REEL_CROP },
		borderRadius: 0,
		wallpaper: SKY_WALLPAPER,
		webcam: buildSkyReelWebcam(current.webcam),
	};
}
